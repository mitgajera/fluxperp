import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fluxperp } from "../target/types/fluxperp";
import idl from "../target/idl/fluxperp.json";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  mintTo,
} from "@solana/spl-token";
import * as assert from "assert";
import { erProgram } from "../scripts/price-publisher";

const DELEGATION_PROGRAM = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const MARKET_INDEX = 0;
const DECIMALS = 6;
const DEPOSIT = new anchor.BN(100_000_000);  // 100 USDC

const PRICE = new anchor.BN(187_350_000);  // 187.35

const SIZE = new anchor.BN(1_000_000);  // 1.0

const NOTIONAL = 187_350_000;
const MARGIN = 18_735_000;
const TAKER_FEE = 93_675;
const MAKER_REBATE = 37_470;

const tests: { name: string; fn: () => Promise<void> }[] = [];
const it = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
async function run() {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
    } catch (e) {
      failed++;
      const err = e as any;
      console.error(`  ✗ ${t.name}\n     ${err.message || String(e)}`);
      if (err.logs) console.error("     logs:", JSON.stringify(err.logs).slice(0, 800));
      if (err.error) console.error("     anchorError:", JSON.stringify(err.error).slice(0, 400));
    }
  }
  console.log(failed === 0 ? "\nAll steps passed." : `\n${failed} step(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = new Program<Fluxperp>(idl as Fluxperp, provider);  // L1 (Helius)

const er = erProgram(new anchor.Wallet((provider.wallet as anchor.Wallet).payer));

const wallet = (provider.wallet as anchor.Wallet).payer;

const enc = new TextEncoder();
const mi = Buffer.from([MARKET_INDEX]);
const pda = (s: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(s, program.programId)[0];

const marketConfig = pda([enc.encode("market"), mi]);
const orderbook = pda([enc.encode("orderbook"), mi]);
const fillLog = pda([enc.encode("fill_log"), mi]);
const priceFeed = pda([enc.encode("price"), mi]);
const vault = pda([enc.encode("vault")]);
const insuranceFund = pda([enc.encode("insurance")]);

const INSURANCE_DELTA = new anchor.BN((NOTIONAL * 2) / 10000);  // 2 bps = 37470

const PROTOCOL_DELTA = new anchor.BN((NOTIONAL * 1) / 10000);  // 1 bp = 18735

let mint: PublicKey;
const A = Keypair.generate();
const B = Keypair.generate();
const collOf = (k: PublicKey) => pda([enc.encode("collateral"), k.toBuffer()]);
const posOf = (k: PublicKey) => pda([enc.encode("position"), k.toBuffer(), mi]);

async function isDelegated(addr: PublicKey): Promise<boolean> {
  const info = await provider.connection.getAccountInfo(addr);
  return !!info && info.owner.toBase58() === DELEGATION_PROGRAM.toBase58();
}

async function setupTrader(kp: Keypair) {
  await provider.sendAndConfirm(
    new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: kp.publicKey,
        lamports: 0.12 * LAMPORTS_PER_SOL,
      })
    ),
    []
  );

  const ata = getAssociatedTokenAddressSync(mint, kp.publicKey);
  await provider.sendAndConfirm(
    new anchor.web3.Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, ata, kp.publicKey, mint)
    ),
    []
  );
  await mintTo(provider.connection, wallet, mint, ata, wallet, DEPOSIT.toNumber());

  await program.methods
    .initializeCollateral()
    .accountsStrict({ user: kp.publicKey, collateral: collOf(kp.publicKey), systemProgram: SystemProgram.programId })
    .signers([kp])
    .rpc();
  await program.methods
    .depositCollateral(DEPOSIT)
    .accountsStrict({
      user: kp.publicKey,
      collateral: collOf(kp.publicKey),
      userTokenAccount: ata,
      vault,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    })
    .signers([kp])
    .rpc();

  await program.methods
    .initializePosition(MARKET_INDEX)
    .accountsStrict({
      user: kp.publicKey,
      marketConfig,
      position: posOf(kp.publicKey),
      systemProgram: SystemProgram.programId,
    })
    .signers([kp])
    .rpc();

  await program.methods
    .delegateCollateral()
    .accountsPartial({ payer: kp.publicKey, collateral: collOf(kp.publicKey) })
    .signers([kp])
    .rpc();
  await program.methods
    .delegatePosition(MARKET_INDEX)
    .accountsPartial({ payer: kp.publicKey, position: posOf(kp.publicKey) })
    .signers([kp])
    .rpc();
}

it("ensures market 0 + resolves mint + delegates orderbook/fill_log once", async () => {
  const existing = await provider.connection.getAccountInfo(marketConfig);
  if (!existing) {
    mint = await createMint(provider.connection, wallet, wallet.publicKey, null, DECIMALS);
    await program.methods
      .initializeMarket(MARKET_INDEX, "SOL-PERP", new anchor.BN(1000), new anchor.BN(1000), 10)
      .accountsStrict({
        authority: wallet.publicKey,
        marketConfig,
        orderbook,
        fillLog,
        priceFeed: pda([enc.encode("price"), mi]),
        collateralMint: mint,
        vault,
        insuranceFund,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  } else {
    const { mint: m } = await import("@solana/spl-token").then((t) =>
      t.getAccount(provider.connection, vault)
    );
    mint = m;
  }

  if (!(await isDelegated(orderbook))) {
    await program.methods
      .delegateOrderbook(MARKET_INDEX)
      .accountsPartial({ payer: wallet.publicKey, orderbook })
      .rpc();
  }
  if (!(await isDelegated(fillLog))) {
    await program.methods
      .delegateFillLog(MARKET_INDEX)
      .accountsPartial({ payer: wallet.publicKey, fillLog })
      .rpc();
  }
  if (!(await isDelegated(priceFeed))) {
    await program.methods
      .delegatePriceFeed(MARKET_INDEX)
      .accountsPartial({ payer: wallet.publicKey, priceFeed })
      .rpc();
  }

  await er.methods
    .resetOrderbook(MARKET_INDEX)
    .accountsStrict({ authority: wallet.publicKey, marketConfig, orderbook })
    .rpc();

  console.log(`    mint=${mint.toBase58()}  orderbook+fill_log+price_feed delegated, book reset`);
});

it("sets up two traders (deposit 100 + delegate)", async () => {
  await setupTrader(A);
  await setupTrader(B);
  console.log(`    A=${A.publicKey.toBase58().slice(0, 8)}  B=${B.publicKey.toBase58().slice(0, 8)}`);
});

it("Wallet A limit-sells 1 @ 187.35 (rests on the ER book)", async () => {
  await er.methods
    .placeOrder(MARKET_INDEX, { short: {} }, PRICE, SIZE, { limit: {} })
    .accountsStrict({
      taker: A.publicKey,
      marketConfig,
      orderbook,
      fillLog,
      takerPosition: posOf(A.publicKey),
      takerCollateral: collOf(A.publicKey),
      riskEngine: null,
    })
    .signers([A])
    .rpc();

  const ob = await er.account.orderbookState.fetch(orderbook);
  const myAsk = ob.asks.find((o: any) => o.owner.toBase58() === A.publicKey.toBase58());
  assert.ok(myAsk, "A's ask not resting on the book");
  assert.strictEqual(myAsk.price.toString(), PRICE.toString());
  assert.strictEqual(myAsk.size.toString(), SIZE.toString());
  console.log(`    book asks: ${ob.asks.length}, A ask @ ${myAsk.price.toString()}`);
});

let insuranceBefore = new anchor.BN(0);

it("Wallet B market-buys 1 + commit_state in ONE tx (auto-commit)", async () => {
  const infoBefore = await provider.connection.getAccountInfo(insuranceFund);
  insuranceBefore = infoBefore
    ? (await program.account.insuranceFund.fetch(insuranceFund)).balance
    : new anchor.BN(0);

  const placeIx = await er.methods
    .placeOrder(MARKET_INDEX, { long: {} }, new anchor.BN(0), SIZE, { market: {} })
    .accountsStrict({
      taker: B.publicKey,
      marketConfig,
      orderbook,
      fillLog,
      takerPosition: posOf(B.publicKey),
      takerCollateral: collOf(B.publicKey),
      riskEngine: null,
    })
    .remainingAccounts([
      { pubkey: posOf(A.publicKey), isWritable: true, isSigner: false },
      { pubkey: collOf(A.publicKey), isWritable: true, isSigner: false },
    ])
    .instruction();

  const commitIx = await er.methods
    .commitState(MARKET_INDEX, INSURANCE_DELTA, PROTOCOL_DELTA)
    .accountsPartial({
      payer: B.publicKey,
      insuranceFund,
    })
    .remainingAccounts([
      { pubkey: posOf(B.publicKey), isWritable: true, isSigner: false },
      { pubkey: collOf(B.publicKey), isWritable: true, isSigner: false },
      { pubkey: posOf(A.publicKey), isWritable: true, isSigner: false },
      { pubkey: collOf(A.publicKey), isWritable: true, isSigner: false },
    ])
    .instruction();

  const erConn = er.provider.connection;
  const tx = new anchor.web3.Transaction().add(placeIx, commitIx);
  tx.feePayer = B.publicKey;
  tx.recentBlockhash = (await erConn.getLatestBlockhash()).blockhash;
  tx.sign(B);
  const sig = await erConn.sendRawTransaction(tx.serialize());
  await erConn.confirmTransaction(sig, "confirmed");
  console.log(`    auto-commit tx (ER): ${sig}`);

  const [posA, posB, collA, collB, ob, fl] = await Promise.all([
    er.account.positionAccount.fetch(posOf(A.publicKey)),
    er.account.positionAccount.fetch(posOf(B.publicKey)),
    er.account.collateralAccount.fetch(collOf(A.publicKey)),
    er.account.collateralAccount.fetch(collOf(B.publicKey)),
    er.account.orderbookState.fetch(orderbook),
    er.account.fillLog.fetch(fillLog),
  ]);

  assert.deepStrictEqual(posB.side, { long: {} }, "B should be Long");
  assert.deepStrictEqual(posA.side, { short: {} }, "A should be Short");
  assert.strictEqual(posB.size.toString(), SIZE.toString());
  assert.strictEqual(posA.size.toString(), SIZE.toString());
  assert.strictEqual(posB.entryPrice.toString(), PRICE.toString());
  assert.strictEqual(posA.entryPrice.toString(), PRICE.toString());
  assert.strictEqual(posB.marginAllocated.toString(), String(MARGIN));
  assert.strictEqual(posA.marginAllocated.toString(), String(MARGIN));

  assert.strictEqual(collB.feesPaid.toString(), String(TAKER_FEE));
  assert.strictEqual(collA.feesPaid.toString(), String(-MAKER_REBATE));
  assert.strictEqual(collB.availableMargin.toString(), String(100_000_000 - MARGIN - TAKER_FEE));
  assert.strictEqual(collA.availableMargin.toString(), String(100_000_000 - MARGIN + MAKER_REBATE));
  assert.strictEqual(collB.marginUsed.toString(), String(MARGIN));
  assert.strictEqual(collA.marginUsed.toString(), String(MARGIN));

  assert.ok(!ob.asks.find((o: any) => o.owner.toBase58() === A.publicKey.toBase58()), "A ask should be gone");
  assert.strictEqual(ob.lastTradePrice.toString(), PRICE.toString());

  const fill = (fl.fills as any[]).find(
    (f) => f.taker.toBase58() === B.publicKey.toBase58() && f.maker.toBase58() === A.publicKey.toBase58()
  );
  assert.ok(fill, "FillLog missing the A->B fill");
  assert.strictEqual(fill.price.toString(), PRICE.toString());
  assert.strictEqual(fill.size.toString(), SIZE.toString());
  assert.deepStrictEqual(fill.takerSide, { long: {} });

  console.log(`    FILL: ${fill.size.toString()} @ ${fill.price.toString()}  seq=${fill.sequence.toString()}`);
  console.log(`    A short ${posA.size.toString()} @ ${posA.entryPrice.toString()}  rebate=${(-collA.feesPaid).toString()}`);
  console.log(`    B long  ${posB.size.toString()} @ ${posB.entryPrice.toString()}  fee=${collB.feesPaid.toString()}`);
});

it("settle_to_l1 lands on L1; InsuranceFund credited by the 2bps share", async () => {
  const expected = insuranceBefore.add(INSURANCE_DELTA);
  let balance = insuranceBefore;
  for (let i = 0; i < 40; i++) {
    balance = (await program.account.insuranceFund.fetch(insuranceFund)).balance;
    if (balance.gte(expected)) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log(
    `    insurance L1 balance: ${insuranceBefore.toString()} -> ${balance.toString()} (+${INSURANCE_DELTA.toString()} expected)`
  );
  assert.ok(
    balance.gte(expected),
    `insurance not credited: ${balance.toString()} < ${expected.toString()}`
  );
});

run();
