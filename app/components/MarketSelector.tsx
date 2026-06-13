"use client";

import { useState } from "react";
import { useTrading } from "../lib/trading-context";

const MARKETS = [
  { index: 0, symbol: "SOL-PERP" },
  { index: 1, symbol: "BTC-PERP" },
];

export default function MarketSelector() {
  const { market, symbol, setMarket } = useTrading();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 cursor-pointer group"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-long font-semibold text-sm drop-shadow-[0_0_6px_rgba(57,255,20,0.4)]">{symbol}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-faint group-hover:text-muted transition-colors" aria-hidden>
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <ul
            role="listbox"
            className="absolute left-0 top-8 z-20 w-40 rounded-md border border-line bg-surface-2 py-1 shadow-xl"
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
                  className={`w-full text-left px-3 h-8 text-sm transition-colors cursor-pointer flex items-center justify-between ${
                    market === m.index ? "text-long" : "text-muted hover:text-txt hover:bg-white/[0.03]"
                  }`}
                >
                  {m.symbol}
                  {market === m.index && <span className="h-1.5 w-1.5 rounded-full bg-long" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
