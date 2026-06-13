import * as anchor from "@coral-xyz/anchor";
import * as assert from "assert";
import {
  it, run, er, program, wallet, MARKET_INDEX,
  marketConfig, orderbook, priceFeed,
  collOf, posOf, ensureMarket, makeTrader, placeLimit, placeMarket, pushPrice,
  LONG, SHORT,
} from "./shared";

const SIZE = 1_000_000;
let A: anchor.web3.Keypair, B: anchor.web3.Keypair;

it("setup: A short 1, B long 1 @ 187.35", async () => {
  const mint = await ensureMarket();
  A = await makeTrader(mint);
  B = await makeTrader(mint);
  await placeLimit(A, SHORT, 187.35, SIZE);

  await placeMarket(B, LONG, SIZE, [A]);
});

it("apply_funding moves margin long(B) -> short(A)", async () => {
  const now = Math.floor(Date.now() / 1000);
  await er.methods
    .setFundingTs(MARKET_INDEX, new anchor.BN(now - 3601))
    .accountsStrict({ authority: wallet.publicKey, marketConfig, orderbook })
    .rpc();

  await pushPrice(200, 185);

  const before = {
    A: (await er.account.collateralAccount.fetch(collOf(A.publicKey))).availableMargin,
    B: (await er.account.collateralAccount.fetch(collOf(B.publicKey))).availableMargin,
  };

  await er.methods
    .applyFunding(MARKET_INDEX)
    .accountsStrict({ cranker: wallet.publicKey, priceFeed, orderbook })
    .remainingAccounts([
      { pubkey: posOf(A.publicKey), isWritable: true, isSigner: false },
      { pubkey: collOf(A.publicKey), isWritable: true, isSigner: false },
      { pubkey: posOf(B.publicKey), isWritable: true, isSigner: false },
      { pubkey: collOf(B.publicKey), isWritable: true, isSigner: false },
    ])
    .rpc();

  const rateBps = Math.trunc(((200 - 185) * 100) / 185);
  const flow = Math.trunc((200_000_000 * rateBps) / 10000);

  const after = {
    A: (await er.account.collateralAccount.fetch(collOf(A.publicKey))).availableMargin,
    B: (await er.account.collateralAccount.fetch(collOf(B.publicKey))).availableMargin,
  };

  const dA = after.A.sub(before.A).toNumber();
  const dB = after.B.sub(before.B).toNumber();
  console.log(`    rate=${rateBps}bps flow=${flow}  A(short) +${dA}  B(long) ${dB}`);
  assert.strictEqual(dB, -flow, "long should pay funding");
  assert.strictEqual(dA, flow, "short should receive funding");
  assert.ok(flow > 0, "flow must be positive");
});

run();
