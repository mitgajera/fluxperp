import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fluxperp } from "../target/types/fluxperp";
import idl from "../target/idl/fluxperp.json";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createMint,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { erProgram, sendPushPrice, toFixed6 } from "../scripts/price-publisher";

export const DELEGATION_PROGRAM = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
export const MARKET_INDEX = 0;
export const TOKEN_PROGRAM_ID = anchor.utils.token.TOKEN_PROGRAM_ID;

export const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
export const program = new Program<Fluxperp>(idl as Fluxperp, provider);  // L1

export const wallet = (provider.wallet as anchor.Wallet).payer;
export const er = erProgram(new anchor.Wallet(wallet));

const enc = new TextEncoder();
const mi = Buffer.from([MARKET_INDEX]);
export const pda = (s: (Buffer | Uint8Array)[]) =>
  PublicKey.findProgramAddressSync(s, program.programId)[0];

export const marketConfig = pda([enc.encode("market"), mi]);
export const orderbook = pda([enc.encode("orderbook"), mi]);
export const fillLog = pda([enc.encode("fill_log"), mi]);
export const priceFeed = pda([enc.encode("price"), mi]);
export const riskEngine = pda([enc.encode("risk"), mi]);
export const vault = pda([enc.encode("vault")]);
export const insuranceFund = pda([enc.encode("insurance")]);

export const collOf = (k: PublicKey) => pda([enc.encode("collateral"), k.toBuffer()]);
export const posOf = (k: PublicKey) => pda([enc.encode("position"), k.toBuffer(), mi]);
export const trigOf = (k: PublicKey) => pda([enc.encode("triggers"), k.toBuffer(), mi]);
export const advOf = (k: PublicKey) => pda([enc.encode("adv"), k.toBuffer(), mi]);

export const LONG = { long: {} } as any;
export const SHORT = { short: {} } as any;
export const LIMIT = { limit: {} } as any;
export const MARKET = { market: {} } as any;
export const SL = { stopLoss: {} } as any;
export const TP = { takeProfit: {} } as any;

