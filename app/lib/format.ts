import { BN } from "@coral-xyz/anchor";

export const PRICE_SCALE = 1_000_000;
export const SIZE_SCALE = 1_000_000;

const bnNum = (x: BN | number) => (typeof x === "number" ? x : x.toNumber());

export const px = (x: BN | number, dp = 2) =>
  (bnNum(x) / PRICE_SCALE).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const sz = (x: BN | number, dp = 3) =>
  (bnNum(x) / SIZE_SCALE).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const usd = (x: BN | number, dp = 2) =>
  `$${(bnNum(x) / PRICE_SCALE).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

export const signedUsd = (x: BN | number, dp = 2) => {
  const v = bnNum(x) / PRICE_SCALE;
  const s = v < 0 ? "-" : "+";
  return `${s}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
};

export const pct = (v: number, dp = 2) => `${v >= 0 ? "+" : ""}${v.toFixed(dp)}%`;

export const bps = (b: BN | number) => `${(bnNum(b) / 100).toFixed(3)}%`;

export const compact = (x: BN | number, scale = PRICE_SCALE) => {
  const v = bnNum(x) / scale;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(2)}K`;
  return v.toFixed(2);
};

export const toFixed6 = (n: number) => new BN(Math.round(n * 1_000_000));

export const shortKey = (k: string, n = 4) => `${k.slice(0, n)}…${k.slice(-n)}`;
