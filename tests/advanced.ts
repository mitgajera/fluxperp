import * as anchor from "@coral-xyz/anchor";
import * as assert from "assert";
import {
  it, run, er, program, provider, wallet, MARKET_INDEX, DELEGATION_PROGRAM,
  marketConfig, orderbook, fillLog, priceFeed, riskEngine,
  collOf, posOf, ensureMarket, makeTrader, placeLimit, placeMarket, pushPrice, resetBook,
  LONG, SHORT,
} from "./shared";

const updateRisk = () =>
  er.methods.updateRisk(MARKET_INDEX).accountsStrict({ cranker: wallet.publicKey, priceFeed, riskEngine }).rpc();

const SIZE = 1_000_000;
const meta = (k: anchor.web3.PublicKey) => [
  { pubkey: posOf(k), isWritable: true, isSigner: false },
  { pubkey: collOf(k), isWritable: true, isSigner: false },
];

{
  let A: anchor.web3.Keypair, B: anchor.web3.Keypair, L: anchor.web3.Keypair;

  it("partial-liq setup: B long 1 @ 187.35, A bid @ 175 for close liquidity", async () => {
    const mint = await ensureMarket();
    A = await makeTrader(mint);
    B = await makeTrader(mint);
    L = await makeTrader(mint, 10);
    await placeLimit(A, SHORT, 187.35, SIZE);
    await placeMarket(B, LONG, SIZE, [A]);

    await placeLimit(A, LONG, 175, SIZE);
  });

  it("liquidate_partial closes the minimum to restore ~8% health", async () => {
    await pushPrice(175, 175);  // B health ~365 bps < 500

    await er.methods
      .liquidatePartial(MARKET_INDEX, B.publicKey)
      .accountsStrict({
        liquidator: L.publicKey,
        marketConfig, priceFeed, orderbook, fillLog,
        traderPosition: posOf(B.publicKey), traderCollateral: collOf(B.publicKey),
        liquidatorCollateral: collOf(L.publicKey),
      })
      .remainingAccounts(meta(A.publicKey))
      .signers([L])
      .rpc();

    const posB = await er.account.positionAccount.fetch(posOf(B.publicKey));
    const size = posB.size.toNumber();
    const m = posB.marginAllocated.toNumber();
    const entry = posB.entryPrice.toNumber();
    const mark = 175_000_000;
    const upnl = ((mark - entry) * size) / 1e6;
    const notional = (size * mark) / 1e6;
    const health = ((m + upnl) * 10000) / notional;
    console.log(`    B remaining size=${size} (was ${SIZE}), restored health=${Math.round(health)} bps`);
    assert.ok(size > 0 && size < SIZE, "B should be partially closed, not flat");
    assert.ok(health > 760 && health < 840, `health not ~800: ${Math.round(health)}`);
  });
}

