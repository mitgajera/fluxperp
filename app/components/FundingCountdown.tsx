"use client";

import { useEffect, useRef, useState } from "react";
import { useTrading } from "../lib/trading-context";

const INTERVAL = 3600; // 1h funding period
const SAMPLE_MS = 8000; // re-sample funding every 8s (not every render)
const EMA = 0.18; // gentle pull toward target so the rate drifts, not flickers

export default function FundingCountdown() {
  const { orderbook, price } = useTrading();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [rateBps, setRateBps] = useState(0);

  // keep latest feed/book in a ref so the slow sampler reads current values
  const live = useRef({ orderbook, price });
  live.current = { orderbook, price };

  // 1s tick — only for the countdown, does NOT move the rate
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // slow funding sampler: target from premium + book skew, eased via EMA
  useEffect(() => {
    const sample = () => {
      const { orderbook: ob, price: pf } = live.current;
      const mark = pf ? pf.markPrice.toNumber() : 0;
      const index = pf ? pf.indexPrice.toNumber() : 0;
      const premiumBps = index > 0 ? ((mark - index) / index) * 10000 : 0;

      const bidVol = ob ? ob.bids.reduce((s, o) => s + o.size.toNumber(), 0) : 0;
      const askVol = ob ? ob.asks.reduce((s, o) => s + o.size.toNumber(), 0) : 0;
      const imbalance = bidVol + askVol > 0 ? (bidVol - askVol) / (bidVol + askVol) : 0;
      const skewBps = imbalance * 30;

      const onchainBps = ob ? ob.fundingRateBps.toNumber() : 0;
      const target = Math.max(-60, Math.min(60, premiumBps * 0.5 + skewBps * 0.4 + onchainBps * 0.1));
      setRateBps((prev) => prev + (target - prev) * EMA);
    };
    sample();
    const t = setInterval(sample, SAMPLE_MS);
    return () => clearInterval(t);
  }, []);

  const last = orderbook ? orderbook.lastFundingTs.toNumber() : now;
  const remaining = Math.max(0, INTERVAL - ((now - last) % INTERVAL));
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const rateColor = rateBps > 0.01 ? "text-long" : rateBps < -0.01 ? "text-short" : "text-muted";

  return (
    <div className="flex items-baseline gap-2">
      <span className={`tnum font-mono text-sm ${rateColor}`}>
        {rateBps >= 0 ? "+" : "−"}
        {(Math.abs(rateBps) / 100).toFixed(4)}%
      </span>
      <span className="tnum font-mono text-2xs text-faint">
        {mm}:{ss}
      </span>
    </div>
  );
}
