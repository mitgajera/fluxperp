import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fluxperp } from "../target/types/fluxperp";
import idl from "../target/idl/fluxperp.json";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
  mintTo,
} from "@solana/spl-token";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const MARKET = Number(process.env.MARKET || 0);
const LEVELS = Number(process.env.MM_LEVELS || 4);
const SPREAD_BPS = Number(process.env.MM_SPREAD_BPS || 8);
const SIZE = Number(process.env.MM_SIZE || 1);
const INTERVAL = Number(process.env.MM_INTERVAL_MS || 2500);
const CAPITAL = Number(process.env.MM_CAPITAL || 2_000_000); // USDC the maker mints/deposits
const ER_RPC = process.env.ER_RPC || "https://devnet-as.magicblock.app";
const ER_WS = process.env.ER_WS || "wss://devnet-as.magicblock.app";
const L1_RPC = process.env.SOLANA_L1_RPC || "https://api.devnet.solana.com";
const TOKEN = anchor.utils.token.TOKEN_PROGRAM_ID;
const DELEG = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const TICK = 1000;

const enc = new TextEncoder();
const mi = Buffer.from([MARKET]);
const main = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.ANCHOR_WALLET!, "utf8"))));

const programId = new PublicKey((idl as any).address);
const pda = (s: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(s, programId)[0];
const marketConfig = pda([enc.encode("market"), mi]);
const orderbook = pda([enc.encode("orderbook"), mi]);
const fillLog = pda([enc.encode("fill_log"), mi]);
const priceFeed = pda([enc.encode("price"), mi]);
const vault = pda([enc.encode("vault")]);
const collOf = (k: PublicKey) => pda([enc.encode("collateral"), k.toBuffer()]);
const posOf = (k: PublicKey) => pda([enc.encode("position"), k.toBuffer(), mi]);
const trigOf = (k: PublicKey) => pda([enc.encode("triggers"), k.toBuffer(), mi]);

function wallet(kp: Keypair): anchor.Wallet {
  return { publicKey: kp.publicKey, payer: kp, signTransaction: async (t: any) => { t.partialSign(kp); return t; }, signAllTransactions: async (ts: any[]) => { ts.forEach((t) => t.partialSign(kp)); return ts; } } as any;
}

function loadKp(name: string): Keypair {
  const path = join(__dirname, name);
  if (existsSync(path)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
  const kp = Keypair.generate();
  writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

// taker bot — periodically takes liquidity so the market actually prints trades
const TAKER_ENABLED = process.env.MM_TAKER !== "0";
const TAKER_INTERVAL = Number(process.env.MM_TAKER_MS || 2200);
const TAKER_CAPITAL = Number(process.env.MM_TAKER_CAPITAL || 500_000);

const l1 = new Connection(L1_RPC, "confirmed");
const erConn = new Connection(ER_RPC, { wsEndpoint: ER_WS, commitment: "confirmed" });
const maker = loadKp(".maker.json");
const taker = loadKp(".taker.json");
const l1p = new Program<Fluxperp>(idl as Fluxperp, new anchor.AnchorProvider(l1, wallet(maker), { commitment: "confirmed" }));
const erp = new Program<Fluxperp>(idl as Fluxperp, new anchor.AnchorProvider(erConn, wallet(maker), { commitment: "confirmed" }));
const l1pT = new Program<Fluxperp>(idl as Fluxperp, new anchor.AnchorProvider(l1, wallet(taker), { commitment: "confirmed" }));
const erpT = new Program<Fluxperp>(idl as Fluxperp, new anchor.AnchorProvider(erConn, wallet(taker), { commitment: "confirmed" }));

async function isDelegated(a: PublicKey) {
  const i = await l1.getAccountInfo(a);
  return !!i && i.owner.equals(DELEG);
}

async function ensureSetupFor(kp: Keypair, prog: Program<Fluxperp>, mint: PublicKey, capital: number) {
  if ((await l1.getBalance(kp.publicKey)) < 0.05 * LAMPORTS_PER_SOL) {
    await l1.confirmTransaction(await l1.sendTransaction(new Transaction().add(SystemProgram.transfer({ fromPubkey: main.publicKey, toPubkey: kp.publicKey, lamports: 0.2 * LAMPORTS_PER_SOL })), [main]), "confirmed");
  }
  const ata = getAssociatedTokenAddressSync(mint, kp.publicKey);
  const cap = BigInt(Math.round(capital * 1e6));
  if (!(await l1.getAccountInfo(ata))) {
    await l1.confirmTransaction(await l1.sendTransaction(new Transaction().add(createAssociatedTokenAccountIdempotentInstruction(main.publicKey, ata, kp.publicKey, mint)), [main]), "confirmed");
    await mintTo(l1, main, mint, ata, main, cap);
  }
  if (!(await l1.getAccountInfo(collOf(kp.publicKey)))) {
    await prog.methods.initializeCollateral().accountsStrict({ user: kp.publicKey, collateral: collOf(kp.publicKey), systemProgram: SystemProgram.programId }).rpc();
    await prog.methods.depositCollateral(new anchor.BN(cap.toString())).accountsStrict({ user: kp.publicKey, collateral: collOf(kp.publicKey), userTokenAccount: ata, vault, tokenProgram: TOKEN }).rpc();
  }
  if (!(await l1.getAccountInfo(posOf(kp.publicKey)))) await prog.methods.initializePosition(MARKET).accountsStrict({ user: kp.publicKey, marketConfig, position: posOf(kp.publicKey), systemProgram: SystemProgram.programId }).rpc();
  if (!(await l1.getAccountInfo(trigOf(kp.publicKey)))) await prog.methods.initializeTriggers(MARKET).accountsStrict({ user: kp.publicKey, marketConfig, triggers: trigOf(kp.publicKey), systemProgram: SystemProgram.programId }).rpc();
  if (!(await isDelegated(collOf(kp.publicKey)))) await prog.methods.delegateCollateral().accountsPartial({ payer: kp.publicKey, collateral: collOf(kp.publicKey) }).rpc();
  if (!(await isDelegated(posOf(kp.publicKey)))) await prog.methods.delegatePosition(MARKET).accountsPartial({ payer: kp.publicKey, position: posOf(kp.publicKey) }).rpc();
}

const f6 = (n: number) => new anchor.BN(Math.round(n * 1e6));
const align = (n: number) => Math.round((n * 1e6) / TICK) * TICK;  // tick-aligned (1e6 units)

type Acct = { pubkey: PublicKey; isWritable: boolean; isSigner: boolean };

const placeLimitIx = (side: "long" | "short", price1e6: number, size: number, cross: Acct[] = []) =>
  erp.methods
    .placeOrder(MARKET, side === "long" ? { long: {} } : { short: {} }, new anchor.BN(price1e6), f6(size), { limit: {} })
    .accountsStrict({ taker: maker.publicKey, marketConfig, orderbook, fillLog, takerPosition: posOf(maker.publicKey), takerCollateral: collOf(maker.publicKey), riskEngine: null, marginProfile: null })
    .remainingAccounts(cross)
    .instruction();

const ownerAccts = (owners: string[]): Acct[] =>
  owners.flatMap((o) => {
    const k = new PublicKey(o);
    return [
      { pubkey: posOf(k), isWritable: true, isSigner: false },
      { pubkey: collOf(k), isWritable: true, isSigner: false },
    ];
  });

const cancelIx = (id: anchor.BN) =>
  erp.methods.cancelOrder(MARKET, id).accountsStrict({ owner: maker.publicKey, orderbook }).instruction();

// All the maker's order ixs share the same ~8 accounts, so many fit in one tx.
// Submit (don't await confirmation) and pipeline — the book lands in ~hundreds of ms,
// not the ~5s a per-order confirmed loop took.
async function pipeline(ixs: anchor.web3.TransactionInstruction[], perTx: number) {
  let blockhash = (await erConn.getLatestBlockhash("confirmed")).blockhash;
  const sends: Promise<unknown>[] = [];
  for (let i = 0; i < ixs.length; i += perTx) {
    const tx = new Transaction().add(...ixs.slice(i, i + perTx));
    tx.feePayer = maker.publicKey;
    tx.recentBlockhash = blockhash;
    tx.sign(maker);
    sends.push(erConn.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 2 }).catch(() => {}));
  }
  await Promise.all(sends);
}

let lastQuoteMark = 0;

async function quote() {
  const pf: any = await erp.account.priceFeed.fetch(priceFeed);
  const mark = pf.markPrice.toNumber();
  if (mark === 0) return; // never quote off a bad price (would print junk levels)

  const ob: any = await erp.account.orderbookState.fetch(orderbook);
  const meB58 = maker.publicKey.toBase58();
  const mine = [...ob.bids, ...ob.asks].filter((o: any) => o.owner.toBase58() === meB58);
  // resting orders owned by OTHERS (users). When our quote crosses one, we must pass
  // its owner's accounts or the cross fails silently — which is why limit orders never
  // executed when the price reached them.
  const otherBids = ob.bids.filter((o: any) => o.owner.toBase58() !== meB58);
  const otherAsks = ob.asks.filter((o: any) => o.owner.toBase58() !== meB58);
  const hasOthers = otherBids.length > 0 || otherAsks.length > 0;

  // re-quote whenever the price moved ~a quarter level — keeps the book lively/fast.
  // also always re-quote when a user order rests, so a crossing fill goes through promptly.
  const moved = Math.abs(mark - lastQuoteMark) > (mark * SPREAD_BPS) / 40000;
  if (mine.length >= LEVELS * 2 && !moved && !hasOthers) return;
  lastQuoteMark = mark;

  const oldIds = mine.map((o: any) => o.orderId as anchor.BN);

  // build the fresh ladder (depth pyramid). An order that crosses a user's resting order
  // carries that owner's accounts so the matching engine can fill it.
  const placeIxs: anchor.web3.TransactionInstruction[] = [];
  for (let i = 1; i <= LEVELS; i++) {
    const off = (mark * SPREAD_BPS * i) / 10000;
    const size = SIZE * i;
    const bidPx = align((mark - off) / 1e6);
    const askPx = align((mark + off) / 1e6);
    const bidCross = ownerAccts([...new Set(otherAsks.filter((o: any) => o.price.toNumber() <= bidPx).map((o: any) => o.owner.toBase58()))] as string[]);
    const askCross = ownerAccts([...new Set(otherBids.filter((o: any) => o.price.toNumber() >= askPx).map((o: any) => o.owner.toBase58()))] as string[]);
    placeIxs.push(await placeLimitIx("long", bidPx, size, bidCross));
    placeIxs.push(await placeLimitIx("short", askPx, size, askCross));
  }
  // crossing orders need preflight off but reliable landing; small ladder so 6/tx is fine
  await pipeline(placeIxs, 6);
  if (oldIds.length) {
    const cancelIxs = await Promise.all(oldIds.map((id: anchor.BN) => cancelIx(id)));
    await pipeline(cancelIxs, 12);
  }
}

// Taker bot: sweep a small amount off the MAKER's touch so the market continuously prints
// trades — but never consume a user's resting limit order (so user limits actually wait and
// only fill when the price genuinely moves to them via the maker's crossing quote).
let takerLong = true;
async function takerTrade() {
  const ob: any = await erpT.account.orderbookState.fetch(orderbook);
  const me = maker.publicKey.toBase58();
  const asks = [...ob.asks].sort((a: any, b: any) => a.price.toNumber() - b.price.toNumber());
  const bids = [...ob.bids].sort((a: any, b: any) => b.price.toNumber() - a.price.toNumber());
  const bestAsk = asks[0];
  const bestBid = bids[0];
  // only take when the touch is the maker's own order
  const canBuy = bestAsk && bestAsk.owner.toBase58() === me;
  const canSell = bestBid && bestBid.owner.toBase58() === me;
  let side: "long" | "short";
  if (canBuy && canSell) { side = takerLong ? "long" : "short"; takerLong = !takerLong; }
  else if (canBuy) side = "long";
  else if (canSell) side = "short";
  else return; // both touches are user orders — leave them resting

  const touch = side === "long" ? bestAsk : bestBid;
  const cap = touch.size.toNumber() / 1e6;             // never spill past the maker's touch
  const size = Math.min(cap, +(0.4 + Math.random() * 2).toFixed(3));
  if (size < 0.05) return;

  const ix = await erpT.methods
    .placeOrder(MARKET, side === "long" ? { long: {} } : { short: {} }, new anchor.BN(0), f6(size), { market: {} })
    .accountsStrict({ taker: taker.publicKey, marketConfig, orderbook, fillLog, takerPosition: posOf(taker.publicKey), takerCollateral: collOf(taker.publicKey), riskEngine: null, marginProfile: null })
    .remainingAccounts(ownerAccts([me]))
    .instruction();
  const tx = new Transaction().add(ix);
  tx.feePayer = taker.publicKey;
  tx.recentBlockhash = (await erConn.getLatestBlockhash("confirmed")).blockhash;
  tx.sign(taker);
  // preflight on so a bad trade surfaces instead of silently doing nothing
  try {
    const sig = await erConn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 2 });
    console.log(`taker ${side} ${size.toFixed(2)} @ ${(touch.price.toNumber() / 1e6).toFixed(3)} -> ${sig.slice(0, 8)}`);
  } catch (e) {
    const m = (e as Error).message;
    const logs = (e as { logs?: string[] }).logs;
    console.error(`taker ${side} ${size.toFixed(2)} FAILED: ${m.slice(0, 140)}`);
    if (logs?.length) console.error(logs.slice(-6).join("\n"));
  }
}

