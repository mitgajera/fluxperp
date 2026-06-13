"use client";

import { useTrading } from "../lib/trading-context";
import { px, compact } from "../lib/format";
import FundingCountdown from "./FundingCountdown";
import MarketSelector from "./MarketSelector";

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-center px-4 border-l border-line first:border-l-0">
      <span className="text-2xs uppercase tracking-wide text-faint">{label}</span>
      <div className="leading-tight">{children}</div>
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
      <div className="flex items-center gap-2 px-4 border-r border-line shrink-0">
        <MarketSelector />
        <VolBadge />
      </div>

      <Stat label="Last Price">
        <span className="tnum font-mono text-lg text-txt">{mark != null ? mark.toFixed(3) : "—"}</span>
      </Stat>

      <Stat label="24h Change">
        <span className={`tnum font-mono text-sm ${change == null ? "text-muted" : change >= 0 ? "text-long" : "text-short"}`}>
          {change == null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}
        </span>
      </Stat>

      <Stat label="Mark / Index">
        <span className="tnum font-mono text-sm text-muted">
          {price ? `${px(price.markPrice, 2)} / ${px(price.indexPrice, 2)}` : "—"}
        </span>
      </Stat>

      <Stat label="Funding · 1h">
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
          className={`h-1.5 w-1.5 rounded-full ${latencyMs != null ? "bg-long animate-pulse-dot" : "bg-faint"}`}
          aria-hidden
        />
        <div className="flex flex-col leading-tight">
          <span className="text-2xs uppercase tracking-wide text-faint">ER latency</span>
          <span className="tnum font-mono text-sm text-long">{latencyMs != null ? `${latencyMs} ms` : "—"}</span>
        </div>
      </div>
    </div>
  );
}
