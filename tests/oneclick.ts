import * as anchor from "@coral-xyz/anchor";
import * as assert from "assert";
import {
  it, run, er, MARKET_INDEX, marketConfig, orderbook, fillLog,
  posOf, collOf, makerMetas, ensureMarket, makeTrader, placeLimit, placeMarket, resetBook,
  LONG, SHORT,
} from "./shared";
import { Keypair } from "@solana/web3.js";

const reverse = (T: Keypair, makers: Keypair[]) =>
  er.methods.reversePosition(MARKET_INDEX)
    .accountsStrict({ taker: T.publicKey, marketConfig, orderbook, fillLog, takerPosition: posOf(T.publicKey), takerCollateral: collOf(T.publicKey) })
    .remainingAccounts(makerMetas(makers)).signers([T]).rpc();

const scale = (T: Keypair, pct: number, increase: boolean, makers: Keypair[]) =>
  er.methods.scaleInOut(MARKET_INDEX, pct, increase)
    .accountsStrict({ taker: T.publicKey, marketConfig, orderbook, fillLog, takerPosition: posOf(T.publicKey), takerCollateral: collOf(T.publicKey) })
    .remainingAccounts(makerMetas(makers)).signers([T]).rpc();

const sideOf = (p: any) => ("long" in p.side ? "long" : "short" in p.side ? "short" : "flat");
const posOfT = (T: Keypair) => er.account.positionAccount.fetch(posOf(T.publicKey));

{
  let T: Keypair, M: Keypair;

  it("one-click setup: a long position with two-sided maker liquidity", async () => {
    const mint = await ensureMarket();
    T = await makeTrader(mint);
    M = await makeTrader(mint);
    await resetBook();

    await placeLimit(M, SHORT, 100, 1_000_000);
    await placeMarket(T, LONG, 1_000_000, [M]);
    const p = await posOfT(T);
    assert.strictEqual(sideOf(p), "long");
    assert.strictEqual(p.size.toString(), "1000000");
  });

  it("reverse_position flips long → short in one transaction", async () => {
    await placeLimit(M, LONG, 99, 2_000_000);
    await reverse(T, [M]);
    const p = await posOfT(T);
    console.log(`    after reverse: ${sideOf(p)} ${p.size.toString()}`);
    assert.strictEqual(sideOf(p), "short", "long flipped to short");
    assert.strictEqual(p.size.toString(), "1000000", "same size, opposite side");
  });

  it("scale_out reduces the position by a percentage at market", async () => {
    await placeLimit(M, SHORT, 101, 1_000_000);
    await scale(T, 50, false, [M]);
    const p = await posOfT(T);
    console.log(`    after scale −50%: ${sideOf(p)} ${p.size.toString()}`);
    assert.strictEqual(sideOf(p), "short", "still short");
    assert.strictEqual(p.size.toString(), "500000", "reduced to half");
  });

  it("scale_in adds a percentage to the position at market", async () => {
    await placeLimit(M, LONG, 99, 1_000_000);
    await scale(T, 100, true, [M]);
    const p = await posOfT(T);
    console.log(`    after scale +100%: ${sideOf(p)} ${p.size.toString()}`);
    assert.strictEqual(sideOf(p), "short", "still short");
    assert.strictEqual(p.size.toString(), "1000000", "doubled the 0.5 back to 1.0");
  });
}

run();
