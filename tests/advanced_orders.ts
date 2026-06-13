import * as anchor from "@coral-xyz/anchor";
import * as assert from "assert";
import {
  it, run, er, program, provider, wallet, MARKET_INDEX, DELEGATION_PROGRAM,
  marketConfig, orderbook,
  collOf, advOf, ensureMarket, makeTrader, placeMarket, resetBook,
  SHORT, LONG,
} from "./shared";
import { SystemProgram } from "@solana/web3.js";

const ICEBERG = { iceberg: {} } as any;
const TWAP = { twap: {} } as any;
const GTT = { gtt: {} } as any;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function setupAdvanced(kp: anchor.web3.Keypair) {
  if (!(await provider.connection.getAccountInfo(advOf(kp.publicKey)))) {
    await program.methods
      .initializeAdvanced(MARKET_INDEX)
      .accountsStrict({ user: kp.publicKey, marketConfig, advanced: advOf(kp.publicKey), systemProgram: SystemProgram.programId })
      .signers([kp]).rpc();
  }
  const info = await provider.connection.getAccountInfo(advOf(kp.publicKey));
  if (info && info.owner.toBase58() !== DELEGATION_PROGRAM.toBase58()) {
    await program.methods.delegateAdvanced(MARKET_INDEX).accountsPartial({ payer: kp.publicKey, advanced: advOf(kp.publicKey) }).signers([kp]).rpc();
  }
}

const bookAsksOf = async (k: anchor.web3.PublicKey) =>
  (await er.account.orderbookState.fetch(orderbook)).asks.filter((o: any) => o.owner.equals(k));

const placeAdv = (kp: anchor.web3.Keypair, side: any, price: number, total: number, display: number, interval: number, expiry: number, kind: any) =>
  er.methods
    .placeAdvancedOrder(MARKET_INDEX, side, new anchor.BN(price * 1e6), new anchor.BN(total), new anchor.BN(display), new anchor.BN(interval), new anchor.BN(expiry), kind)
    .accountsStrict({ user: kp.publicKey, marketConfig, orderbook, advanced: advOf(kp.publicKey), collateral: collOf(kp.publicKey), riskEngine: null })
    .signers([kp]).rpc();

const crank = (kp: anchor.web3.PublicKey) =>
  er.methods.crankTwap(MARKET_INDEX, kp).accountsStrict({ cranker: wallet.publicKey, orderbook, advanced: advOf(kp) }).rpc();

{
  let T: anchor.web3.Keypair, B: anchor.web3.Keypair;
  it("iceberg setup", async () => {
    const mint = await ensureMarket();
    T = await makeTrader(mint);
    B = await makeTrader(mint);
    await setupAdvanced(T);
    await resetBook();
  });

  it("iceberg shows only display_size in the book while filling the full size", async () => {
    await placeAdv(T, SHORT, 190, 3_000_000, 1_000_000, 0, 0, ICEBERG);
    let asks = await bookAsksOf(T.publicKey);
    assert.strictEqual(asks.length, 1, "one resting slice");
    assert.strictEqual(asks[0].size.toString(), "1000000", "iceberg shows only display_size (1), not total (3)");

    await placeMarket(B, LONG, 1_000_000, [T]);
    asks = await bookAsksOf(T.publicKey);
    assert.strictEqual(asks.length, 0, "visible slice consumed");

    await crank(T.publicKey);
    asks = await bookAsksOf(T.publicKey);
    const adv = await er.account.advancedOrders.fetch(advOf(T.publicKey));
    console.log(`    after fill+crank: filled=${adv.orders[0].filled.toString()} new slice size=${asks[0]?.size.toString()}`);
    assert.strictEqual(asks.length, 1, "next slice revealed");
    assert.strictEqual(asks[0].size.toString(), "1000000", "still only display_size visible");
    assert.strictEqual(adv.orders[0].filled.toString(), "1000000", "filled tracked the consumed slice");
  });
}

{
  let T: anchor.web3.Keypair;
  it("twap setup", async () => {
    const mint = await ensureMarket();
    T = await makeTrader(mint);
    await setupAdvanced(T);
    await resetBook();
  });

  it("TWAP releases a fresh slice on schedule", async () => {
    await placeAdv(T, SHORT, 195, 3_000_000, 1_000_000, 2, 0, TWAP);  // 2s interval

    const before = (await er.account.advancedOrders.fetch(advOf(T.publicKey))).orders[0].restingOrderId.toString();
    await sleep(2500);
    await crank(T.publicKey);
    const after = (await er.account.advancedOrders.fetch(advOf(T.publicKey))).orders[0].restingOrderId.toString();
    console.log(`    TWAP slice id ${before} -> ${after} after interval`);
    assert.notStrictEqual(after, before, "a new slice should be released after the interval");
  });
}

{
  let T: anchor.web3.Keypair;
  it("gtt setup", async () => {
    const mint = await ensureMarket();
    T = await makeTrader(mint);
    await setupAdvanced(T);
    await resetBook();
  });

  it("GTT order is reaped after expiry", async () => {
    const expiry = Math.floor(Date.now() / 1000) + 1;  // expires in 1s

    await placeAdv(T, SHORT, 200, 1_000_000, 1_000_000, 0, expiry, GTT);
    assert.strictEqual((await bookAsksOf(T.publicKey)).length, 1, "GTT resting");
    await sleep(2500);
    await er.methods.reapExpired(MARKET_INDEX, T.publicKey).accountsStrict({ cranker: wallet.publicKey, orderbook, advanced: advOf(T.publicKey) }).rpc();
    const asks = await bookAsksOf(T.publicKey);
    const adv = await er.account.advancedOrders.fetch(advOf(T.publicKey));
    console.log(`    after reap: book asks=${asks.length}, adv orders=${adv.orders.length}`);
    assert.strictEqual(asks.length, 0, "GTT order removed from book");
    assert.strictEqual(adv.orders.length, 0, "GTT order removed from advanced list");
  });
}

run();
