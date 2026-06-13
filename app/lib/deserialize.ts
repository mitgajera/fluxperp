import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "./idl/fluxperp.json";
import type {
  OrderbookState,
  FillLog,
  PriceFeed,
  PositionAccount,
  CollateralAccount,
  MarketConfig,
  TriggerOrders,
  InsuranceFund,
  RiskEngine,
  MarginProfile,
  Leaderboard,
} from "./types";

const dummyWallet = {
  publicKey: PublicKey.default,
  signTransaction: async (t: any) => t,
  signAllTransactions: async (t: any) => t,
} as any;

const provider = new AnchorProvider(new Connection("http://127.0.0.1:8899"), dummyWallet, {
  commitment: "processed",
});
const accounts = new Program(idl as any, provider).coder.accounts;

export const decodeOrderbook = (d: Buffer): OrderbookState => accounts.decode("orderbookState", d);
export const decodeFillLog = (d: Buffer): FillLog => accounts.decode("fillLog", d);
export const decodePriceFeed = (d: Buffer): PriceFeed => accounts.decode("priceFeed", d);
export const decodePosition = (d: Buffer): PositionAccount => accounts.decode("positionAccount", d);
export const decodeCollateral = (d: Buffer): CollateralAccount => accounts.decode("collateralAccount", d);
export const decodeMarketConfig = (d: Buffer): MarketConfig => accounts.decode("marketConfig", d);
export const decodeTriggers = (d: Buffer): TriggerOrders => accounts.decode("triggerOrders", d);
export const decodeInsurance = (d: Buffer): InsuranceFund => accounts.decode("insuranceFund", d);
export const decodeRiskEngine = (d: Buffer): RiskEngine => accounts.decode("riskEngine", d);
export const decodeMarginProfile = (d: Buffer): MarginProfile => accounts.decode("marginProfile", d);
export const decodeLeaderboard = (d: Buffer): Leaderboard => accounts.decode("leaderboard", d);
