// verify-actions.ts — proves the /trade UI's action layer (lib/trade-actions) against
// devnet + the Asia ER: place (auto-commit + measured latency), cancel, and close —
// exactly the code paths the OrderForm / PositionPanel buttons call.
//
// Run: ANCHOR_WALLET=$HOME/.config/solana/id.json ts-node app/scripts/verify-actions.ts

import * as anchor from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
  mintTo,
} from "@solana/spl-token";
import { readFileSync } from "fs";
import { getProgram, vaultPda, collateralPda, positionPda, triggersPda, marketConfigPda, orderbookPda, fillLogPda } from "../lib/program";
import { erConnection, l1Connection } from "../lib/er";
import { sessionWallet } from "../lib/session";
import * as actions from "../lib/trade-actions";
import type { OrderbookState } from "../lib/types";

const MARKET = 0;
const TOKEN = anchor.utils.token.TOKEN_PROGRAM_ID;
const main = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.ANCHOR_WALLET!, "utf8"))));
const l1 = l1Connection();
const er = erConnection();
const l1Main = getProgram(l1, sessionWallet(main));
const erMain = getProgram(er, sessionWallet(main));

async function setupTrader(mint: PublicKey): Promise<Keypair> {
  const kp = Keypair.generate();
  const dep = new anchor.BN(100_000_000);
  await l1.confirmTransaction(
    await l1.sendTransaction(
      new Transaction().add(SystemProgram.transfer({ fromPubkey: main.publicKey, toPubkey: kp.publicKey, lamports: 0.15 * LAMPORTS_PER_SOL })),
      [main]
    ),
    "confirmed"
  );
  const ata = getAssociatedTokenAddressSync(mint, kp.publicKey);
  await l1.confirmTransaction(
    await l1.sendTransaction(new Transaction().add(createAssociatedTokenAccountIdempotentInstruction(main.publicKey, ata, kp.publicKey, mint)), [main]),
    "confirmed"
  );
  await mintTo(l1, main, mint, ata, main, dep.toNumber());

  const l1kp = getProgram(l1, sessionWallet(kp));
  await l1kp.methods.initializeCollateral().accountsStrict({ user: kp.publicKey, collateral: collateralPda(kp.publicKey), systemProgram: SystemProgram.programId }).rpc();
  await l1kp.methods.depositCollateral(dep).accountsStrict({ user: kp.publicKey, collateral: collateralPda(kp.publicKey), userTokenAccount: ata, vault: vaultPda(), tokenProgram: TOKEN }).rpc();
  await l1kp.methods.initializePosition(MARKET).accountsStrict({ user: kp.publicKey, marketConfig: marketConfigPda(MARKET), position: positionPda(kp.publicKey, MARKET), systemProgram: SystemProgram.programId }).rpc();
  await l1kp.methods.initializeTriggers(MARKET).accountsStrict({ user: kp.publicKey, marketConfig: marketConfigPda(MARKET), triggers: triggersPda(kp.publicKey, MARKET), systemProgram: SystemProgram.programId }).rpc();
  await l1kp.methods.delegateCollateral().accountsPartial({ payer: kp.publicKey, collateral: collateralPda(kp.publicKey) }).rpc();
  await l1kp.methods.delegatePosition(MARKET).accountsPartial({ payer: kp.publicKey, position: positionPda(kp.publicKey, MARKET) }).rpc();
  await l1kp.methods.delegateTriggers(MARKET).accountsPartial({ payer: kp.publicKey, triggers: triggersPda(kp.publicKey, MARKET) }).rpc();
  return kp;
}