{
  let A: anchor.web3.Keypair, B: anchor.web3.Keypair, D: anchor.web3.Keypair, L: anchor.web3.Keypair;

  it("ADL setup: B long 1 @ 187.35 (A short = winner), D bid @ 160 for the full close", async () => {
    const mint = await ensureMarket();
    A = await makeTrader(mint);

    B = await makeTrader(mint);

    D = await makeTrader(mint);

    L = await makeTrader(mint, 10);
    await placeLimit(A, SHORT, 187.35, SIZE);
    await placeMarket(B, LONG, SIZE, [A]);

    await placeLimit(D, LONG, 160, SIZE);
  });

  it("price crashes below bankruptcy -> full close (bad debt) -> ADL closes A at bankruptcy price", async () => {
    await pushPrice(160, 160);  // B bankruptcy = 187.35 - 18.735 = 168.615 > 160 -> bankrupt

    await er.methods
      .liquidatePartial(MARKET_INDEX, B.publicKey)
      .accountsStrict({
        liquidator: L.publicKey,
        marketConfig, priceFeed, orderbook, fillLog,
        traderPosition: posOf(B.publicKey), traderCollateral: collOf(B.publicKey),
        liquidatorCollateral: collOf(L.publicKey),
      })
      .remainingAccounts(meta(D.publicKey))
      .signers([L])
      .rpc();
    const posBfull = await er.account.positionAccount.fetch(posOf(B.publicKey));
    assert.deepStrictEqual(posBfull.side, { flat: {} }, "B should be fully closed (bankrupt)");

    const bankruptcy = 168_615_000;
    const aBefore = await er.account.collateralAccount.fetch(collOf(A.publicKey));
    await er.methods
      .autoDeleverage(MARKET_INDEX, 1, new anchor.BN(bankruptcy))
      .accountsStrict({ cranker: wallet.publicKey, marketConfig, priceFeed })
      .remainingAccounts(meta(A.publicKey))
      .rpc();

    const posA = await er.account.positionAccount.fetch(posOf(A.publicKey));
    const aAfter = await er.account.collateralAccount.fetch(collOf(A.publicKey));
    const realized = aAfter.realizedPnl.sub(aBefore.realizedPnl).toNumber();

    console.log(`    A closed by ADL: side=${JSON.stringify(posA.side)} settledPnL=${realized} (expect ~18735000 @ bankruptcy, not 27350000 @ mark)`);
    assert.deepStrictEqual(posA.side, { flat: {} }, "A should be closed by ADL");
    assert.ok(Math.abs(realized - 18_735_000) < 50_000, `ADL not settled at bankruptcy price: ${realized}`);
  });
}

{
  let T: anchor.web3.Keypair;

  it("A4 setup: init + delegate RiskEngine for market 0", async () => {
    const mint = await ensureMarket();
    if (!(await provider.connection.getAccountInfo(riskEngine))) {
      await program.methods
        .initializeRisk(MARKET_INDEX)
        .accountsStrict({ authority: wallet.publicKey, marketConfig, riskEngine, systemProgram: anchor.web3.SystemProgram.programId })
        .rpc();
    }
    const info = await provider.connection.getAccountInfo(riskEngine);
    if (info && info.owner.toBase58() !== DELEGATION_PROGRAM.toBase58()) {
      await program.methods.delegateRisk(MARKET_INDEX).accountsPartial({ payer: wallet.publicKey, riskEngine }).rpc();
    }
    T = await makeTrader(mint);  // 100 USDC
  });

  it("vol spike drops the leverage cap; the same high-leverage order is then rejected", async () => {
    await er.methods.resetRisk(MARKET_INDEX).accountsStrict({ authority: wallet.publicKey, marketConfig, riskEngine }).rpc();

    for (const _ of [0, 1, 2]) {
      await pushPrice(150, 150);
      await updateRisk();
    }
    let re: any = await er.account.riskEngine.fetch(riskEngine);
    console.log(`    calm: vol low, leverage_cap=${re.leverageCap}`);
    assert.ok(re.leverageCap >= 7, `calm cap should be high, got ${re.leverageCap}`);

    await resetBook();
    await placeLimit(T, SHORT, 150, 4_000_000, riskEngine);

    console.log(`    high-leverage order ACCEPTED at calm cap ✓`);

    await pushPrice(165, 165);
    await updateRisk();
    re = await er.account.riskEngine.fetch(riskEngine);
    console.log(`    spike: leverage_cap=${re.leverageCap} circuit_breaker=${re.circuitBreaker}`);
    assert.ok(re.leverageCap <= 5, `cap should drop after vol spike, got ${re.leverageCap}`);

    await resetBook();
    let rejected = false;
    let why = "";
    try {
      await placeLimit(T, SHORT, 165, 4_000_000, riskEngine);  // req @ 3x = 220 > 100 available
    } catch (e) {
      rejected = true;
      why = (e as Error).message.includes("InsufficientMargin") ? "InsufficientMargin (leverage cap)" : "rejected";
    }
    console.log(`    high-leverage order REJECTED after vol spike = ${rejected} (${why})`);
    assert.ok(rejected, "order should be rejected once the dynamic cap tightened");
  });
}

run();
