import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fluxperp } from "../target/types/fluxperp";
import idl from "../target/idl/fluxperp.json";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync } from "fs";

export const ER_RPC = process.env.ER_RPC || "https://devnet-as.magicblock.app";
export const ER_WS = process.env.ER_WS || "wss://devnet-as.magicblock.app";

export const MARKETS = [
  { index: 0, symbol: "SOL", product: "SOL-USD" },
  { index: 1, symbol: "BTC", product: "BTC-USD" },
];

const enc = new TextEncoder();

export function priceFeedPda(programId: PublicKey, marketIndex: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [enc.encode("price"), Buffer.from([marketIndex])],
    programId
  )[0];
}

export function toFixed6(n: number): anchor.BN {
  return new anchor.BN(Math.round(n * 1_000_000));
}

export async function fetchSpot(product: string): Promise<number> {
  const res = await fetch(`https://api.coinbase.com/v2/prices/${product}/spot`);
  if (!res.ok) throw new Error(`spot ${product} ${res.status}`);
  const j: any = await res.json();
  return parseFloat(j.data.amount);
}

export function erProgram(wallet: anchor.Wallet): Program<Fluxperp> {
  const connection = new Connection(ER_RPC, { wsEndpoint: ER_WS, commitment: "confirmed" });
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program<Fluxperp>(idl as Fluxperp, provider);
}

export async function sendPushPrice(
  program: Program<Fluxperp>,
  marketIndex: number,
  mark: anchor.BN,
  index: anchor.BN
): Promise<string> {
  return program.methods
    .pushPrice(marketIndex, mark, index)
    .accountsStrict({
      publisher: program.provider.publicKey!,
      priceFeed: priceFeedPda(program.programId, marketIndex),
    })
    .rpc();
}

async function main() {
  const walletPath = process.env.ANCHOR_WALLET;
  if (!walletPath) throw new Error("set ANCHOR_WALLET to the publisher keypair path");
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(walletPath, "utf8"))));
  const program = erProgram(new anchor.Wallet(kp));

  const intervalMs = Number(process.env.PUBLISH_INTERVAL_MS || 400);
  const wanted = (process.env.MARKETS || "0,1").split(",").map(Number);
  const markets = MARKETS.filter((m) => wanted.includes(m.index));

  const live: typeof markets = [];
  for (const m of markets) {
    const pf = priceFeedPda(program.programId, m.index);
    const info = await program.provider.connection.getAccountInfo(pf);
    if (info) live.push(m);
    else console.log(`  market ${m.index} (${m.symbol}) PriceFeed not on ER — skipping`);
  }

  console.log(
    `price-publisher: ER=${ER_RPC} markets=[${live.map((m) => m.symbol).join(",")}] every ${intervalMs}ms`
  );

  const last: Record<number, number> = {};
  let busy = false;
  setInterval(async () => {
    if (busy) return;

    busy = true;
    try {
      for (const m of live) {
        let px: number | undefined;
        try {
          px = await fetchSpot(m.product);
          last[m.index] = px;
        } catch {
          px = last[m.index];
        }
        if (!px) continue;
        try {
          const fx = toFixed6(px);
          const sig = await sendPushPrice(program, m.index, fx, fx);
          console.log(`  ${m.symbol} ${px.toFixed(2)} -> ${sig.slice(0, 8)}…`);
        } catch (e) {
          console.error(`  ${m.symbol} push failed: ${(e as Error).message}`);
        }
      }
    } finally {
      busy = false;
    }
  }, intervalMs);
}

if (require.main === module) main();
