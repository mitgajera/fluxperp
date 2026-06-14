"use client";

import { useEffect, useState } from "react";
import { erConnection, l1Connection, subscribePriceFeed, erPing } from "../lib/er";
import { insurancePda } from "../lib/program";
import { decodeInsurance } from "../lib/deserialize";
import { px, usd } from "../lib/format";
import type { PriceFeed } from "../lib/types";

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center px-6 py-4">
      <span className={`tnum font-mono text-2xl ${accent ? "text-long drop-shadow-[0_0_10px_rgba(46,189,133,0.4)]" : "text-txt"}`}>
        {value}
      </span>
      <span className="text-2xs uppercase tracking-wider text-faint mt-1">{label}</span>
    </div>
  );
}

export default function LandingStats() {
  const [price, setPrice] = useState<PriceFeed | null>(null);
  const [insurance, setInsurance] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const er = erConnection();
    const l1 = l1Connection();
    const unsub = subscribePriceFeed(er, 0, setPrice);
    l1.getAccountInfo(insurancePda())
      .then((info) => info && setInsurance(decodeInsurance(info.data).balance.toNumber()))
      .catch(() => {});
    const ping = setInterval(async () => {
      try {
        setLatency(await erPing(er));
      } catch {}
    }, 3000);
    return () => {
      unsub();
      clearInterval(ping);
    };
  }, []);

  return (
    <div className="inline-flex items-stretch divide-x divide-line rounded-xl border border-line bg-surface-1/70 backdrop-blur">
      {/* <Stat label="SOL-PERP Mark" value={price ? px(price.markPrice, 2) : "—"} accent />
      <Stat label="ER Latency" value={latency != null ? `${latency}ms` : "—"} />
      <Stat label="Insurance Fund" value={insurance != null ? usd(insurance) : "—"} />
      <Stat label="Settlement" value="Solana L1" /> */}
    </div>
  );
}
