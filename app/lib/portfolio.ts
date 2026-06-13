export const OFFSET_CREDIT_BPS = 2000;  // 20% credit on opposing directional exposure

const BPS = 10_000;

export interface PortfolioLeg {
  market: number;
  symbol: string;
  side: "long" | "short";
  notional: number;

  margin: number;

  upnl: number;
}

export interface PortfolioMargin {
  legs: PortfolioLeg[];
  grossNotional: number;
  netNotional: number;
  netSide: "long" | "short" | "flat";
  marginNaive: number;
  marginRequired: number;
  marginSaved: number;
  savedPct: number;

  totalUpnl: number;
  accountHealthBps: number;
}

export function computePortfolioMargin(legs: PortfolioLeg[], equity: number): PortfolioMargin {
  let longN = 0;
  let shortN = 0;
  let naive = 0;
  let totalUpnl = 0;
  for (const l of legs) {
    naive += l.margin;
    totalUpnl += l.upnl;
    if (l.side === "long") longN += l.notional;
    else shortN += l.notional;
  }
  const gross = longN + shortN;
  const offset = Math.min(longN, shortN);

  const saved = gross > 0 ? Math.min(naive, (OFFSET_CREDIT_BPS * 2 * offset * naive) / (gross * BPS)) : 0;
  const required = naive - saved;
  const netSide = longN > shortN ? "long" : shortN > longN ? "short" : "flat";

  return {
    legs,
    grossNotional: gross,
    netNotional: Math.abs(longN - shortN),
    netSide,
    marginNaive: naive,
    marginRequired: required,
    marginSaved: saved,
    savedPct: naive > 0 ? (saved / naive) * 100 : 0,
    totalUpnl,
    accountHealthBps: gross > 0 ? Math.round(((equity + totalUpnl) * BPS) / gross) : 0,
  };
}
