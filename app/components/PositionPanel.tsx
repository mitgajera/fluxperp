"use client";

import { useState } from "react";
import { useTrading } from "../lib/trading-context";
import { px, sz, signedUsd } from "../lib/format";
import Sparkline from "./Sparkline";
import ADLLight from "./ADLLight";

type Tab = "positions" | "orders" | "triggers";

export default function PositionPanel() {
  const { position, orderbook, triggers, price, candles, sessionPubkey, cancel, closeAll, removeTrigger, symbol } =
    useTrading();
  const [tab, setTab] = useState<Tab>("positions");

  const mark = price ? price.markPrice.toNumber() / 1e6 : 0;
  const myKey = sessionPubkey?.toBase58();
  const myOrders = orderbook
    ? [...orderbook.bids.map((o) => ({ o, side: "bid" as const })), ...orderbook.asks.map((o) => ({ o, side: "ask" as const }))].filter(
        (x) => x.o.owner.toBase58() === myKey
      )
    : [];

  const hasPos = !!position && !("flat" in position.side);
  const counts: Record<Tab, number> = {
    positions: hasPos ? 1 : 0,
    orders: myOrders.length,
    triggers: triggers?.triggers.length ?? 0,
  };

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      <div className="flex border-b border-line shrink-0">
        {(["positions", "orders", "triggers"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 h-9 text-2xs uppercase tracking-wide transition-colors cursor-pointer border-b-2 ${
              tab === t ? "text-txt border-long" : "text-faint border-transparent hover:text-muted"
            }`}
          >
            {t} {counts[t] > 0 && <span className="text-faint">({counts[t]})</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === "positions" && (
          <PositionList position={position} mark={mark} candles={candles.map((c) => c.close)} onClose={closeAll} hasPos={hasPos} symbol={symbol} />
        )}
        {tab === "orders" && (
          <OrderList orders={myOrders} onCancel={(id) => cancel(id)} />
        )}
        {tab === "triggers" && <TriggerList triggers={triggers?.triggers ?? []} onCancel={removeTrigger} />}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="grid place-items-center h-24 text-2xs text-faint">{children}</div>;
}

function PositionList({
  position,
  mark,
  candles,
  onClose,
  hasPos,
  symbol,
}: {
  position: any;
  mark: number;
  candles: number[];
  onClose: () => void;
  hasPos: boolean;
  symbol: string;
}) {
  if (!hasPos) return <Empty>No open positions</Empty>;
  const isLong = "long" in position.side;
  const size = position.size.toNumber();
  const entry = position.entryPrice.toNumber();
  const sizeSol = size / 1e6;
  const entryUsd = entry / 1e6;
  const marginUsd = position.marginAllocated.toNumber() / 1e6;
  const upnl = (isLong ? mark - entryUsd : entryUsd - mark) * sizeSol; // mark is already USD
  const upnlPct = marginUsd > 0 ? (upnl / marginUsd) * 100 : 0;

  const positive = upnl >= 0;

  return (
    <div className="p-2">
      <div className="rounded-md border border-line bg-surface-2 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{symbol}</span>
            <span className={`text-2xs px-1.5 py-0.5 rounded ${isLong ? "bg-long/15 text-long" : "bg-short/15 text-short"}`}>
              {isLong ? "LONG" : "SHORT"} {(size / 1e6).toFixed(3)}
            </span>
            <span className="flex items-center gap-1" title="Auto-deleverage queue rank">
              <span className="text-[9px] text-faint uppercase">ADL</span>
              <ADLLight side={isLong ? "long" : "short"} size={size} entry={entry} margin={position.marginAllocated.toNumber()} mark={mark * 1e6} />
            </span>
          </div>
          <Sparkline data={candles.slice(-24)} positive={positive} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-2xs">
          <Cell label="Entry" value={px(entry)} />
          <Cell label="Mark" value={mark.toFixed(3)} />
          <Cell
            label="uPnL"
            value={signedUsd(Math.round(upnl * 1e6))}
            valueClass={positive ? "text-long" : "text-short"}
            sub={`${upnlPct >= 0 ? "+" : ""}${upnlPct.toFixed(1)}%`}
          />
        </div>
        <button
          onClick={onClose}
          className="mt-3 w-full h-8 rounded-md bg-surface-3 border border-line text-2xs uppercase tracking-wide text-muted hover:text-short transition-colors cursor-pointer"
        >
          Close Position
        </button>
      </div>
    </div>
  );
}

function OrderList({ orders, onCancel }: { orders: { o: any; side: "bid" | "ask" }[]; onCancel: (id: any) => void }) {
  if (orders.length === 0) return <Empty>No open orders</Empty>;
  return (
    <div className="divide-y divide-line/60">
      {orders.map(({ o, side }) => (
        <div key={o.orderId.toString()} className="flex items-center justify-between px-3 h-10 hover:bg-white/[0.02]">
          <div className="flex flex-col leading-tight">
            <span className={`text-2xs font-semibold ${side === "bid" ? "text-long" : "text-short"}`}>
              {side === "bid" ? "BUY" : "SELL"} {sz(o.size)}
            </span>
            <span className="text-2xs text-faint tnum">@ {px(o.price)}</span>
          </div>
          <button
            onClick={() => onCancel(o.orderId)}
            className="text-2xs px-2 py-1 rounded border border-line text-muted hover:text-short hover:border-short/40 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      ))}
    </div>
  );
}

function TriggerList({ triggers, onCancel }: { triggers: any[]; onCancel: (t: any) => void }) {
  if (triggers.length === 0) return <Empty>No trigger orders</Empty>;
  return (
    <div className="divide-y divide-line/60">
      {triggers.map((t, i) => {
        const isSL = "stopLoss" in t.kind;
        return (
          <div key={i} className="flex items-center justify-between px-3 h-10 hover:bg-white/[0.02]">
            <div className="flex flex-col leading-tight">
              <span className={`text-2xs font-semibold ${isSL ? "text-short" : "text-long"}`}>
                {isSL ? "STOP-LOSS" : "TAKE-PROFIT"}
              </span>
              <span className="text-2xs text-faint tnum">
                {sz(t.size)} @ {px(t.triggerPrice)}
              </span>
            </div>
            <button
              onClick={() => onCancel(t)}
              className="text-2xs px-2 py-1 rounded border border-line text-muted hover:text-short hover:border-short/40 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Cell({ label, value, valueClass, sub }: { label: string; value: string; valueClass?: string; sub?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-faint">{label}</span>
      <span className={`tnum font-mono ${valueClass ?? "text-txt"}`}>{value}</span>
      {sub && <span className={`tnum text-[9px] ${valueClass ?? "text-faint"}`}>{sub}</span>}
    </div>
  );
}
