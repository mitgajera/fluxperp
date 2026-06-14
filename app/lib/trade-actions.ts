import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  AccountMeta,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { Fluxperp } from "./idl/fluxperp";
import {
  advancedPda,
  collateralPda,
  fillLogPda,
  insurancePda,
  makerPairs,
  marketConfigPda,
  orderbookPda,
  positionPda,
  triggersPda,
  vaultPda,
} from "./program";
import type { Order, OrderbookState } from "./types";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

const LONG = { long: {} };
const SHORT = { short: {} };
const LIMIT = { limit: {} };
const MARKET = { market: {} };

export type UiSide = "long" | "short";
export interface OrderParams {
  market: number;
  side: UiSide;
  type: "limit" | "market";
  price: number;

  size: number;
}

const f6 = (n: number) => new anchor.BN(Math.round(n * 1_000_000));

function expectedFill(book: OrderbookState, p: OrderParams): { notional: number; makers: Order[] } {
  const opposite = p.side === "long" ? book.asks : book.bids;

  const sorted = [...opposite].sort((a, b) =>
    p.side === "long" ? a.price.cmp(b.price) : b.price.cmp(a.price)
  );
  let remaining = Math.round(p.size * 1_000_000);
  let notional = 0;
  const makers: Order[] = [];
  for (const o of sorted) {
    if (remaining <= 0) break;
    const limitOk =
      p.type === "market" ||
      (p.side === "long"
        ? o.price.toNumber() <= Math.round(p.price * 1_000_000)
        : o.price.toNumber() >= Math.round(p.price * 1_000_000));
    if (!limitOk) break;
    const fill = Math.min(remaining, o.size.toNumber());
    notional += Math.round((fill * o.price.toNumber()) / 1_000_000);
    remaining -= fill;
    makers.push(o);
  }
  return { notional, makers };
}

async function sendAutoCommit(
  program: Program<Fluxperp>,
  trader: PublicKey,
  tradeIx: TransactionInstruction,
  market: number,
  insuranceDelta: number,
  protocolDelta: number,
  touched: AccountMeta[]
): Promise<{ signature: string; ms: number }> {
  const commitIx = await program.methods
    .commitState(market, new anchor.BN(insuranceDelta), new anchor.BN(protocolDelta))
    .accountsPartial({
      payer: trader,
      insuranceFund: insurancePda(),
    })
    .remainingAccounts(touched)
    .instruction();

  const conn = program.provider.connection;
  const kp = (program.provider as anchor.AnchorProvider).wallet as unknown as { payer: Keypair };

  // The orderbook/maker accounts are hot (the market-maker quotes constantly), so a send
  // can hit transient account-lock / blockhash contention. Retry a few times with a fresh
  // blockhash before surfacing the error.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    const tx = new Transaction().add(tradeIx, commitIx);
    tx.feePayer = trader;
    tx.recentBlockhash = (await conn.getLatestBlockhash("confirmed")).blockhash;
    tx.sign(kp.payer);
    const t0 = performance.now();
    try {
      const signature = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
      await conn.confirmTransaction(signature, "confirmed");
      return { signature, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      lastErr = e;
      const m = String((e as Error)?.message ?? e);
      const transient = /verification error|0xa0000000|Blockhash not found|block height exceeded|already been processed|not confirmed|fetch failed|429|Too Many/i.test(m);
      if (!transient || attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 350 + attempt * 250));
    }
  }
  throw lastErr;
}

export async function placeOrder(
  program: Program<Fluxperp>,
  trader: PublicKey,
  p: OrderParams,
  book: OrderbookState
) {
  const { notional, makers } = expectedFill(book, p);
  const makerMetas = makerPairs(makers, p.market, { excludeOwner: trader });
  const tradeIx = await program.methods
    .placeOrder(
      p.market,
      p.side === "long" ? LONG : SHORT,
      p.type === "limit" ? f6(p.price) : new anchor.BN(0),
      f6(p.size),
      p.type === "limit" ? LIMIT : MARKET
    )
    .accountsStrict({
      taker: trader,
      marketConfig: marketConfigPda(p.market),
      orderbook: orderbookPda(p.market),
      fillLog: fillLogPda(p.market),
      takerPosition: positionPda(trader, p.market),
      takerCollateral: collateralPda(trader),
      riskEngine: null,
      marginProfile: null,
    })
    .remainingAccounts(makerMetas)
    .instruction();

  const touched: AccountMeta[] = [
    { pubkey: positionPda(trader, p.market), isWritable: true, isSigner: false },
    { pubkey: collateralPda(trader), isWritable: true, isSigner: false },
  ];
  return sendAutoCommit(
    program,
    trader,
    tradeIx,
    p.market,
    Math.round((notional * 2) / 10000),
    Math.round((notional * 1) / 10000),
    touched
  );
}

