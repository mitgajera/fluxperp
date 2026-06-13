// verify-conn.ts — proves the app connection layer against the live Asia ER:
// subscribes (price + orderbook) via app/lib, then pushes prices and resets the book
// and confirms the ws subscriptions deliver decoded updates in real time.
//
// Run: ANCHOR_WALLET=$HOME/.config/solana/id.json ts-node app/scripts/verify-conn.ts

import * as anchor from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { readFileSync } from "fs";
import { erConnection, subscribePriceFeed, subscribeOrderbook } from "../lib/er";
import {
  getProgram,
  orderbookPda,
  priceFeedPda,
  marketConfigPda,
  MARKET_SOL,
} from "../lib/program";
import { toUi } from "../lib/types";

const kp = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(process.env.ANCHOR_WALLET!, "utf8")))
);
const erConn = erConnection();
const program = getProgram(erConn, new anchor.Wallet(kp));

(async () => {
  let priceTicks = 0;
  let bookTicks = 0;

  const u1 = subscribePriceFeed(erConn, MARKET_SOL, (pf) => {
    priceTicks++;
    console.log(`  [price ws] #${priceTicks} mark=${toUi(pf.markPrice).toFixed(3)} index=${toUi(pf.indexPrice).toFixed(3)}`);
  });
  const u2 = subscribeOrderbook(erConn, MARKET_SOL, (ob) => {
    bookTicks++;
    console.log(`  [book ws]  #${bookTicks} bids=${ob.bids.length} asks=${ob.asks.length} lastTrade=${toUi(ob.lastTradePrice).toFixed(3)} seq=${ob.sequence.toString()}`);
  });

  await sleep(1500); // initial state callbacks

  console.log("pushing 4 prices...");
  for (let i = 0; i < 4; i++) {
    const px = 150 + i * 0.5;
    await program.methods
      .pushPrice(MARKET_SOL, new anchor.BN(Math.round(px * 1e6)), new anchor.BN(Math.round(px * 1e6)))
      .accountsStrict({ publisher: kp.publicKey, priceFeed: priceFeedPda(MARKET_SOL) })
      .rpc();
    await sleep(700);
  }

  console.log("resetting orderbook (book write)...");
  await program.methods
    .resetOrderbook(MARKET_SOL)
    .accountsStrict({
      authority: kp.publicKey,
      marketConfig: marketConfigPda(MARKET_SOL),
      orderbook: orderbookPda(MARKET_SOL),
    })
    .rpc();

  await sleep(2500);
  u1();
  u2();
  console.log(`\nprice ws ticks: ${priceTicks}, book ws ticks: ${bookTicks}`);
  const ok = priceTicks >= 4 && bookTicks >= 1;
  console.log(ok ? "CONNECTION LAYER OK" : "INSUFFICIENT UPDATES");
  process.exit(ok ? 0 : 1);
})();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