const tests: { name: string; fn: () => Promise<void> }[] = [];
export const it = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
export async function run() {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
    } catch (e) {
      failed++;
      const err = e as any;
      console.error(`  ✗ ${t.name}\n     ${err.message || String(e)}`);
      if (err.logs) console.error("     logs:", JSON.stringify(err.logs).slice(0, 700));
    }
  }
  console.log(failed === 0 ? "\nAll steps passed." : `\n${failed} step(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

async function isDelegated(addr: PublicKey): Promise<boolean> {
  const info = await provider.connection.getAccountInfo(addr);
  return !!info && info.owner.toBase58() === DELEGATION_PROGRAM.toBase58();
}

export async function ensureMarket(): Promise<PublicKey> {
  let mint: PublicKey;
  const existing = await provider.connection.getAccountInfo(marketConfig);
  if (!existing) {
    mint = await createMint(provider.connection, wallet, wallet.publicKey, null, 6);
    await program.methods
      .initializeMarket(MARKET_INDEX, "SOL-PERP", new anchor.BN(1000), new anchor.BN(1000), 10)
      .accountsStrict({
        authority: wallet.publicKey,
        marketConfig,
        orderbook,
        fillLog,
        priceFeed,
        collateralMint: mint,
        vault,
        insuranceFund,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  } else {
    mint = (await getAccount(provider.connection, vault)).mint;
  }
  if (!(await isDelegated(orderbook)))
    await program.methods.delegateOrderbook(MARKET_INDEX).accountsPartial({ payer: wallet.publicKey, orderbook }).rpc();
  if (!(await isDelegated(fillLog)))
    await program.methods.delegateFillLog(MARKET_INDEX).accountsPartial({ payer: wallet.publicKey, fillLog }).rpc();
  if (!(await isDelegated(priceFeed)))
    await program.methods.delegatePriceFeed(MARKET_INDEX).accountsPartial({ payer: wallet.publicKey, priceFeed }).rpc();
  await resetBook();
  return mint;
}

export async function resetBook() {
  await er.methods
    .resetOrderbook(MARKET_INDEX)
    .accountsStrict({ authority: wallet.publicKey, marketConfig, orderbook })
    .rpc();
}

export async function makeTrader(mint: PublicKey, depositUsdc = 100): Promise<Keypair> {
  const kp = Keypair.generate();
  const deposit = new anchor.BN(depositUsdc * 1_000_000);
  await provider.sendAndConfirm(
    new anchor.web3.Transaction().add(
      SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: kp.publicKey, lamports: 0.15 * LAMPORTS_PER_SOL })
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
  await mintTo(provider.connection, wallet, mint, ata, wallet, deposit.toNumber());

  await program.methods
    .initializeCollateral()
    .accountsStrict({ user: kp.publicKey, collateral: collOf(kp.publicKey), systemProgram: SystemProgram.programId })
    .signers([kp]).rpc();
  await program.methods
    .depositCollateral(deposit)
    .accountsStrict({ user: kp.publicKey, collateral: collOf(kp.publicKey), userTokenAccount: ata, vault, tokenProgram: TOKEN_PROGRAM_ID })
    .signers([kp]).rpc();
  await program.methods
    .initializePosition(MARKET_INDEX)
    .accountsStrict({ user: kp.publicKey, marketConfig, position: posOf(kp.publicKey), systemProgram: SystemProgram.programId })
    .signers([kp]).rpc();
  await program.methods
    .initializeTriggers(MARKET_INDEX)
    .accountsStrict({ user: kp.publicKey, marketConfig, triggers: trigOf(kp.publicKey), systemProgram: SystemProgram.programId })
    .signers([kp]).rpc();

  await program.methods.delegateCollateral().accountsPartial({ payer: kp.publicKey, collateral: collOf(kp.publicKey) }).signers([kp]).rpc();
  await program.methods.delegatePosition(MARKET_INDEX).accountsPartial({ payer: kp.publicKey, position: posOf(kp.publicKey) }).signers([kp]).rpc();
  await program.methods.delegateTriggers(MARKET_INDEX).accountsPartial({ payer: kp.publicKey, triggers: trigOf(kp.publicKey) }).signers([kp]).rpc();
  return kp;
}

export async function pushPrice(mark: number, index: number) {
  await sendPushPrice(er, MARKET_INDEX, toFixed6(mark), toFixed6(index));
}

const makerMetas = (kps: Keypair[]) =>
  kps.flatMap((k) => [
    { pubkey: posOf(k.publicKey), isWritable: true, isSigner: false },
    { pubkey: collOf(k.publicKey), isWritable: true, isSigner: false },
  ]);

export async function placeLimit(kp: Keypair, side: any, price: number, sizeUnits: number, risk: PublicKey | null = null) {
  await er.methods
    .placeOrder(MARKET_INDEX, side, toFixed6(price), new anchor.BN(sizeUnits), LIMIT)
    .accountsStrict({ taker: kp.publicKey, marketConfig, orderbook, fillLog, takerPosition: posOf(kp.publicKey), takerCollateral: collOf(kp.publicKey), riskEngine: risk, marginProfile: null })
    .signers([kp]).rpc();
}

export async function placeMarket(kp: Keypair, side: any, sizeUnits: number, makers: Keypair[], risk: PublicKey | null = null) {
  await er.methods
    .placeOrder(MARKET_INDEX, side, new anchor.BN(0), new anchor.BN(sizeUnits), MARKET)
    .accountsStrict({ taker: kp.publicKey, marketConfig, orderbook, fillLog, takerPosition: posOf(kp.publicKey), takerCollateral: collOf(kp.publicKey), riskEngine: risk, marginProfile: null })
    .remainingAccounts(makerMetas(makers))
    .signers([kp]).rpc();
}

export { makerMetas };
