import * as anchor from "@coral-xyz/anchor";
import * as assert from "assert";
import {
  it, run, er, wallet, MARKET_INDEX,
  marketConfig, orderbook, fillLog, priceFeed,
  collOf, posOf, trigOf, ensureMarket, makeTrader, placeLimit, placeMarket, pushPrice,
  LONG, SHORT, SL,
} from "./shared";
import { toFixed6 } from "../scripts/price-publisher";

const SIZE = 1_000_000;
let A: anchor.web3.Keypair, B: anchor.web3.Keypair;

it("setup: B long 1 @ 187.35, places a stop-loss @ 180, A rests a bid @ 178", async () => {
  const mint = await ensureMarket();
  A = await makeTrader(mint);
  B = await makeTrader(mint);
  await placeLimit(A, SHORT, 187.35, SIZE);

  await placeMarket(B, LONG, SIZE, [A]);  // B long 1

  await er.methods
    .placeTrigger(MARKET_INDEX, SL, toFixed6(180), new anchor.BN(SIZE), SHORT)
    .accountsStrict({ user: B.publicKey, triggers: trigOf(B.publicKey) })
    .signers([B])
    .rpc();
  await placeLimit(A, LONG, 178, SIZE);

  const trig = await er.account.triggerOrders.fetch(trigOf(B.publicKey));
  assert.strictEqual(trig.triggers.length, 1, "trigger should be placed");
});

it("price crosses 180 down to 175 -> crank fires the stop-loss", async () => {
  await pushPrice(175, 175);  // 175 <= 180 => crossed

  await er.methods
    .crankTriggers(MARKET_INDEX, B.publicKey)
    .accountsStrict({
      cranker: wallet.publicKey,
      marketConfig,
      priceFeed,
      orderbook,
      fillLog,
      traderTriggers: trigOf(B.publicKey),
      traderPosition: posOf(B.publicKey),
      traderCollateral: collOf(B.publicKey),
    })
    .remainingAccounts([
      { pubkey: posOf(A.publicKey), isWritable: true, isSigner: false },
      { pubkey: collOf(A.publicKey), isWritable: true, isSigner: false },
    ])
    .rpc();

  const trig = await er.account.triggerOrders.fetch(trigOf(B.publicKey));
  const posB = await er.account.positionAccount.fetch(posOf(B.publicKey));
  console.log(`    triggers remaining: ${trig.triggers.length}  B side: ${JSON.stringify(posB.side)} size ${posB.size.toString()}`);
  assert.strictEqual(trig.triggers.length, 0, "fired trigger should be removed");
  assert.deepStrictEqual(posB.side, { flat: {} }, "B should be flat after stop-loss");
});

run();
