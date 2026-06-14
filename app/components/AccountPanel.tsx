"use client";

import { useState } from "react";
import { useTrading } from "../lib/trading-context";
import { px, sz, signedUsd, usd } from "../lib/format";
import { TokenIcon } from "./TokenIcon";

type Tab = "positions" | "orders" | "triggers" | "fills" | "funding";

const TABS: { id: Tab; label: string }[] = [
  { id: "positions", label: "Positions" },
  { id: "orders", label: "Open Orders" },
  { id: "triggers", label: "Triggers" },
  { id: "fills", label: "Fill History" },
  { id: "funding", label: "Funding & Fees" },
];

export default function AccountPanel() {
  const { position, orderbook, triggers, price, fills, collateral, sessionPubkey, cancel, closeAll, removeTrigger, symbol } =
    useTrading();
  const [tab, setTab] = useState<Tab>("positions");

  const mark = price ? price.markPrice.toNumber() / 1e6 : 0;
  const myKey = sessionPubkey?.toBase58();
  const hasPos = !!position && !("flat" in position.side);

  const myOrders = orderbook
    ? [
        ...orderbook.bids.map((o) => ({ o, side: "bid" as const })),
        ...orderbook.asks.map((o) => ({ o, side: "ask" as const })),
      ].filter((x) => x.o.owner.toBase58() === myKey)
    : [];

  const myFills = myKey
    ? fills.filter((f) => f.taker.toBase58() === myKey || f.maker.toBase58() === myKey)
    : [];

  const counts: Record<Tab, number | null> = {
    positions: hasPos ? 1 : 0,
    orders: myOrders.length,
    triggers: triggers?.triggers.length ?? 0,
    fills: myFills.length,
    funding: null,
  };

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      <div className="flex border-b border-line shrink-0 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 h-9 text-2xs uppercase tracking-wide transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
              tab === t.id ? "text-txt border-long" : "text-faint border-transparent hover:text-muted"
            }`}
          >
            {t.label}
            {counts[t.id] != null && counts[t.id]! > 0 && <span className="ml-1 text-faint">({counts[t.id]})</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {tab === "positions" && <Positions position={position} mark={mark} hasPos={hasPos} symbol={symbol} onClose={closeAll} />}
        {tab === "orders" && <Orders orders={myOrders} symbol={symbol} onCancel={cancel} />}
        {tab === "triggers" && <Triggers triggers={triggers?.triggers ?? []} symbol={symbol} onCancel={removeTrigger} />}
        {tab === "fills" && <Fills fills={myFills} myKey={myKey} symbol={symbol} />}
        {tab === "funding" && <Funding collateral={collateral} orderbook={orderbook} />}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="grid place-items-center h-full min-h-[80px] text-2xs text-faint">{children}</div>;
}

function HeadRow({ cols }: { cols: string[] }) {
  return (
    <div
      className="grid px-4 h-7 items-center text-[10px] uppercase tracking-wide text-faint border-b border-line/50 sticky top-0 bg-surface-1 z-10"
      style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr))` }}
    >
      {cols.map((c, i) => (
        <span key={c} className={i === 0 ? "" : "text-right"}>
          {c}
        </span>
      ))}
    </div>
  );
}

