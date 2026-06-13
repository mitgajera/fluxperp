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

function loadMaker(): Keypair {
  const path = join(__dirname, ".maker.json");
  if (existsSync(path)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
  const kp = Keypair.generate();
  writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

const l1 = new Connection(L1_RPC, "confirmed");
const erConn = new Connection(ER_RPC, { wsEndpoint: ER_WS, commitment: "confirmed" });
const maker = loadMaker();
const l1p = new Program<Fluxperp>(idl as Fluxperp, new anchor.AnchorProvider(l1, wallet(maker), { commitment: "confirmed" }));
const erp = new Program<Fluxperp>(idl as Fluxperp, new anchor.AnchorProvider(erConn, wallet(maker), { commitment: "confirmed" }));

async function isDelegated(a: PublicKey) {
  const i = await l1.getAccountInfo(a);
  return !!i && i.owner.equals(DELEG);
}

async function ensureSetup(mint: PublicKey) {
  if ((await l1.getBalance(maker.publicKey)) < 0.05 * LAMPORTS_PER_SOL) {
    await l1.confirmTransaction(await l1.sendTransaction(new Transaction().add(SystemProgram.transfer({ fromPubkey: main.publicKey, toPubkey: maker.publicKey, lamports: 0.2 * LAMPORTS_PER_SOL })), [main]), "confirmed");
  }
  const ata = getAssociatedTokenAddressSync(mint, maker.publicKey);
  if (!(await l1.getAccountInfo(ata))) {
    await l1.confirmTransaction(await l1.sendTransaction(new Transaction().add(createAssociatedTokenAccountIdempotentInstruction(main.publicKey, ata, maker.publicKey, mint)), [main]), "confirmed");
    await mintTo(l1, main, mint, ata, main, 100_000_000_000);
  }
  if (!(await l1.getAccountInfo(collOf(maker.publicKey)))) {
    await l1p.methods.initializeCollateral().accountsStrict({ user: maker.publicKey, collateral: collOf(maker.publicKey), systemProgram: SystemProgram.programId }).rpc();
    await l1p.methods.depositCollateral(new anchor.BN(100_000_000_000)).accountsStrict({ user: maker.publicKey, collateral: collOf(maker.publicKey), userTokenAccount: ata, vault, tokenProgram: TOKEN }).rpc();
  }
  if (!(await l1.getAccountInfo(posOf(maker.publicKey)))) await l1p.methods.initializePosition(MARKET).accountsStrict({ user: maker.publicKey, marketConfig, position: posOf(maker.publicKey), systemProgram: SystemProgram.programId }).rpc();
  if (!(await l1.getAccountInfo(trigOf(maker.publicKey)))) await l1p.methods.initializeTriggers(MARKET).accountsStrict({ user: maker.publicKey, marketConfig, triggers: trigOf(maker.publicKey), systemProgram: SystemProgram.programId }).rpc();
  if (!(await isDelegated(collOf(maker.publicKey)))) await l1p.methods.delegateCollateral().accountsPartial({ payer: maker.publicKey, collateral: collOf(maker.publicKey) }).rpc();
  if (!(await isDelegated(posOf(maker.publicKey)))) await l1p.methods.delegatePosition(MARKET).accountsPartial({ payer: maker.publicKey, position: posOf(maker.publicKey) }).rpc();
}

const f6 = (n: number) => new anchor.BN(Math.round(n * 1e6));
const align = (n: number) => Math.round((n * 1e6) / TICK) * TICK;  // tick-aligned (1e6 units)

async function placeLimit(side: "long" | "short", price1e6: number) {
  await erp.methods
    .placeOrder(MARKET, side === "long" ? { long: {} } : { short: {} }, new anchor.BN(price1e6), f6(SIZE), { limit: {} })
    .accountsStrict({ taker: maker.publicKey, marketConfig, orderbook, fillLog, takerPosition: posOf(maker.publicKey), takerCollateral: collOf(maker.publicKey), riskEngine: null, marginProfile: null })
    .rpc();
}

async function cancelMine() {
  const ob: any = await erp.account.orderbookState.fetch(orderbook);
  const mine = [...ob.bids, ...ob.asks].filter((o: any) => o.owner.equals(maker.publicKey));
  for (const o of mine) {
    try {
      await erp.methods.cancelOrder(MARKET, o.orderId).accountsStrict({ owner: maker.publicKey, orderbook }).rpc();
    } catch {}
  }
}

async function quote() {
  const pf: any = await erp.account.priceFeed.fetch(priceFeed);
  let mark = pf.markPrice.toNumber();
  if (mark === 0) mark = 187_350_000;

  mark = Math.round(mark * (1 + (Math.random() - 0.5) * 0.0006));

  await cancelMine();
  for (let i = 1; i <= LEVELS; i++) {
    const off = (mark * SPREAD_BPS * i) / 10000;
    const bid = align((mark - off) / 1e6);
    const ask = align((mark + off) / 1e6);
    try { await placeLimit("long", bid); } catch (e) {  }
    try { await placeLimit("short", ask); } catch (e) {}
  }
  console.log(`  quoted ${LEVELS}×2 around ${(mark / 1e6).toFixed(3)}`);
}

(async () => {
  const mint = (await getAccount(l1, vault)).mint;
  console.log(`market-maker: maker=${maker.publicKey.toBase58().slice(0, 8)} mint=${mint.toBase58().slice(0, 8)}`);
  console.log("ensuring maker setup (fund/deposit/delegate)…");
  await ensureSetup(mint);
  console.log(`quoting every ${INTERVAL}ms · ${LEVELS} levels · ${SPREAD_BPS}bps step`);
  let busy = false;
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await quote(); } catch (e) { console.error("quote err:", (e as Error).message.slice(0, 80)); }
    finally { busy = false; }
  }, INTERVAL);
})();
