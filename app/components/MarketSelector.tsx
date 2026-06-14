"use client";

import { useEffect, useRef, useState } from "react";
import { useTrading } from "../lib/trading-context";
import { TokenIcon } from "./TokenIcon";

const MARKETS = [
  { index: 0, symbol: "SOL-PERP" },
  { index: 1, symbol: "BTC-PERP" },
];

export default function MarketSelector() {
  const { market, symbol, setMarket } = useTrading();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // anchor the menu with fixed positioning so it isn't clipped by the
  // StatsBar's overflow-x-auto (which also clips vertically per the CSS spec).
  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 cursor-pointer group rounded-md px-1.5 -mx-1.5 h-8 hover:bg-surface-2 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <TokenIcon symbol={symbol} size={18} />
        <span className="text-txt font-semibold text-sm tracking-tight">{symbol}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`text-faint group-hover:text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <ul
            role="listbox"
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-50 w-44 rounded-lg border border-line-strong bg-surface-2 p-1 shadow-2xl shadow-black/50 animate-row-in"
          >
            {MARKETS.map((m) => (
              <li key={m.index}>
                <button
                  role="option"
                  aria-selected={market === m.index}
                  onClick={() => {
                    setMarket(m.index);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-2 h-9 rounded-md text-sm transition-colors cursor-pointer flex items-center gap-2 ${
                    market === m.index ? "bg-surface-3 text-txt" : "text-muted hover:text-txt hover:bg-white/[0.03]"
                  }`}
                >
                  <TokenIcon symbol={m.symbol} size={18} />
                  <span className="font-medium">{m.symbol}</span>
                  {market === m.index && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-long" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