function Positions({
  position,
  mark,
  hasPos,
  symbol,
  onClose,
}: {
  position: any;
  mark: number;
  hasPos: boolean;
  symbol: string;
  onClose: () => void;
}) {
  if (!hasPos) return <Empty>No open positions</Empty>;
  const isLong = "long" in position.side;
  const sizeSol = position.size.toNumber() / 1e6;
  const entryUsd = position.entryPrice.toNumber() / 1e6;
  const marginUsd = position.marginAllocated.toNumber() / 1e6;
  const upnl = (isLong ? mark - entryUsd : entryUsd - mark) * sizeSol;
  const upnlPct = marginUsd > 0 ? (upnl / marginUsd) * 100 : 0;
  // isolated-style liquidation: price at which loss == allocated margin
  const liq = sizeSol > 0 ? (isLong ? entryUsd - marginUsd / sizeSol : entryUsd + marginUsd / sizeSol) : 0;
  const positive = upnl >= 0;

  return (
    <div>
      <HeadRow cols={["Market", "Size", "Entry", "Mark", "Liq. Price", "Margin", "uPnL", ""]} />
      <div className="grid px-4 h-12 items-center text-2xs hover:bg-white/[0.015]" style={{ gridTemplateColumns: "repeat(8, minmax(0,1fr))" }}>
        <div className="flex items-center gap-2">
          <TokenIcon symbol={symbol} size={16} />
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-txt">{symbol}</span>
            <span className={isLong ? "text-long text-[10px]" : "text-short text-[10px]"}>{isLong ? "LONG" : "SHORT"}</span>
          </div>
        </div>
        <span className="text-right tnum font-mono text-txt">{sizeSol.toFixed(3)}</span>
        <span className="text-right tnum font-mono text-muted">{entryUsd.toFixed(3)}</span>
        <span className="text-right tnum font-mono text-muted">{mark.toFixed(3)}</span>
        <span className="text-right tnum font-mono text-short">{liq > 0 ? liq.toFixed(3) : "—"}</span>
        <span className="text-right tnum font-mono text-muted">{usd(Math.round(marginUsd * 1e6))}</span>
        <span className={`text-right tnum font-mono ${positive ? "text-long" : "text-short"}`}>
          {signedUsd(Math.round(upnl * 1e6))} <span className="text-[10px]">({upnlPct >= 0 ? "+" : ""}{upnlPct.toFixed(1)}%)</span>
        </span>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-2.5 h-7 rounded-md bg-surface-2 border border-line text-[10px] uppercase tracking-wide text-muted hover:text-short hover:border-short/40 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Orders({ orders, symbol, onCancel }: { orders: { o: any; side: "bid" | "ask" }[]; symbol: string; onCancel: (id: any) => void }) {
  if (orders.length === 0) return <Empty>No open orders</Empty>;
  return (
    <div>
      <HeadRow cols={["Market", "Side", "Price", "Size", ""]} />
      {orders.map(({ o, side }) => (
        <div key={o.orderId.toString()} className="grid px-4 h-10 items-center text-2xs hover:bg-white/[0.015]" style={{ gridTemplateColumns: "repeat(5, minmax(0,1fr))" }}>
          <div className="flex items-center gap-2">
            <TokenIcon symbol={symbol} size={15} />
            <span className="font-medium text-txt">{symbol}</span>
          </div>
          <span className={`text-right font-semibold ${side === "bid" ? "text-long" : "text-short"}`}>{side === "bid" ? "BUY" : "SELL"}</span>
          <span className="text-right tnum font-mono text-muted">{px(o.price)}</span>
          <span className="text-right tnum font-mono text-txt">{sz(o.size)}</span>
          <div className="flex justify-end">
            <button
              onClick={() => onCancel(o.orderId)}
              className="px-2.5 h-7 rounded-md border border-line text-[10px] uppercase tracking-wide text-muted hover:text-short hover:border-short/40 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Triggers({ triggers, symbol, onCancel }: { triggers: any[]; symbol: string; onCancel: (t: any) => void }) {
  if (triggers.length === 0) return <Empty>No trigger orders</Empty>;
  return (
    <div>
      <HeadRow cols={["Market", "Type", "Trigger", "Size", ""]} />
      {triggers.map((t, i) => {
        const isSL = "stopLoss" in t.kind;
        return (
          <div key={i} className="grid px-4 h-10 items-center text-2xs hover:bg-white/[0.015]" style={{ gridTemplateColumns: "repeat(5, minmax(0,1fr))" }}>
            <div className="flex items-center gap-2">
              <TokenIcon symbol={symbol} size={15} />
              <span className="font-medium text-txt">{symbol}</span>
            </div>
            <span className={`text-right font-semibold ${isSL ? "text-short" : "text-long"}`}>{isSL ? "STOP-LOSS" : "TAKE-PROFIT"}</span>
            <span className="text-right tnum font-mono text-muted">{px(t.triggerPrice)}</span>
            <span className="text-right tnum font-mono text-txt">{sz(t.size)}</span>
            <div className="flex justify-end">
              <button
                onClick={() => onCancel(t)}
                className="px-2.5 h-7 rounded-md border border-line text-[10px] uppercase tracking-wide text-muted hover:text-short hover:border-short/40 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Fills({ fills, myKey, symbol }: { fills: any[]; myKey?: string; symbol: string }) {
  if (fills.length === 0) return <Empty>No fills yet</Empty>;
  return (
    <div>
      <HeadRow cols={["Market", "Side", "Price", "Size", "Role", "Time"]} />
      {fills.slice(0, 60).map((f, i) => {
        const taker = f.taker.toBase58() === myKey;
        const isBuy = taker ? "long" in f.takerSide : !("long" in f.takerSide);
        return (
          <div key={`${f.sequence.toString()}-${i}`} className="grid px-4 h-9 items-center text-2xs hover:bg-white/[0.015]" style={{ gridTemplateColumns: "repeat(6, minmax(0,1fr))" }}>
            <div className="flex items-center gap-2">
              <TokenIcon symbol={symbol} size={15} />
              <span className="font-medium text-txt">{symbol}</span>
            </div>
            <span className={`text-right font-semibold ${isBuy ? "text-long" : "text-short"}`}>{isBuy ? "BUY" : "SELL"}</span>
            <span className="text-right tnum font-mono text-muted">{px(f.price)}</span>
            <span className="text-right tnum font-mono text-txt">{sz(f.size)}</span>
            <span className="text-right text-faint">{taker ? "Taker" : "Maker"}</span>
            <span className="text-right tnum font-mono text-faint">
              {new Date(f.ts.toNumber() * 1000).toLocaleTimeString([], { hour12: false })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Funding({ collateral, orderbook }: { collateral: any; orderbook: any }) {
  if (!collateral) return <Empty>Start a session to see account flows</Empty>;
  const fundingPaid = collateral.fundingPaid?.toNumber?.() ?? 0;
  const feesPaid = collateral.feesPaid?.toNumber?.() ?? 0;
  const realized = collateral.realizedPnl?.toNumber?.() ?? 0;
  const deposited = collateral.deposited?.toNumber?.() ?? 0;
  const rateBps = orderbook ? orderbook.fundingRateBps.toNumber() : 0;

  const Cell = ({ label, value, cls }: { label: string; value: string; cls?: string }) => (
    <div className="flex flex-col gap-1 rounded-md border border-line bg-surface-2 px-4 py-3">
      <span className="text-[10px] uppercase tracking-wide text-faint">{label}</span>
      <span className={`tnum font-mono text-sm ${cls ?? "text-txt"}`}>{value}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 p-3">
      <Cell label="Deposited" value={usd(deposited)} />
      <Cell label="Realized PnL" value={signedUsd(realized)} cls={realized >= 0 ? "text-long" : "text-short"} />
      <Cell label="Fees Paid" value={usd(feesPaid)} cls="text-muted" />
      <Cell label="Funding Paid" value={signedUsd(fundingPaid)} cls={fundingPaid <= 0 ? "text-long" : "text-short"} />
      <Cell label="Funding Rate · 1h" value={`${rateBps >= 0 ? "+" : ""}${(rateBps / 100).toFixed(4)}%`} cls={rateBps >= 0 ? "text-long" : "text-short"} />
    </div>
  );
}
