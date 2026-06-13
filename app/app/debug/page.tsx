"use client";

import { useEffect, useRef, useState } from "react";
import {
  erConnection,
  subscribeOrderbook,
  subscribePriceFeed,
  erPing,
  ER_RPC,
} from "../../lib/er";
import { MARKET_SOL } from "../../lib/program";
import { toUi, type OrderbookState, type PriceFeed, type Order } from "../../lib/types";

export default function DebugPage() {
  const [price, setPrice] = useState<PriceFeed | null>(null);
  const [book, setBook] = useState<OrderbookState | null>(null);
  const [priceTicks, setPriceTicks] = useState(0);
  const [bookTicks, setBookTicks] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("—");
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;

    mounted.current = true;
    const conn = erConnection();
    const u1 = subscribePriceFeed(conn, MARKET_SOL, (pf) => {
      setPrice(pf);
      setPriceTicks((n) => n + 1);
      setLastUpdate(new Date().toLocaleTimeString());
    });
    const u2 = subscribeOrderbook(conn, MARKET_SOL, (ob) => {
      setBook(ob);
      setBookTicks((n) => n + 1);
    });
    const ping = setInterval(async () => {
      try {
        setLatency(await erPing(conn));
      } catch {}
    }, 3000);
    return () => {
      u1();
      u2();
      clearInterval(ping);
    };
  }, []);

  const asks = (book?.asks ?? []).slice().sort((a, b) => b.price.cmp(a.price));

  const bids = (book?.bids ?? []).slice().sort((a, b) => b.price.cmp(a.price));

  const Row = ({ o, color }: { o: Order; color: string }) => (
    <div className="flex justify-between font-mono text-sm">
      <span className={color}>{toUi(o.price).toFixed(3)}</span>
      <span className="text-neutral-400">{toUi(o.size, 1_000_000).toFixed(3)}</span>
      <span className="text-neutral-600 text-xs">{o.owner.toBase58().slice(0, 4)}</span>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-neutral-200 p-8 font-mono">
      <h1 className="text-xl mb-1">FluxPerp — connection layer debug</h1>
      <p className="text-xs text-neutral-500 mb-6">
        ER ws: {ER_RPC} · market 0 (SOL-PERP)
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8 text-sm">
        <Stat label="Mark" value={price ? toUi(price.markPrice).toFixed(3) : "—"} accent />
        <Stat label="Index" value={price ? toUi(price.indexPrice).toFixed(3) : "—"} />
        <Stat label="Last trade" value={book ? toUi(book.lastTradePrice).toFixed(3) : "—"} />
        <Stat label="ER latency" value={latency != null ? `${latency} ms` : "—"} />
        <Stat label="price ws ticks" value={String(priceTicks)} />
        <Stat label="book ws ticks" value={String(bookTicks)} />
      </div>
      <p className="text-xs text-neutral-500 mb-6">last ws update: {lastUpdate}</p>

      <div className="grid grid-cols-2 gap-8 max-w-2xl">
        <div>
          <h2 className="text-red-400 mb-2 text-sm">ASKS ({asks.length})</h2>
          {asks.length === 0 ? (
            <p className="text-neutral-600 text-sm">— empty —</p>
          ) : (
            asks.map((o) => <Row key={o.orderId.toString()} o={o} color="text-red-400" />)
          )}
        </div>
        <div>
          <h2 className="text-green-400 mb-2 text-sm">BIDS ({bids.length})</h2>
          {bids.length === 0 ? (
            <p className="text-neutral-600 text-sm">— empty —</p>
          ) : (
            bids.map((o) => <Row key={o.orderId.toString()} o={o} color="text-green-400" />)
          )}
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-neutral-800 rounded p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`text-lg ${accent ? "text-[#39ff14]" : "text-neutral-200"}`}>{value}</div>
    </div>
  );
}
