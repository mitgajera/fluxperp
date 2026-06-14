import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

const STORAGE_KEY = "fluxperp_session_v1";
const SESSION_TTL_MS = 60 * 60 * 1000;  // 1 hour

const DEFAULT_FUND_SOL = 0.05;

interface StoredSession {
  secretKey: number[];
  expiresAt: number;
}

const hasWindow = () => typeof window !== "undefined";

// --- deterministic session keyed to the wallet (same wallet → same account) ---
// The session keypair is seeded from a wallet signature over a fixed message. ed25519
// signatures are deterministic, so the SAME wallet always derives the SAME session key
// (and thus the same collateral / position PDAs) — deposits persist across devices.
const SESSION_MESSAGE =
  "Sign in to FluxPerp.\n\nThis creates your deterministic trading session key. " +
  "It does NOT authorize any transfer or transaction.\n\nWallet:";

const walletKey = (wallet: string) => `fluxperp_session_v2_${wallet}`;

export function cachedSessionFor(wallet: string): Keypair | null {
  if (!hasWindow()) return null;
  const raw = window.localStorage.getItem(walletKey(wallet));
  if (!raw) return null;
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
  } catch {
    return null;
  }
}

export async function deriveSession(
  wallet: string,
  signMessage: (m: Uint8Array) => Promise<Uint8Array>
): Promise<Keypair> {
  const cached = cachedSessionFor(wallet);
  if (cached) return cached;
  const msg = new TextEncoder().encode(`${SESSION_MESSAGE} ${wallet}`);
  const sig = await signMessage(msg);
  const buf = new ArrayBuffer(sig.length);
  new Uint8Array(buf).set(sig);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
  const kp = Keypair.fromSeed(digest.slice(0, 32));
  if (hasWindow()) window.localStorage.setItem(walletKey(wallet), JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

export function clearSessionFor(wallet: string) {
  if (hasWindow()) window.localStorage.removeItem(walletKey(wallet));
}

export function loadSession(): Keypair | null {
  if (!hasWindow()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const s: StoredSession = JSON.parse(raw);
    if (Date.now() > s.expiresAt) {
      clearSession();
      return null;
    }
    return Keypair.fromSecretKey(Uint8Array.from(s.secretKey));
  } catch {
    clearSession();
    return null;
  }
}

export function sessionExpiry(): number | null {
  if (!hasWindow()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as StoredSession).expiresAt;
  } catch {
    return null;
  }
}

export function createSession(): Keypair {
  const kp = Keypair.generate();
  if (hasWindow()) {
    const stored: StoredSession = {
      secretKey: Array.from(kp.secretKey),
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }
  return kp;
}

export function clearSession() {
  if (hasWindow()) window.localStorage.removeItem(STORAGE_KEY);
}

export async function fundSession(
  l1: Connection,
  payer: PublicKey,
  session: PublicKey,
  signAndSend: (tx: Transaction) => Promise<string>,
  sol: number = DEFAULT_FUND_SOL
): Promise<string> {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: session,
      lamports: Math.floor(sol * LAMPORTS_PER_SOL),
    })
  );
  tx.feePayer = payer;
  tx.recentBlockhash = (await l1.getLatestBlockhash("confirmed")).blockhash;
  return signAndSend(tx);
}

export async function startSession(
  l1: Connection,
  payer: PublicKey,
  signAndSend: (tx: Transaction) => Promise<string>,
  sol?: number
): Promise<Keypair> {
  const existing = loadSession();
  if (existing) return existing;
  const session = createSession();
  await fundSession(l1, payer, session.publicKey, signAndSend, sol);
  return session;
}

export function sessionWallet(kp: Keypair): anchor.Wallet {
  return {
    publicKey: kp.publicKey,
    payer: kp,
    signTransaction: async (tx: any) => {
      tx.partialSign(kp);
      return tx;
    },
    signAllTransactions: async (txs: any[]) => {
      txs.forEach((t) => t.partialSign(kp));
      return txs;
    },
  } as unknown as anchor.Wallet;
}