const book = () => erMain.account.orderbookState.fetch(orderbookPda(MARKET)) as unknown as Promise<OrderbookState>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const mint = (await getAccount(l1, vaultPda())).mint;
  console.log("setting up two traders (A maker, B taker)…");
  const A = await setupTrader(mint);
  const B = await setupTrader(mint);
  const erA = getProgram(er, sessionWallet(A));
  const erB = getProgram(er, sessionWallet(B));

  await erMain.methods.resetOrderbook(MARKET).accountsStrict({ authority: main.publicKey, marketConfig: marketConfigPda(MARKET), orderbook: orderbookPda(MARKET) }).rpc();

  // maker liquidity is placed WITHOUT commit (ER-only resting order). Only the taker's
  // (B's) actions auto-commit — that's the UI path the checkpoint cares about.
  const restMaker = (price: number, side: "long" | "short") =>
    erA.methods
      .placeOrder(MARKET, side === "long" ? { long: {} } : { short: {} }, new anchor.BN(Math.round(price * 1e6)), new anchor.BN(1_000_000), { limit: {} })
      .accountsStrict({ taker: A.publicKey, marketConfig: marketConfigPda(MARKET), orderbook: orderbookPda(MARKET), fillLog: fillLogPda(MARKET), takerPosition: positionPda(A.publicKey, MARKET), takerCollateral: collateralPda(A.publicKey), riskEngine: null, marginProfile: null })
      .rpc();

  // 1) maker rests an ask @ 187.35 (ER)
  await restMaker(187.35, "short");
  let ob = await book();
  const aAsk = ob.asks.find((o) => o.owner.equals(A.publicKey));
  console.log(`  resting maker ask @ ${(aAsk!.price.toNumber() / 1e6).toFixed(2)} ✓`);

  // 2) PLACE (market) — B buys 1 with auto-commit + measured latency (fill toast)
  const r = await actions.placeOrder(erB, B.publicKey, { market: MARKET, side: "long", type: "market", price: 0, size: 1 }, await book());
  const posB = await erB.account.positionAccount.fetch(positionPda(B.publicKey, MARKET));
  console.log(`  PLACE (market) auto-commit: B ${JSON.stringify(posB.side)} ${posB.size.toNumber() / 1e6} @ ${(posB.entryPrice.toNumber() / 1e6).toFixed(2)} — filled in ${r.ms}ms ⚡`);

  // 3) CLOSE — maker rests a bid @ 180, B closes its long into it (auto-commit)
  await sleep(1200);
  await restMaker(180, "long");
  await sleep(1200);
  const mark = 180 * 1e6;
  const rc = await actions.closePosition(erB, B.publicKey, MARKET, "short", Math.round((posB.size.toNumber() * mark) / 1e6), await book());
  const posBafter = await erB.account.positionAccount.fetch(positionPda(B.publicKey, MARKET));
  console.log(`  CLOSE auto-commit: B now ${JSON.stringify(posBafter.side)} — closed in ${rc.ms}ms`);

  // 4) CANCEL — B rests an order, then cancels it (ER-only)
  await sleep(1200);
  await erB.methods
    .placeOrder(MARKET, { short: {} }, new anchor.BN(200_000_000), new anchor.BN(1_000_000), { limit: {} })
    .accountsStrict({ taker: B.publicKey, marketConfig: marketConfigPda(MARKET), orderbook: orderbookPda(MARKET), fillLog: fillLogPda(MARKET), takerPosition: positionPda(B.publicKey, MARKET), takerCollateral: collateralPda(B.publicKey), riskEngine: null, marginProfile: null })
    .rpc();
  ob = await book();
  const toCancel = ob.asks.find((o) => o.owner.equals(B.publicKey) && o.price.toNumber() === 200_000_000)!;
  await actions.cancelOrder(erB, B.publicKey, MARKET, toCancel.orderId);
  ob = await book();
  const gone = !ob.asks.find((o) => o.orderId.eq(toCancel.orderId));
  console.log(`  CANCEL: B's 200 order removed = ${gone} ✓`);

  const ok = posB.size.toNumber() > 0 && "flat" in (posBafter.side as any) && gone;
  console.log(ok ? "\nUI ACTIONS OK (place · market-fill+latency · close · cancel)" : "\nFAILED");
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error("ERR:", (e as Error).message);
  process.exit(1);
});
