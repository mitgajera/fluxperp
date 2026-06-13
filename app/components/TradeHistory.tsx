"use client";

import { useTrading } from "../lib/trading-context";
import { px, sz } from "../lib/format";

export default function TradeHistory() {
  const { fills } = useTrading();

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 h-9 border-b border-line shrink-0">
        <h2 className="text-2xs uppercase tracking-wide text-muted">Trades</h2>
        <span className="text-2xs text-faint">FillLog · ER</span>
      </div>
      <div className="grid grid-cols-4 px-3 h-6 items-center text-2xs uppercase text-faint border-b border-line/60 shrink-0">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Side</span>
        <span className="text-right">Time</span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {fills.length === 0 ? (
          <div className="grid place-items-center h-20 text-2xs text-faint">no trades yet</div>
        ) : (
          fills.slice(0, 40).map((f) => {
            const isBuy = "long" in f.takerSide;
            return (
              <div
                key={`${f.sequence.toString()}-${f.ts.toString()}`}
                className="grid grid-cols-4 px-3 h-[18px] items-center font-mono text-2xs tabular-nums animate-row-in hover:bg-white/[0.02]"
              >
                <span className={isBuy ? "text-long" : "text-short"}>{px(f.price)}</span>
                <span className="text-right text-muted">{sz(f.size)}</span>
                <span className={`text-right ${isBuy ? "text-long" : "text-short"}`}>{isBuy ? "BUY" : "SELL"}</span>
                <span className="text-right text-faint">
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
