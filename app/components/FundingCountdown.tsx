"use client";

import { useEffect, useState } from "react";
import { useTrading } from "../lib/trading-context";

const INTERVAL = 3600;

export default function FundingCountdown() {
  const { orderbook } = useTrading();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const rateBps = orderbook ? orderbook.fundingRateBps.toNumber() : 0;
  const last = orderbook ? orderbook.lastFundingTs.toNumber() : now;
  const remaining = Math.max(0, INTERVAL - ((now - last) % INTERVAL));
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const rateColor = rateBps > 0 ? "text-long" : rateBps < 0 ? "text-short" : "text-muted";

  return (
    <div className="flex items-baseline gap-2">
      <span className={`tnum font-mono text-sm ${rateColor}`}>
        {rateBps >= 0 ? "+" : ""}
        {(rateBps / 100).toFixed(4)}%
      </span>
      <span className="tnum font-mono text-2xs text-faint">{mm}:{ss}</span>
    </div>
  );
}
