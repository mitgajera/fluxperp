"use client";

import { useEffect, useState } from "react";
import { useTrading } from "../lib/trading-context";
import { px, sz } from "../lib/format";
import type { Order } from "../lib/types";

interface Level {
  price: number;
  size: number;
  total: number;
}

function aggregate(orders: Order[], desc: boolean): Level[] {
  const byPrice = new Map<number, number>();
  for (const o of orders) {
    const p = o.price.toNumber();
    byPrice.set(p, (byPrice.get(p) ?? 0) + o.size.toNumber());
  }
  const levels = Array.from(byPrice.entries())
    .map(([price, size]) => ({ price, size }))
    .sort((a, b) => (desc ? b.price - a.price : a.price - b.price));
  let cum = 0;
  return levels.map((l) => {
    cum += l.size;
    return { ...l, total: cum };
  });
}

function Row({ l, side, max }: { l: Level; side: "ask" | "bid"; max: number }) {
  const w = max > 0 ? Math.min(100, (l.total / max) * 100) : 0;
  const color = side === "ask" ? "text-short" : "text-long";
  const bar = side === "ask" ? "bg-short/10" : "bg-long/10";
  return (
    <div className="relative grid grid-cols-3 px-3 h-[18px] items-center font-mono text-2xs tabular-nums hover:bg-white/[0.03] cursor-default">
      <div className={`absolute inset-y-0 right-0 ${bar}`} style={{ width: `${w}%` }} aria-hidden />
      <span className={`relative z-10 ${color}`}>{px(l.price)}</span>
      <span className="relative z-10 text-right text-muted">{sz(l.size)}</span>
      <span className="relative z-10 text-right text-faint">{sz(l.total)}</span>
    </div>
  );
}

export default function Orderbook() {
  const { orderbook, price, bookUpdatedAt } = useTrading();
  const [ago, setAgo] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setAgo(Date.now() - bookUpdatedAt), 200);
    return () => clearInterval(t);
  }, [bookUpdatedAt]);

  const asks = orderbook ? aggregate(orderbook.asks, false) : [];
  const bids = orderbook ? aggregate(orderbook.bids, true) : [];
  const max = Math.max(asks.at(-1)?.total ?? 0, bids.at(-1)?.total ?? 0);
  const spread =
    asks[0] && bids[0] ? (asks[0].price - bids[0].price) / 1e6 : null;
  const mark = price ? price.markPrice.toNumber() / 1e6 : null;

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 h-9 border-b border-line">
        <h2 className="text-2xs uppercase tracking-wide text-muted">Order Book</h2>
        <span className="text-2xs text-faint tnum">{ago < 60000 ? `${(ago / 1000).toFixed(1)}s ago` : "—"}</span>
      </div>
      <div className="grid grid-cols-3 px-3 h-6 items-center text-2xs uppercase text-faint border-b border-line/60">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      {}
      <div className="flex-1 flex flex-col-reverse overflow-y-auto min-h-0">
        {asks.length === 0 ? (
          <div className="h-full grid place-items-center text-2xs text-faint">no asks</div>
        ) : (
          asks.slice(0, 12).map((l) => <Row key={`a${l.price}`} l={l} side="ask" max={max} />)
        )}
      </div>

      {}
      <div className="flex items-center justify-between px-3 h-8 border-y border-line bg-surface-2">
        <span className="tnum font-mono text-sm text-txt drop-shadow-[0_0_6px_rgba(57,255,20,0.25)]">
          {mark != null ? mark.toFixed(3) : "—"}
        </span>
        <span className="tnum font-mono text-2xs text-faint">
          {spread != null ? `spread ${spread.toFixed(3)}` : ""}
        </span>
      </div>

      {}
      <div className="flex-1 overflow-y-auto min-h-0">
        {bids.length === 0 ? (
          <div className="h-full grid place-items-center text-2xs text-faint">no bids</div>
        ) : (
          bids.slice(0, 12).map((l) => <Row key={`b${l.price}`} l={l} side="bid" max={max} />)
        )}
      </div>
    </div>
  );
}
