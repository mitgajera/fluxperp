import * as anchor from "@coral-xyz/anchor";
import * as assert from "assert";
import {
  it, run, er, program, provider, wallet, DELEGATION_PROGRAM, TOKEN_PROGRAM_ID,
  LONG, SHORT, LIMIT, MARKET,
} from "./shared";
import { sendPushPrice, toFixed6 } from "../scripts/price-publisher";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createMint, getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction, mintTo,
} from "@solana/spl-token";

const enc = new TextEncoder();
const miOf = (m: number) => Buffer.from([m]);
const pda = (s: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(s, program.programId)[0];

const mktCfg = (m: number) => pda([enc.encode("market"), miOf(m)]);
const ob = (m: number) => pda([enc.encode("orderbook"), miOf(m)]);
const fl = (m: number) => pda([enc.encode("fill_log"), miOf(m)]);
const pf = (m: number) => pda([enc.encode("price"), miOf(m)]);
const vault = pda([enc.encode("vault")]);
const insurance = pda([enc.encode("insurance")]);
const collOf = (k: PublicKey) => pda([enc.encode("collateral"), k.toBuffer()]);
const posOf = (k: PublicKey, m: number) => pda([enc.encode("position"), k.toBuffer(), miOf(m)]);
const trigOf = (k: PublicKey, m: number) => pda([enc.encode("triggers"), k.toBuffer(), miOf(m)]);
const marginOf = (k: PublicKey) => pda([enc.encode("margin"), k.toBuffer()]);

const SYS = SystemProgram.programId;
const isDelegated = async (a: PublicKey) => {
  const i = await provider.connection.getAccountInfo(a);
  return !!i && i.owner.toBase58() === DELEGATION_PROGRAM.toBase58();
};

async function ensureMkt(m: number, symbol: string): Promise<PublicKey> {
  let mint: PublicKey;
  const existing = await provider.connection.getAccountInfo(mktCfg(m));
  if (!existing) {
    mint = await createMint(provider.connection, wallet, wallet.publicKey, null, 6);
    await program.methods
      .initializeMarket(m, symbol, new anchor.BN(1000), new anchor.BN(1000), 10)
      .accountsStrict({
        authority: wallet.publicKey, marketConfig: mktCfg(m), orderbook: ob(m), fillLog: fl(m),
        priceFeed: pf(m), collateralMint: mint, vault, insuranceFund: insurance,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SYS,
      }).rpc();
  } else {
    const { getAccount } = await import("@solana/spl-token");
    mint = (await getAccount(provider.connection, vault)).mint;
  }
  if (!(await isDelegated(ob(m)))) await program.methods.delegateOrderbook(m).accountsPartial({ payer: wallet.publicKey, orderbook: ob(m) }).rpc();
  if (!(await isDelegated(fl(m)))) await program.methods.delegateFillLog(m).accountsPartial({ payer: wallet.publicKey, fillLog: fl(m) }).rpc();
  if (!(await isDelegated(pf(m)))) await program.methods.delegatePriceFeed(m).accountsPartial({ payer: wallet.publicKey, priceFeed: pf(m) }).rpc();
  await er.methods.resetOrderbook(m).accountsStrict({ authority: wallet.publicKey, marketConfig: mktCfg(m), orderbook: ob(m) }).rpc();
  return mint;
}

async function mkTrader(mint: PublicKey, markets: number[], depositUsdc = 1000): Promise<Keypair> {
  const kp = Keypair.generate();
  const deposit = new anchor.BN(depositUsdc * 1e6);
  await provider.sendAndConfirm(new anchor.web3.Transaction().add(
    SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: kp.publicKey, lamports: 0.25 * LAMPORTS_PER_SOL })
  ), []);
  const ata = getAssociatedTokenAddressSync(mint, kp.publicKey);
  await provider.sendAndConfirm(new anchor.web3.Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, ata, kp.publicKey, mint)
  ), []);
  await mintTo(provider.connection, wallet, mint, ata, wallet, deposit.toNumber());

  await program.methods.initializeCollateral().accountsStrict({ user: kp.publicKey, collateral: collOf(kp.publicKey), systemProgram: SYS }).signers([kp]).rpc();
  await program.methods.depositCollateral(deposit).accountsStrict({ user: kp.publicKey, collateral: collOf(kp.publicKey), userTokenAccount: ata, vault, tokenProgram: TOKEN_PROGRAM_ID }).signers([kp]).rpc();
  for (const m of markets) {
    await program.methods.initializePosition(m).accountsStrict({ user: kp.publicKey, marketConfig: mktCfg(m), position: posOf(kp.publicKey, m), systemProgram: SYS }).signers([kp]).rpc();
    await program.methods.initializeTriggers(m).accountsStrict({ user: kp.publicKey, marketConfig: mktCfg(m), triggers: trigOf(kp.publicKey, m), systemProgram: SYS }).signers([kp]).rpc();
    await program.methods.delegatePosition(m).accountsPartial({ payer: kp.publicKey, position: posOf(kp.publicKey, m) }).signers([kp]).rpc();
    await program.methods.delegateTriggers(m).accountsPartial({ payer: kp.publicKey, triggers: trigOf(kp.publicKey, m) }).signers([kp]).rpc();
  }
  await program.methods.delegateCollateral().accountsPartial({ payer: kp.publicKey, collateral: collOf(kp.publicKey) }).signers([kp]).rpc();
  return kp;
}

