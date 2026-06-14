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
const MAX_FAUCET_USDC = 50_000;

export async function POST(req: NextRequest) {
  const secret = process.env.FAUCET_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Faucet not configured. Set FAUCET_SECRET (the mint authority secret key) in app/.env.local." },
      { status: 503 }
    );
  }

  let owner: PublicKey;
  let amountUsdc: number;
  try {
    const body = await req.json();
    owner = new PublicKey(body.owner);
    amountUsdc = Math.min(Math.max(Number(body.amount) || 1000, 1), MAX_FAUCET_USDC);
  } catch {
    return NextResponse.json({ error: "Invalid request: { owner, amount }" }, { status: 400 });
  }

  try {
    const authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
    const conn = new Connection(L1_RPC, "confirmed");
    const mint = (await getAccount(conn, vaultPda())).mint;
    const ata = getAssociatedTokenAddressSync(mint, owner);

    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, ata, owner, mint),
      createMintToInstruction(mint, ata, authority.publicKey, BigInt(Math.round(amountUsdc * 1e6)))
    );
    const signature = await sendAndConfirmTransaction(conn, tx, [authority], { commitment: "confirmed" });

    return NextResponse.json({ signature, mint: mint.toBase58(), amount: amountUsdc });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
