import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export type Side = { long: {} } | { short: {} };
export type PositionSide = { flat: {} } | { long: {} } | { short: {} };
export type OrderType = { limit: {} } | { market: {} };
export type TriggerKind = { stopLoss: {} } | { takeProfit: {} };

export const isLong = (s: Side | PositionSide) => "long" in s;
export const isShort = (s: Side | PositionSide) => "short" in s;
export const isFlat = (s: PositionSide) => "flat" in s;

export interface Order {
  orderId: BN;
  owner: PublicKey;
  price: BN;
  size: BN;
  timestamp: BN;
}

export interface Fill {
  maker: PublicKey;
  taker: PublicKey;
  price: BN;
  size: BN;
  takerSide: Side;
  ts: BN;
  sequence: BN;
}

export interface TriggerOrder {
  kind: TriggerKind;
  triggerPrice: BN;
  size: BN;
  fireSide: Side;
}

export interface MarketConfig {
  marketIndex: number;
  symbol: number[];  // [u8; 16]

  tickSize: BN;
  lotSize: BN;
  maxLeverage: number;
  vault: PublicKey;
  authority: PublicKey;
  bump: number;
}

export interface CollateralAccount {
  user: PublicKey;
  deposited: BN;
  availableMargin: BN;
  marginUsed: BN;
  realizedPnl: BN;
  feesPaid: BN;
  fundingPaid: BN;
  bump: number;
}

export interface OrderbookState {
  marketIndex: number;
  bids: Order[];
  asks: Order[];
  lastTradePrice: BN;
  sequence: BN;
  nextOrderId: BN;
  fundingRateBps: BN;
  lastFundingTs: BN;
  bump: number;
}

export interface PositionAccount {
  user: PublicKey;
  marketIndex: number;
  side: PositionSide;
  size: BN;
  entryPrice: BN;
  marginAllocated: BN;
  lastFundingTs: BN;
  bump: number;
}

export interface PriceFeed {
  marketIndex: number;
  markPrice: BN;
  indexPrice: BN;
  lastUpdateTs: BN;
  publisher: PublicKey;
  bump: number;
}

export interface FillLog {
  marketIndex: number;
  fills: Fill[];
  head: number;
  count: number;
  bump: number;
}

export interface TriggerOrders {
  user: PublicKey;
  marketIndex: number;
  triggers: TriggerOrder[];
  bump: number;
}

export interface InsuranceFund {
  balance: BN;
  badDebtAbsorbed: BN;
  bump: number;
}

export interface RiskEngine {
  marketIndex: number;
  returns: BN[];
  head: number;
  count: number;
  lastPrice: BN;
  leverageCap: number;
  priceBandBps: number;
  circuitBreaker: boolean;
  lastUpdateTs: BN;
  bump: number;
}

export interface MarginLeg {
  marketIndex: number;
  side: PositionSide;
  notional: BN;
  margin: BN;
}

export interface MarginProfile {
  user: PublicKey;
  legs: MarginLeg[];
  grossNotional: BN;
  netNotional: BN;
  marginNaive: BN;
  marginRequired: BN;
  marginSaved: BN;
  netSide: PositionSide;
  lastUpdateTs: BN;
  bump: number;
}

export interface LeaderEntry {
  trader: PublicKey;
  pnlBps: BN;
  realizedPnl: BN;
  volume: BN;
}

export interface WinnerRecord {
  epoch: BN;
  winner: PublicKey;
  prize: BN;
  vrfResult: number[];
  candidates: number;
  ts: BN;
}

export interface Leaderboard {
  authority: PublicKey;
  epoch: BN;
  startTs: BN;
  endTs: BN;
  epochDuration: BN;
  prizePool: BN;
  entries: LeaderEntry[];
  candidates: PublicKey[];
  vrfPending: boolean;
  winner: PublicKey;
  vrfResult: number[];
  history: WinnerRecord[];
  bump: number;
}

export const PRICE_SCALE = 1_000_000;
export const SIZE_SCALE = 1_000_000;
export const BPS = 10_000;

export const toUi = (x: BN, scale = PRICE_SCALE) => x.toNumber() / scale;
export const symbolToString = (s: number[]) =>
  Buffer.from(s).toString("utf8").replace(/\0+$/, "");

export function orderedFills(log: FillLog): Fill[] {
  const n = log.count;
  if (n === 0) return [];
  const out: Fill[] = [];
  const start = log.fills.length <= n ? 0 : log.head;

  for (let i = 0; i < n; i++) out.push(log.fills[(start + i) % log.fills.length]);
  return out;
}