export async function closePosition(
  program: Program<Fluxperp>,
  trader: PublicKey,
  market: number,
  closingSide: UiSide,

  closeNotional: number,
  book: OrderbookState
) {
  const opposite = closingSide === "long" ? book.asks : book.bids;
  const sorted = [...opposite].sort((a, b) =>
    closingSide === "long" ? a.price.cmp(b.price) : b.price.cmp(a.price)
  );
  const makerMetas = makerPairs(sorted, market, { excludeOwner: trader });
  const tradeIx = await program.methods
    .closePosition(market)
    .accountsStrict({
      taker: trader,
      marketConfig: marketConfigPda(market),
      orderbook: orderbookPda(market),
      fillLog: fillLogPda(market),
      takerPosition: positionPda(trader, market),
      takerCollateral: collateralPda(trader),
    })
    .remainingAccounts(makerMetas)
    .instruction();

  const touched: AccountMeta[] = [
    { pubkey: positionPda(trader, market), isWritable: true, isSigner: false },
    { pubkey: collateralPda(trader), isWritable: true, isSigner: false },
  ];
  return sendAutoCommit(
    program,
    trader,
    tradeIx,
    market,
    Math.round((closeNotional * 2) / 10000),
    Math.round((closeNotional * 1) / 10000),
    touched
  );
}

function makersFor(book: OrderbookState, takerSide: UiSide, market: number, trader: PublicKey) {
  const opposite = takerSide === "long" ? book.asks : book.bids;
  const sorted = [...opposite].sort((a, b) =>
    takerSide === "long" ? a.price.cmp(b.price) : b.price.cmp(a.price)
  );
  return makerPairs(sorted, market, { excludeOwner: trader });
}

export async function reversePosition(
  program: Program<Fluxperp>,
  trader: PublicKey,
  market: number,
  positionSide: UiSide,

  notional: number,  // current position notional (1e6)

  book: OrderbookState
) {
  const takerSide: UiSide = positionSide === "long" ? "short" : "long";
  const makerMetas = makersFor(book, takerSide, market, trader);
  const tradeIx = await program.methods
    .reversePosition(market)
    .accountsStrict({
      taker: trader,
      marketConfig: marketConfigPda(market),
      orderbook: orderbookPda(market),
      fillLog: fillLogPda(market),
      takerPosition: positionPda(trader, market),
      takerCollateral: collateralPda(trader),
    })
    .remainingAccounts(makerMetas)
    .instruction();
  const touched: AccountMeta[] = [
    { pubkey: positionPda(trader, market), isWritable: true, isSigner: false },
    { pubkey: collateralPda(trader), isWritable: true, isSigner: false },
  ];

  const n2 = notional * 2;
  return sendAutoCommit(program, trader, tradeIx, market, Math.round((n2 * 2) / 10000), Math.round(n2 / 10000), touched);
}

export async function scalePosition(
  program: Program<Fluxperp>,
  trader: PublicKey,
  market: number,
  positionSide: UiSide,
  increase: boolean,
  pct: number,
  notional: number,
  book: OrderbookState
) {
  const takerSide: UiSide = increase ? positionSide : positionSide === "long" ? "short" : "long";
  const makerMetas = makersFor(book, takerSide, market, trader);
  const tradeIx = await program.methods
    .scaleInOut(market, pct, increase)
    .accountsStrict({
      taker: trader,
      marketConfig: marketConfigPda(market),
      orderbook: orderbookPda(market),
      fillLog: fillLogPda(market),
      takerPosition: positionPda(trader, market),
      takerCollateral: collateralPda(trader),
    })
    .remainingAccounts(makerMetas)
    .instruction();
  const touched: AccountMeta[] = [
    { pubkey: positionPda(trader, market), isWritable: true, isSigner: false },
    { pubkey: collateralPda(trader), isWritable: true, isSigner: false },
  ];
  const nd = Math.round((notional * pct) / 100);
  return sendAutoCommit(program, trader, tradeIx, market, Math.round((nd * 2) / 10000), Math.round(nd / 10000), touched);
}

export async function cancelOrder(
  program: Program<Fluxperp>,
  trader: PublicKey,
  market: number,
  orderId: anchor.BN
) {
  return program.methods
    .cancelOrder(market, orderId)
    .accountsStrict({ owner: trader, orderbook: orderbookPda(market) })
    .rpc();
}

