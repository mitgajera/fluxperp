import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fluxperp } from "../target/types/fluxperp";
import idl from "../target/idl/fluxperp.json";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync } from "fs";

export const ER_RPC = process.env.ER_RPC || "https://devnet-as.magicblock.app";
export const ER_WS = process.env.ER_WS || "wss://devnet-as.magicblock.app";

export const MARKETS = [
  { index: 0, symbol: "SOL", product: "SOLUSDT" },
  { index: 1, symbol: "BTC", product: "BTCUSDT" },
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

// Binance spot as the perp oracle (e.g. SOLUSDT, BTCUSDT). Try the public market-data host
// first — api.binance.com returns 451 from many cloud/US IPs (e.g. Render), but
// data-api.binance.vision is not geo-restricted.
const BINANCE_HOSTS = ["https://data-api.binance.vision", "https://api.binance.com", "https://api1.binance.com"];

export async function fetchSpot(product: string): Promise<number> {
  let lastErr = "";
  for (const host of BINANCE_HOSTS) {
    try {
      const res = await fetch(`${host}/api/v3/ticker/price?symbol=${product}`);
      if (!res.ok) {
        lastErr = `${host} ${res.status}`;
        continue;
      }
      const j: any = await res.json();
      const p = parseFloat(j.price);
      if (p > 0) return p;
    } catch (e) {
      lastErr = `${host} ${(e as Error).message}`;
    }
  }
  throw new Error(`spot ${product} unavailable (${lastErr})`);
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
  index: anchor.BN,
  confirm = true
): Promise<string> {
  if (confirm) {
    return program.methods
      .pushPrice(marketIndex, mark, index)
      .accountsStrict({
        publisher: program.provider.publicKey!,
        priceFeed: priceFeedPda(program.programId, marketIndex),
      })
      .rpc();
  }
  // fire-and-forget: submit without waiting up to 30s for confirmation (degraded-RPC safe)
  const ix = await program.methods
    .pushPrice(marketIndex, mark, index)
    .accountsStrict({
      publisher: program.provider.publicKey!,
      priceFeed: priceFeedPda(program.programId, marketIndex),
    })
    .instruction();
  const conn = program.provider.connection;
  const tx = new anchor.web3.Transaction().add(ix);
  tx.feePayer = program.provider.publicKey!;
  tx.recentBlockhash = (await conn.getLatestBlockhash("confirmed")).blockhash;
  const signed = await (program.provider as anchor.AnchorProvider).wallet.signTransaction(tx);
  // preflight ON so an on-chain failure (e.g. wrong signer) surfaces instead of being hidden
  return conn.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 2 });
}

process.on("unhandledRejection", (e) => console.error("unhandledRejection:", String(e).slice(0, 120)));

async function main() {
  const walletPath = process.env.ANCHOR_WALLET;
  if (!walletPath) throw new Error("set ANCHOR_WALLET to the publisher keypair path");
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(walletPath, "utf8"))));
  const program = erProgram(new anchor.Wallet(kp));
  console.log(`publisher wallet: ${kp.publicKey.toBase58()} (must equal the feed's authorized publisher)`);

  const intervalMs = Number(process.env.PUBLISH_INTERVAL_MS || 400);
  const wanted = (process.env.MARKETS || "0,1").split(",").map(Number);
  const markets = MARKETS.filter((m) => wanted.includes(m.index));

  const live: typeof markets = [];
  for (const m of markets) {
    const pf = priceFeedPda(program.programId, m.index);
    try {
      const info = await program.provider.connection.getAccountInfo(pf);
      if (info) live.push(m);
      else console.log(`  market ${m.index} (${m.symbol}) PriceFeed not on ER — skipping`);
    } catch {
      live.push(m); // RPC blip — assume the market exists and let the loop retry
    }
  }

  console.log(
    `price-publisher: ER=${ER_RPC} markets=[${live.map((m) => m.symbol).join(",")}] every ${intervalMs}ms`
  );

  // Demo liveliness: overlay an anchored, mean-reverting random walk on the real
  // spot so the chart and book actually MOVE, while staying tethered to reality.
  // SYNTH_VOL_BPS = per-tick step (0 disables → pure real spot). index = real spot.
  const SIGMA = Number(process.env.SYNTH_VOL_BPS || 8) / 10_000;
  const THETA = 0.12; // strong pull back toward real spot so the perp tracks Binance closely
  const synth: Record<number, number> = {};
  const spot: Record<number, number> = {};
  const last: Record<number, number> = {};
  let spotAge = 0;
  const gauss = () => {
    const u = 1 - Math.random();
    const v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  let busy = false;
  // refresh the real spot anchor only occasionally (the API is slow); walk in between.
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const refreshSpot = spotAge++ % 3 === 0; // refresh real spot ~every 3 ticks (~1.2s)
      for (const m of live) {
        if (refreshSpot) {
          try {
            spot[m.index] = await fetchSpot(m.product);
            last[m.index] = spot[m.index];
          } catch {
            /* keep last anchor */
          }
        }
        const anchor = spot[m.index] ?? last[m.index];
        if (!anchor) continue;

        let s = synth[m.index] ?? anchor;
        if (SIGMA > 0) {
          s = s + s * SIGMA * gauss() + (anchor - s) * THETA; // random walk + reversion
        } else {
          s = anchor;
        }
        synth[m.index] = s;

        try {
          const sig = await sendPushPrice(program, m.index, toFixed6(s), toFixed6(anchor), false);
          console.log(`  ${m.symbol} ${s.toFixed(m.index === 1 ? 1 : 3)} (spot ${anchor.toFixed(2)}) -> ${sig.slice(0, 8)}…`);
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
