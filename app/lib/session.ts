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