export async function placeTrigger(
  program: Program<Fluxperp>,
  trader: PublicKey,
  market: number,
  kind: "stopLoss" | "takeProfit",
  triggerPrice: number,
  size: number,
  fireSide: UiSide
) {
  const kindArg = kind === "stopLoss" ? { stopLoss: {} } : { takeProfit: {} };
  return program.methods
    .placeTrigger(market, kindArg, f6(triggerPrice), f6(size), fireSide === "long" ? LONG : SHORT)
    .accountsStrict({ user: trader, triggers: triggersPda(trader, market) })
    .rpc();
}

export async function cancelTrigger(
  program: Program<Fluxperp>,
  trader: PublicKey,
  market: number,
  kind: "stopLoss" | "takeProfit",
  triggerPrice: number,
  size: number,
  fireSide: UiSide
) {
  const kindArg = kind === "stopLoss" ? { stopLoss: {} } : { takeProfit: {} };
  return program.methods
    .cancelTrigger(market, kindArg, f6(triggerPrice), f6(size), fireSide === "long" ? LONG : SHORT)
    .accountsStrict({ user: trader, triggers: triggersPda(trader, market) })
    .rpc();
}

export type AdvKind = "iceberg" | "twap" | "gtt";
export interface AdvOrderParams {
  market: number;
  side: UiSide;
  kind: AdvKind;
  price: number;

  totalSize: number;

  displaySize: number;

  sliceInterval: number;

  expiry: number;  // unix seconds, 0 = none (GTT)
}

const advKindArg = (k: AdvKind) =>
  k === "iceberg" ? { iceberg: {} } : k === "twap" ? { twap: {} } : { gtt: {} };

export async function ensureAdvanced(
  l1: Program<Fluxperp>,

  trader: PublicKey,
  market: number
) {
  const conn = l1.provider.connection;
  const adv = advancedPda(trader, market);
  const info = await conn.getAccountInfo(adv);
  if (!info) {
    await l1.methods
      .initializeAdvanced(market)
      .accountsStrict({
        user: trader,
        marketConfig: marketConfigPda(market),
        advanced: adv,
        systemProgram: new PublicKey("11111111111111111111111111111111"),
      })
      .rpc();
  }
  const after = await conn.getAccountInfo(adv);
  const DELEGATION = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
  if (after && !after.owner.equals(DELEGATION)) {
    await l1.methods
      .delegateAdvanced(market)
      .accountsPartial({ payer: trader, advanced: adv })
      .rpc();
  }
}

export async function placeAdvancedOrder(
  program: Program<Fluxperp>,

  trader: PublicKey,
  p: AdvOrderParams
) {
  return program.methods
    .placeAdvancedOrder(
      p.market,
      p.side === "long" ? LONG : SHORT,
      f6(p.price),
      f6(p.totalSize),
      f6(p.displaySize),
      new anchor.BN(Math.round(p.sliceInterval)),
      new anchor.BN(Math.round(p.expiry)),
      advKindArg(p.kind)
    )
    .accountsStrict({
      user: trader,
      marketConfig: marketConfigPda(p.market),
      orderbook: orderbookPda(p.market),
      advanced: advancedPda(trader, p.market),
      collateral: collateralPda(trader),
      riskEngine: null,
    })
    .rpc();
}

export async function depositCollateral(
  program: Program<Fluxperp>,  // L1 program

  trader: PublicKey,
  mint: PublicKey,
  amountUsdc: number
) {
  const ata = getAssociatedTokenAddressSync(mint, trader);
  return program.methods
    .depositCollateral(f6(amountUsdc))
    .accountsStrict({
      user: trader,
      collateral: collateralPda(trader),
      userTokenAccount: ata,
      vault: vaultPda(),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

export async function undelegateUser(
  program: Program<Fluxperp>,

  trader: PublicKey,
  market: number
) {
  return program.methods
    .undelegateUser(market)
    .accountsPartial({
      user: trader,
      collateral: collateralPda(trader),
      position: positionPda(trader, market),
      triggers: triggersPda(trader, market),
    })
    .rpc();
}

export async function withdrawCollateral(
  program: Program<Fluxperp>,

  trader: PublicKey,
  mint: PublicKey,
  amountUsdc: number
) {
  const ata = getAssociatedTokenAddressSync(mint, trader);
  return program.methods
    .withdrawCollateral(f6(amountUsdc))
    .accountsStrict({
      user: trader,
      collateral: collateralPda(trader),
      userTokenAccount: ata,
      vault: vaultPda(),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}
