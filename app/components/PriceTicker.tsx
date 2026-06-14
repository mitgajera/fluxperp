"use client";

import { useEffect, useRef, useState } from "react";
import { TokenIcon } from "./TokenIcon";

interface Asset {
  symbol: string;
  price: number;
  change24h: number; // percent
  dp: number;
  binance: string;
  cg: string; // CoinGecko fallback id (for symbols Binance doesn't list, e.g. HYPE)
}

const SEED: (Omit<Asset, "price" | "change24h"> & { seed: number })[] = [
  { symbol: "SOL", dp: 3, binance: "SOLUSDT", cg: "solana", seed: 71 },
  { symbol: "BTC", dp: 1, binance: "BTCUSDT", cg: "bitcoin", seed: 65700 },
  { symbol: "ETH", dp: 2, binance: "ETHUSDT", cg: "ethereum", seed: 1718 },
  { symbol: "HYPE", dp: 3, binance: "HYPEUSDT", cg: "hyperliquid", seed: 45 },
  { symbol: "BNB", dp: 2, binance: "BNBUSDT", cg: "binancecoin", seed: 616 },
  { symbol: "ZEC", dp: 3, binance: "ZECUSDT", cg: "zcash", seed: 487 },
];

export default function PriceTicker() {
  const [assets, setAssets] = useState<Asset[]>(() =>
    SEED.map(({ seed, ...s }) => ({ ...s, price: seed, change24h: 0 }))
  );
  const ref = useRef(assets);
  ref.current = assets;
  useEffect(() => {
    const tick = async () => {
      // Binance 24h ticker per symbol (independent so one missing pair can't break the rest)
      const bn = await Promise.all(
        SEED.map(async (s) => {
          try {
            const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${s.binance}`, { cache: "no-store" });
            if (!r.ok) return null;
            const j = (await r.json()) as { lastPrice?: string; priceChangePercent?: string };
            return { price: parseFloat(j.lastPrice ?? "0"), change: parseFloat(j.priceChangePercent ?? "0") };
          } catch {
            return null;
          }
        })
      );
      // CoinGecko fallback for whatever Binance didn't return (HYPE)
      const missing = SEED.filter((_, i) => !bn[i] || bn[i]!.price <= 0);
      let cg: Record<string, { usd?: number; usd_24h_change?: number }> = {};
      if (missing.length) {
        try {
          const ids = missing.map((s) => s.cg).join(",");
          const r = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`,
            { cache: "no-store" }
          );
          if (r.ok) cg = await r.json();
        } catch {
          /* keep last */
        }
      }
      setAssets((prev) =>
        prev.map((a, i) => {
          if (bn[i] && bn[i]!.price > 0) return { ...a, price: bn[i]!.price, change24h: bn[i]!.change };
          const c = cg[SEED[i].cg];
          if (c?.usd && c.usd > 0) return { ...a, price: c.usd, change24h: c.usd_24h_change ?? a.change24h };
          return a; // keep last/seed
        })
      );
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  const row = (key: string) => (
    <div className="flex items-center shrink-0" key={key}>
      {assets.map((a) => (
        <div key={a.symbol} className="flex items-center gap-2 px-5 border-l border-line/60 first:border-l-0">
          <TokenIcon symbol={a.symbol} size={15} />
          <span className="text-2xs font-semibold text-txt tracking-tight">{a.symbol}</span>
          <span className="tnum font-mono text-2xs text-muted">
            {a.price.toLocaleString(undefined, { minimumFractionDigits: a.dp, maximumFractionDigits: a.dp })}
          </span>
          <span className={`tnum font-mono text-[10px] ${a.change24h >= 0 ? "text-long" : "text-short"}`}>
            {a.change24h >= 0 ? "+" : ""}
            {a.change24h.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="h-8 shrink-0 flex items-center bg-surface-1 border-t border-line overflow-hidden group">
      {/* shift by exactly one set (-25% of 4 copies) so the loop is seamless on any width */}
      <style>{`@keyframes flux-ticker{0%{transform:translateX(0)}100%{transform:translateX(-25%)}}`}</style>
      <div className="flex items-center px-3 gap-1.5 shrink-0 border-r border-line h-full bg-surface-2 z-10">
        <span className="h-1.5 w-1.5 rounded-full bg-long animate-pulse-dot" aria-hidden />
        <span className="text-[10px] uppercase tracking-wide text-muted font-semibold whitespace-nowrap">Markets</span>
      </div>
      <div
        className="flex-1 overflow-hidden"
        style={{
          maskImage: "linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 28px), transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 28px), transparent)",
        }}
      >
        <div
          className="flex w-max group-hover:[animation-play-state:paused]"
          style={{ animation: "flux-ticker 22s linear infinite" }}
        >
          {row("a")}
          {row("b")}
          {row("c")}
          {row("d")}
        </div>
      </div>
    </div>
  );
}
