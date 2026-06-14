"use client";

import { useEffect, useRef, useState } from "react";
import { useTrading } from "../lib/trading-context";
import { px, compact } from "../lib/format";
import FundingCountdown from "./FundingCountdown";
import MarketSelector from "./MarketSelector";

function FlashPrice({ value }: { value: number | null }) {
  const prev = useRef<number | null>(null);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (value != null && prev.current != null && value !== prev.current) {
      setDir(value > prev.current ? "up" : "down");
      const t = setTimeout(() => setDir(null), 400);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);
  return (
    <span
      className={`tnum font-mono text-xl font-semibold tracking-tight transition-colors duration-200 ${
        dir === "up" ? "text-long" : dir === "down" ? "text-short" : "text-txt"
      }`}
    >
      {value != null ? value.toFixed(3) : "—"}
    </span>
  );
}

function Stat({ label, children, w = "min-w-[92px]" }: { label: string; children: React.ReactNode; w?: string }) {
  return (
    <div className={`flex flex-col justify-center px-4 border-l border-line first:border-l-0 transition-colors hover:bg-white/[0.015] ${w}`}>
      <span className="text-[10px] uppercase tracking-wide text-faint mb-1">{label}</span>
      <div className="leading-none">{children}</div>
    </div>
  );
}

function VolBadge() {
  const { riskEngine } = useTrading();
  if (!riskEngine) return <span className="text-2xs text-faint">10× · cross</span>;
  const cap = riskEngine.leverageCap;
  const high = riskEngine.circuitBreaker || cap <= 5;
  return (
    <span
      className={`text-2xs px-1.5 py-0.5 rounded ${
        high ? "bg-short/15 text-short" : "bg-surface-3 text-muted"
      }`}
      title={riskEngine.circuitBreaker ? "Circuit breaker tripped" : "Dynamic leverage cap"}
    >
      {high && riskEngine.circuitBreaker ? "VOL HIGH · " : ""}max {cap}× · cross
    </span>
  );
}

export default function StatsBar() {
  const { price, orderbook, fills, latencyMs, candles } = useTrading();

  const mark = price ? price.markPrice.toNumber() / 1e6 : null;
  const first = candles[0]?.open;
  const last = candles[candles.length - 1]?.close;
  const change = first && last ? ((last - first) / first) * 100 : null;

  const volume = fills.reduce((acc, f) => acc + (f.size.toNumber() * f.price.toNumber()) / 1e6 / 1e6, 0);
  const lastTrade = orderbook ? orderbook.lastTradePrice : null;

  return (
    <div className="flex items-stretch h-14 bg-surface-1 border-b border-line overflow-x-auto">
      <div className="flex items-center gap-2.5 px-4 border-r border-line shrink-0 bg-surface-2/40">
        <MarketSelector />
        <VolBadge />
      </div>

      <Stat label="Last Price" w="min-w-[104px]">
        <FlashPrice value={mark} />
      </Stat>

      <Stat label="24h Change">
        <span
          className={`inline-flex items-center tnum font-mono text-xs font-medium px-1.5 py-1 rounded ${
            change == null ? "text-muted" : change >= 0 ? "bg-long/10 text-long" : "bg-short/10 text-short"
          }`}
        >
          {change == null ? "—" : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(2)}%`}
        </span>
      </Stat>

      <Stat label="Mark / Index" w="min-w-[150px]">
        <span className="tnum font-mono text-sm text-muted">
          {price ? `${px(price.markPrice, 2)} / ${px(price.indexPrice, 2)}` : "—"}
        </span>
      </Stat>

      <Stat label="Funding · 1h" w="min-w-[124px]">
        <FundingCountdown />
      </Stat>

      <Stat label="Volume">
        <span className="tnum font-mono text-sm text-txt">{volume > 0 ? `$${compact(Math.round(volume * 1e6))}` : "—"}</span>
      </Stat>

      <Stat label="Last Trade">
        <span className="tnum font-mono text-sm text-txt">{lastTrade && lastTrade.toNumber() > 0 ? px(lastTrade) : "—"}</span>
      </Stat>

      <div className="ml-auto flex items-center gap-2 px-4 border-l border-line shrink-0">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            latencyMs == null
              ? "bg-faint"
              : latencyMs < 150
              ? "bg-long animate-pulse-dot"
              : latencyMs < 400
              ? "bg-amber-400 animate-pulse-dot"
              : "bg-short animate-pulse-dot"
          }`}
          aria-hidden
        />
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] uppercase tracking-wide text-faint mb-0.5">ER latency</span>
          <span
            className={`tnum font-mono text-sm ${
              latencyMs == null ? "text-muted" : latencyMs < 400 ? "text-txt" : "text-short"
            }`}
          >
            {latencyMs != null ? `${latencyMs} ms` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
