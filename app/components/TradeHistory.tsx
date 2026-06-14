"use client";

import { useTrading } from "../lib/trading-context";
import { px, sz } from "../lib/format";

export default function TradeHistory() {
  const { fills } = useTrading();

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 h-9 border-b border-line shrink-0">
        <h2 className="text-2xs uppercase tracking-wide text-muted">Recent Trades</h2>
        <span className="text-[9px] text-faint">FillLog · ER</span>
      </div>
      <div className="grid grid-cols-[1.1fr_1fr_0.9fr] px-3 h-6 items-center text-[10px] uppercase tracking-wide text-faint shrink-0">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {fills.length === 0 ? (
          <div className="grid place-items-center h-20 text-2xs text-faint">no trades yet</div>
        ) : (
          fills.slice(0, 50).map((f, i) => {
            const isBuy = "long" in f.takerSide;
            return (
              <div
                key={`${f.sequence.toString()}-${f.ts.toString()}`}
                className={`group relative grid grid-cols-[1.1fr_1fr_0.9fr] px-3 h-[18px] items-center font-mono text-2xs tabular-nums ${
                  i === 0 ? "animate-row-in" : ""
                }`}
              >
                <span
                  className={`absolute inset-y-0 left-0 right-0 ${isBuy ? "bg-long/[0.04]" : "bg-short/[0.04]"} group-hover:opacity-0`}
                  aria-hidden
                />
                <span className={`relative z-10 ${isBuy ? "text-long" : "text-short"}`}>{px(f.price)}</span>
                <span className="relative z-10 text-right text-txt/85">{sz(f.size)}</span>
                <span className="relative z-10 text-right text-faint">
                  {new Date(f.ts.toNumber() * 1000).toLocaleTimeString([], { hour12: false })}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