const restLimit = (kp: Keypair, m: number, side: any, price: number, size: number) =>
  er.methods.placeOrder(m, side, toFixed6(price), new anchor.BN(size), LIMIT)
    .accountsStrict({ taker: kp.publicKey, marketConfig: mktCfg(m), orderbook: ob(m), fillLog: fl(m), takerPosition: posOf(kp.publicKey, m), takerCollateral: collOf(kp.publicKey), riskEngine: null, marginProfile: null })
    .signers([kp]).rpc();

const takeMarket = (kp: Keypair, m: number, side: any, size: number, makers: Keypair[]) =>
  er.methods.placeOrder(m, side, new anchor.BN(0), new anchor.BN(size), MARKET)
    .accountsStrict({ taker: kp.publicKey, marketConfig: mktCfg(m), orderbook: ob(m), fillLog: fl(m), takerPosition: posOf(kp.publicKey, m), takerCollateral: collOf(kp.publicKey), riskEngine: null, marginProfile: null })
    .remainingAccounts(makers.flatMap((k) => [
      { pubkey: posOf(k.publicKey, m), isWritable: true, isSigner: false },
      { pubkey: collOf(k.publicKey), isWritable: true, isSigner: false },
    ]))
    .signers([kp]).rpc();

{
  let T: Keypair, M0: Keypair, M1: Keypair;

  it("portfolio margin setup: two markets, one cross-market trader + makers", async () => {
    const mint = await ensureMkt(0, "SOL-PERP");
    await ensureMkt(1, "BTC-PERP");
    await sendPushPrice(er, 0, toFixed6(100), toFixed6(100));
    await sendPushPrice(er, 1, toFixed6(100), toFixed6(100));
    T = await mkTrader(mint, [0, 1]);
    M0 = await mkTrader(mint, [0]);
    M1 = await mkTrader(mint, [1]);
  });

  it("init + delegate the cross-market margin profile", async () => {
    await program.methods.initializeMarginProfile().accountsStrict({ user: T.publicKey, marginProfile: marginOf(T.publicKey), systemProgram: SYS }).signers([T]).rpc();
    if (!(await isDelegated(marginOf(T.publicKey))))
      await program.methods.delegateMargin().accountsPartial({ payer: T.publicKey, marginProfile: marginOf(T.publicKey) }).signers([T]).rpc();
  });

  it("opposing second-market position lowers total margin vs the naive sum", async () => {
    await restLimit(M0, 0, SHORT, 100, 1_000_000);
    await takeMarket(T, 0, LONG, 1_000_000, [M0]);

    await restLimit(M1, 1, LONG, 100, 1_000_000);
    await takeMarket(T, 1, SHORT, 1_000_000, [M1]);

    await er.methods.updateMarginProfile().accountsStrict({ cranker: wallet.publicKey, marginProfile: marginOf(T.publicKey) })
      .remainingAccounts([
        { pubkey: posOf(T.publicKey, 0), isWritable: false, isSigner: false },
        { pubkey: pf(0), isWritable: false, isSigner: false },
        { pubkey: posOf(T.publicKey, 1), isWritable: false, isSigner: false },
        { pubkey: pf(1), isWritable: false, isSigner: false },
      ]).rpc();

    const mp = await er.account.marginProfile.fetch(marginOf(T.publicKey));
    const naive = mp.marginNaive.toNumber();
    const required = mp.marginRequired.toNumber();
    const saved = mp.marginSaved.toNumber();
    console.log(`    legs=${mp.legs.length} gross=${mp.grossNotional} net=${mp.netNotional} naive=${naive} required=${required} saved=${saved}`);
    assert.strictEqual(mp.legs.length, 2, "both legs present");
    assert.ok(naive > 0, "naive margin computed");
    assert.ok(required < naive, `portfolio margin ${required} should be below naive sum ${naive}`);
    assert.strictEqual(saved, naive - required, "saved = naive − required");
    assert.ok(saved > 0, "netting saved margin");
  });
}

run();
