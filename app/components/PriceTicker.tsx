"use client";

import { useEffect, useRef, useState } from "react";
import { TokenIcon } from "./TokenIcon";

interface Asset {
  symbol: string;
  price: number;
  change24h: number; // percent
  dp: number;
}

// realistic seed prices; the ticker walks them so the bar is always live
const SEED: { symbol: string; price: number; dp: number }[] = [
  { symbol: "SOL", price: 68.4, dp: 3 },
  { symbol: "BTC", price: 64210, dp: 1 },
  { symbol: "ETH", price: 3384, dp: 2 },
  { symbol: "HYPE", price: 38.6, dp: 3 },
  { symbol: "BNB", price: 612.4, dp: 2 },
  { symbol: "ZEC", price: 44.2, dp: 3 },
];

function gauss() {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export default function PriceTicker() {
  const [assets, setAssets] = useState<Asset[]>(() =>
    SEED.map((s) => ({ ...s, change24h: gauss() * 3 }))
  );
  const ref = useRef(assets);
  ref.current = assets;

  useEffect(() => {
    const t = setInterval(() => {
      setAssets(
        ref.current.map((a) => {
          // small mean-reverting random walk
          const drift = gauss() * 0.0007;
          const price = Math.max(0.0001, a.price * (1 + drift));
          return { ...a, price, change24h: a.change24h + drift * 100 * 0.4 };
        })
      );
    }, 1400);
    return () => clearInterval(t);
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