const retry = async <T>(fn: () => Promise<T>, label: string): Promise<T> => {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      console.error(`${label} failed (attempt ${i + 1}): ${(e as Error).message.slice(0, 80)} — retrying`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
};

// never let a transient RPC error kill the maker
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", String(e).slice(0, 100)));

(async () => {
  const mint = await retry(async () => (await getAccount(l1, vault)).mint, "vault read");
  console.log(`market-maker: maker=${maker.publicKey.toBase58().slice(0, 8)} mint=${mint.toBase58().slice(0, 8)} capital=${CAPITAL} USDC`);
  console.log("ensuring maker setup (fund/deposit/delegate)…");
  await retry(() => ensureSetupFor(maker, l1p, mint, CAPITAL), "ensureSetup(maker)");
  if (TAKER_ENABLED) {
    console.log("ensuring taker setup…");
    await retry(() => ensureSetupFor(taker, l1pT, mint, TAKER_CAPITAL), "ensureSetup(taker)");
  }
  console.log(`quoting every ${INTERVAL}ms · ${LEVELS} levels · ${SPREAD_BPS}bps step · base size ${SIZE}`);
  let busy = false;
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await quote(); } catch (e) { console.error("quote err:", (e as Error).message.slice(0, 80)); }
    finally { busy = false; }
  }, INTERVAL);

  if (TAKER_ENABLED) {
    console.log(`taker trading every ${TAKER_INTERVAL}ms`);
    let tbusy = false;
    setInterval(async () => {
      if (tbusy) return;
      tbusy = true;
      try { await takerTrade(); } catch (e) { console.error("taker err:", (e as Error).message.slice(0, 80)); }
      finally { tbusy = false; }
    }, TAKER_INTERVAL);
  }
})();
