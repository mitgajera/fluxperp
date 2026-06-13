import * as anchor from "@coral-xyz/anchor";
import * as assert from "assert";
import {
  it, run, er, wallet, MARKET_INDEX,
  marketConfig, orderbook, fillLog, priceFeed,
  collOf, posOf, ensureMarket, makeTrader, placeLimit, placeMarket, pushPrice,
  LONG, SHORT,
} from "./shared";

const SIZE = 1_000_000;
let A: anchor.web3.Keypair, B: anchor.web3.Keypair, L: anchor.web3.Keypair;

it("setup: B long 1 @ 187.35, A rests a bid @ 175 for close liquidity", async () => {
  const mint = await ensureMarket();
  A = await makeTrader(mint);
  B = await makeTrader(mint);
  L = await makeTrader(mint, 10);

  await placeLimit(A, SHORT, 187.35, SIZE);

  await placeMarket(B, LONG, SIZE, [A]);

  await placeLimit(A, LONG, 175, SIZE);
});

it("price drops to 175 -> B is liquidatable -> liquidator earns the bounty", async () => {
  await pushPrice(175, 175);

  const lBefore = (await er.account.collateralAccount.fetch(collOf(L.publicKey))).availableMargin;

  await er.methods
    .liquidate(MARKET_INDEX, B.publicKey)
    .accountsStrict({
      liquidator: L.publicKey,
      marketConfig,
      priceFeed,
      orderbook,
      fillLog,
      traderPosition: posOf(B.publicKey),
      traderCollateral: collOf(B.publicKey),
      liquidatorCollateral: collOf(L.publicKey),
    })
    .remainingAccounts([
      { pubkey: posOf(A.publicKey), isWritable: true, isSigner: false },
      { pubkey: collOf(A.publicKey), isWritable: true, isSigner: false },
    ])
    .signers([L])
    .rpc();

  const expectedBounty = Math.trunc((175_000_000 * 100) / 10000 / 2);  // 875000

  const posB = await er.account.positionAccount.fetch(posOf(B.publicKey));
  const lAfter = (await er.account.collateralAccount.fetch(collOf(L.publicKey))).availableMargin;
  const dBounty = lAfter.sub(lBefore).toNumber();

  console.log(`    B position side: ${JSON.stringify(posB.side)} size ${posB.size.toString()}`);
  console.log(`    liquidator bounty: +${dBounty} (expected ${expectedBounty})`);
  assert.deepStrictEqual(posB.side, { flat: {} }, "B should be flat after liquidation");
  assert.strictEqual(posB.size.toString(), "0");
  assert.strictEqual(dBounty, expectedBounty, "liquidator bounty mismatch");
});

run();
