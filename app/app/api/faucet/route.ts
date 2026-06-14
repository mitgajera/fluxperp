import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { vaultPda } from "../../../lib/program";

export const runtime = "nodejs";

const L1_RPC = process.env.NEXT_PUBLIC_SOLANA_L1_RPC || "https://api.devnet.solana.com";
const CLAIM_USDC = 1000; // fixed amount per claim
const COOLDOWN_MS = 2 * 60 * 60 * 1000; // one claim per wallet per 2 hours

// Cooldown store: Upstash/Vercel KV via REST when configured (durable across serverless
// instances on Vercel), else an in-memory Map (fine for local dev / single process).
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const mem = new Map<string, number>();

async function getLastClaim(owner: string): Promise<number> {
  if (KV_URL && KV_TOKEN) {
    try {
      const r = await fetch(`${KV_URL}/get/faucet:${owner}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` }, cache: "no-store" });
      const j = (await r.json()) as { result?: string | null };
      return j.result ? Number(j.result) : 0;
    } catch {
      return mem.get(owner) ?? 0;
    }
  }
  return mem.get(owner) ?? 0;
}

async function setLastClaim(owner: string, ts: number): Promise<void> {
  mem.set(owner, ts);
  if (KV_URL && KV_TOKEN) {
    try {
      // auto-expire the key after the cooldown so the store stays clean
      await fetch(`${KV_URL}/set/faucet:${owner}/${ts}/EX/${Math.ceil(COOLDOWN_MS / 1000)}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
        cache: "no-store",
      });
    } catch {}
  }
}

export async function GET(req: NextRequest) {
  // lets the UI show remaining cooldown without minting
  const owner = req.nextUrl.searchParams.get("owner");
  if (!owner) return NextResponse.json({ amount: CLAIM_USDC, cooldownMs: COOLDOWN_MS });
  const last = await getLastClaim(owner);
  const remaining = Math.max(0, COOLDOWN_MS - (Date.now() - last));
  return NextResponse.json({ amount: CLAIM_USDC, cooldownMs: COOLDOWN_MS, remainingMs: remaining, ready: remaining === 0 });
}

export async function POST(req: NextRequest) {
  const secret = process.env.FAUCET_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Faucet not configured. Set FAUCET_SECRET (the mint authority secret key) in app/.env.local." },
      { status: 503 }
    );
  }

  let owner: PublicKey;
  try {
    owner = new PublicKey((await req.json()).owner);
  } catch {
    return NextResponse.json({ error: "Invalid request: { owner }" }, { status: 400 });
  }

  // rate limit: 1000 USDC per wallet per 2 hours
  const key = owner.toBase58();
  const last = await getLastClaim(key);
  const remaining = COOLDOWN_MS - (Date.now() - last);
  if (remaining > 0) {
    const mins = Math.ceil(remaining / 60000);
    return NextResponse.json(
      { error: `Faucet cooldown — try again in ${mins} min`, remainingMs: remaining },
      { status: 429 }
    );
  }

  try {
    const authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
    const conn = new Connection(L1_RPC, "confirmed");
    const mint = (await getAccount(conn, vaultPda())).mint;
    const ata = getAssociatedTokenAddressSync(mint, owner);

    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, ata, owner, mint),
      createMintToInstruction(mint, ata, authority.publicKey, BigInt(Math.round(CLAIM_USDC * 1e6)))
    );
    const signature = await sendAndConfirmTransaction(conn, tx, [authority], { commitment: "confirmed" });

    await setLastClaim(key, Date.now());
    return NextResponse.json({ signature, mint: mint.toBase58(), amount: CLAIM_USDC, cooldownMs: COOLDOWN_MS });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
