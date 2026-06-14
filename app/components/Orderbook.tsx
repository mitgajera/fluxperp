"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTrading } from "../lib/trading-context";
import type { Order } from "../lib/types";

interface Level {
  price: number;
  size: number;
  total: number;
}

// compact size: 1234 -> 1.23K, 1_200_000 -> 1.2M
function fmtSize(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(n < 100 ? 2 : 0);
  return n.toFixed(3);
}

function grouped(orders: Order[], group: number, side: "ask" | "bid"): Level[] {
  const byBucket = new Map<number, number>();
  for (const o of orders) {
    const p = o.price.toNumber() / 1e6;
    const bucket = (side === "ask" ? Math.ceil(p / group) : Math.floor(p / group)) * group;
    byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + o.size.toNumber() / 1e6);
  }
  const levels = Array.from(byBucket.entries())
    .map(([price, size]) => ({ price, size }))
    .sort((a, b) => (side === "ask" ? a.price - b.price : b.price - a.price));
  let cum = 0;
  return levels.map((l) => {
    cum += l.size;
    return { ...l, total: cum };
  });
}

function priceDecimals(group: number) {
  const d = Math.max(0, -Math.floor(Math.log10(group)));
  return Math.min(d, 4);
}

const ROW_H = 19;

function Row({ l, side, max, dp }: { l: Level | null; side: "ask" | "bid"; max: number; dp: number }) {
  if (!l) {
    // empty placeholder so the ladder always fills the panel height
    return <div className="px-3 flex items-center text-2xs text-faint/30 font-mono" style={{ height: ROW_H }}>·</div>;
  }
  const w = max > 0 ? Math.min(100, (l.total / max) * 100) : 0;
  return (
    <div className="group relative grid grid-cols-[1.1fr_1fr_1fr] px-3 items-center font-mono text-2xs tabular-nums cursor-default" style={{ height: ROW_H }}>
      <div
        className={`absolute inset-y-px right-0 rounded-l-sm ${side === "ask" ? "bg-short/[0.12]" : "bg-long/[0.12]"}`}
        style={{ width: `${w}%` }}
        aria-hidden
      />
      <span className={`relative z-10 ${side === "ask" ? "text-short" : "text-long"} group-hover:brightness-125`}>
        {l.price.toFixed(dp)}
      </span>
      <span className="relative z-10 text-right text-txt/90">{fmtSize(l.size)}</span>
      <span className="relative z-10 text-right text-faint">{fmtSize(l.total)}</span>
    </div>
  );
}

// pad a level list with nulls so the column always renders `n` rows
function pad(levels: Level[], n: number): (Level | null)[] {
  const out: (Level | null)[] = levels.slice(0, n);
  while (out.length < n) out.push(null);
  return out;
}

export default function Orderbook() {
  const { orderbook, price, bookUpdatedAt, symbol } = useTrading();
  const [ago, setAgo] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setAgo(Date.now() - bookUpdatedAt), 250);
    return () => clearInterval(t);
  }, [bookUpdatedAt]);

  const mark = price ? price.markPrice.toNumber() / 1e6 : null;

  const group = useMemo(() => {
    const p = mark ?? 100;
    return Math.pow(10, Math.floor(Math.log10(p)) - 3) || 0.01;
  }, [mark]);
  const dp = priceDecimals(group);

  // measure the asks column so the ladder always fills the panel (no empty gap)
  const sideRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(8);
  useEffect(() => {
    const el = sideRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRows(Math.max(4, Math.floor(el.clientHeight / ROW_H))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const askLevels = orderbook ? grouped(orderbook.asks, group, "ask") : [];
  const bidLevels = orderbook ? grouped(orderbook.bids, group, "bid") : [];
  const asks = pad(askLevels, rows);
  const bids = pad(bidLevels, rows);
  const max = Math.max(askLevels[rows - 1]?.total ?? askLevels.at(-1)?.total ?? 0, bidLevels[rows - 1]?.total ?? bidLevels.at(-1)?.total ?? 0);
  const bestAsk = askLevels[0]?.price ?? null;
  const bestBid = bidLevels[0]?.price ?? null;
  const spread = bestAsk != null && bestBid != null ? bestAsk - bestBid : null;
  const spreadPct = spread != null && mark ? (spread / mark) * 100 : null;

  // bid/ask imbalance (visible size)
  const bidVol = bidLevels.slice(0, rows).reduce((s, l) => s + l.size, 0);
  const askVol = askLevels.slice(0, rows).reduce((s, l) => s + l.size, 0);
  const bidPct = bidVol + askVol > 0 ? (bidVol / (bidVol + askVol)) * 100 : 50;

  // flash the mid price on change
  const prevMark = useRef<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (mark != null && prevMark.current != null && mark !== prevMark.current) {
      setFlash(mark > prevMark.current ? "up" : "down");
      const t = setTimeout(() => setFlash(null), 350);
      prevMark.current = mark;
      return () => clearTimeout(t);
    }
    prevMark.current = mark;
  }, [mark]);

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 h-9 border-b border-line shrink-0">
        <h2 className="text-2xs uppercase tracking-wide text-muted">Order Book</h2>
        <span className="text-[9px] text-faint tnum">{ago < 60000 ? `${(ago / 1000).toFixed(1)}s` : "—"}</span>
      </div>

      <div className="grid grid-cols-[1.1fr_1fr_1fr] px-3 h-6 items-center text-[10px] uppercase tracking-wide text-faint shrink-0">
        <span>Price</span>
        <span className="text-right">Size ({symbol.split("-")[0]})</span>
        <span className="text-right">Total</span>
      </div>

      {/* asks (reversed so best ask sits just above the spread) */}
      <div ref={sideRef} className="flex-1 flex flex-col-reverse overflow-hidden min-h-0">
        {asks.map((l, i) => <Row key={l ? `a${l.price}` : `ae${i}`} l={l} side="ask" max={max} dp={dp} />)}
      </div>

      {/* spread / mark */}
      <div className="flex items-center justify-between px-3 h-9 border-y border-line bg-surface-2 shrink-0">
        <span
          className={`tnum font-mono text-base font-semibold transition-colors ${
            flash === "up" ? "text-long" : flash === "down" ? "text-short" : "text-txt"
          }`}
        >
          {mark != null ? mark.toFixed(dp) : "—"}
        </span>
        <div className="flex items-center gap-1.5 tnum font-mono text-[10px] text-faint">
          <span className="uppercase tracking-wide text-[9px]">Spread</span>
          <span className="text-muted">{spread != null ? spread.toFixed(dp) : "—"}</span>
          {spreadPct != null && <span>({spreadPct.toFixed(3)}%)</span>}
        </div>
      </div>

      {/* bids */}
      <div className="flex-1 overflow-hidden min-h-0">
        {bids.map((l, i) => <Row key={l ? `b${l.price}` : `be${i}`} l={l} side="bid" max={max} dp={dp} />)}
      </div>

      {/* imbalance */}
      <div className="px-3 py-2 border-t border-line shrink-0">
        <div className="flex items-center justify-between text-[10px] tnum font-mono mb-1">
          <span className="text-long">{bidPct.toFixed(0)}%</span>
          <span className="text-faint uppercase tracking-wide text-[9px]">Imbalance</span>
          <span className="text-short">{(100 - bidPct).toFixed(0)}%</span>
        </div>
        <div className="h-1 rounded-full bg-short/30 overflow-hidden flex">
          <div className="h-full bg-long rounded-r-none transition-[width] duration-300" style={{ width: `${bidPct}%` }} />
        </div>
      </div>
    </div>
  );
}
