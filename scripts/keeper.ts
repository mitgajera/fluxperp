import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync } from "fs";
import { erProgram } from "./price-publisher";

const MARKET_INDEX = Number(process.env.MARKET || 0);
const INTERVAL_MS = Number(process.env.KEEPER_INTERVAL_MS || 5000);
const MAINTENANCE_MARGIN_BPS = 500;
const FUNDING_INTERVAL = 3600;
const SIZE_SCALE = 1_000_000n;
const BPS = 10_000n;

const enc = new TextEncoder();
const mi = Buffer.from([MARKET_INDEX]);

function load(): anchor.Program {
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.ANCHOR_WALLET!, "utf8"))));
  return erProgram(new anchor.Wallet(kp)) as unknown as anchor.Program;
}

const program = load();
const pda = (s: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(s, program.programId)[0];
const marketConfig = pda([enc.encode("market"), mi]);
const orderbook = pda([enc.encode("orderbook"), mi]);
const fillLog = pda([enc.encode("fill_log"), mi]);
const priceFeed = pda([enc.encode("price"), mi]);
const riskEngine = pda([enc.encode("risk"), mi]);
const collOf = (k: PublicKey) => pda([enc.encode("collateral"), k.toBuffer()]);
const posOf = (k: PublicKey) => pda([enc.encode("position"), k.toBuffer(), mi]);
const trigOf = (k: PublicKey) => pda([enc.encode("triggers"), k.toBuffer(), mi]);
const advOf = (k: PublicKey) => pda([enc.encode("adv"), k.toBuffer(), mi]);

const ALL_MARKETS = (process.env.MARKETS || "0,1").split(",").map(Number);
const marginOf = (k: PublicKey) => pda([enc.encode("margin"), k.toBuffer()]);
const posOfM = (k: PublicKey, m: number) => pda([enc.encode("position"), k.toBuffer(), Buffer.from([m])]);
const priceOfM = (m: number) => pda([enc.encode("price"), Buffer.from([m])]);

function healthBps(pos: any, mark: bigint): number {
  if (!pos.side.long && !pos.side.short) return Number.MAX_SAFE_INTEGER;
  const size = BigInt(pos.size.toString());
  const entry = BigInt(pos.entryPrice.toString());
  const notional = (size * mark) / SIZE_SCALE;
  if (notional === 0n) return Number.MAX_SAFE_INTEGER;
  const pnl = pos.side.long ? ((mark - entry) * size) / SIZE_SCALE : ((entry - mark) * size) / SIZE_SCALE;
  const equity = BigInt(pos.marginAllocated.toString()) + pnl;
  return Number((equity * BPS) / notional);
}

async function makerPairsFor(closingSide: "buy" | "sell") {
  const ob: any = await (program.account as any).orderbookState.fetch(orderbook);
  const book = closingSide === "sell" ? ob.bids : ob.asks;

  const owners = [...new Set(book.slice(0, 5).map((o: any) => o.owner.toBase58()))] as string[];
  return owners.flatMap((o) => {
    const k = new PublicKey(o);
    return [
      { pubkey: posOf(k), isWritable: true, isSigner: false },
      { pubkey: collOf(k), isWritable: true, isSigner: false },
    ];
  });
}

async function tick() {
  const me = program.provider.publicKey!;
  let mark: bigint;
  try {
    const pf: any = await (program.account as any).priceFeed.fetch(priceFeed);
    mark = BigInt(pf.markPrice.toString());
    if (mark === 0n) return;
  } catch {
    return;
  }

  const positions = await (program.account as any).positionAccount.all();
  const triggers = await (program.account as any).triggerOrders.all();

  try {
    await program.methods
      .updateRisk(MARKET_INDEX)
      .accountsStrict({ cranker: me, priceFeed, riskEngine })
      .rpc();
  } catch {
  }

  let advs: any[] = [];
  try {
    advs = await (program.account as any).advancedOrders.all();
  } catch {
    advs = [];
  }
  for (const a of advs) {
    if (a.account.orders.length === 0) continue;
    const trader = a.account.user as PublicKey;
    try {
      await program.methods
        .crankTwap(MARKET_INDEX, trader)
        .accountsStrict({ cranker: me, orderbook, advanced: advOf(trader) })
        .rpc();
    } catch {
    }
    try {
      await program.methods
        .reapExpired(MARKET_INDEX, trader)
        .accountsStrict({ cranker: me, orderbook, advanced: advOf(trader) })
        .rpc();
    } catch {
    }
  }

  if (MARKET_INDEX === 0) {
    let profiles: any[] = [];
    try {
      profiles = await (program.account as any).marginProfile.all();
    } catch {
      profiles = [];
    }
    for (const p of profiles) {
      const user = p.account.user as PublicKey;
      const rem = ALL_MARKETS.flatMap((m) => [
        { pubkey: posOfM(user, m), isWritable: false, isSigner: false },
        { pubkey: priceOfM(m), isWritable: false, isSigner: false },
      ]);
      try {
        await program.methods
          .updateMarginProfile()
          .accountsStrict({ cranker: me, marginProfile: marginOf(user) })
          .remainingAccounts(rem)
          .rpc();
      } catch {
      }
    }
  }

  for (const t of triggers) {
    if (t.account.triggers.length === 0) continue;
    const trader = t.account.user as PublicKey;
    try {
      await program.methods
        .crankTriggers(MARKET_INDEX, trader)
        .accountsStrict({
          cranker: me, marketConfig, priceFeed, orderbook, fillLog,
          traderTriggers: trigOf(trader), traderPosition: posOf(trader), traderCollateral: collOf(trader),
        })
        .remainingAccounts(await makerPairsFor("sell"))
        .rpc();
      console.log(`crank_triggers fired for ${trader.toBase58().slice(0, 8)}`);
    } catch {
    }
  }

  for (const p of positions) {
    const pos = p.account;
    if (!pos.side.long && !pos.side.short) continue;
    const h = healthBps(pos, mark);
    if (h >= MAINTENANCE_MARGIN_BPS) continue;
    const trader = pos.user as PublicKey;
    const closingSide = pos.side.long ? "sell" : "buy";
    try {
      await program.methods
        .liquidate(MARKET_INDEX, trader)
        .accountsStrict({
          liquidator: me, marketConfig, priceFeed, orderbook, fillLog,
          traderPosition: posOf(trader), traderCollateral: collOf(trader), liquidatorCollateral: collOf(me),
        })
        .remainingAccounts(await makerPairsFor(closingSide))
        .rpc();
      console.log(`liquidated ${trader.toBase58().slice(0, 8)} (health ${h}bps)`);
    } catch (e) {
      console.error(`liquidate ${trader.toBase58().slice(0, 8)} failed: ${(e as Error).message.slice(0, 80)}`);
    }
  }

  try {
    const ob: any = await (program.account as any).orderbookState.fetch(orderbook);
    const now = Math.floor(Date.now() / 1000);
    if (now - Number(ob.lastFundingTs) >= FUNDING_INTERVAL) {
      const rem = positions
        .filter((p: any) => p.account.side.long || p.account.side.short)
        .flatMap((p: any) => [
          { pubkey: posOf(p.account.user), isWritable: true, isSigner: false },
          { pubkey: collOf(p.account.user), isWritable: true, isSigner: false },
        ]);
      await program.methods
        .applyFunding(MARKET_INDEX)
        .accountsStrict({ cranker: me, priceFeed, orderbook })
        .remainingAccounts(rem)
        .rpc();
      console.log("apply_funding done");
    }
  } catch (e) {
    console.error(`apply_funding: ${(e as Error).message.slice(0, 80)}`);
  }
}

(async () => {
  console.log(`keeper: market ${MARKET_INDEX}, every ${INTERVAL_MS}ms`);
  let busy = false;
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await tick();
    } catch (e) {
      console.error("tick error:", (e as Error).message.slice(0, 120));
    } finally {
      busy = false;
    }
  }, INTERVAL_MS);
})();
