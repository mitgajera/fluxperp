"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { l1Connection, subscribe } from "../lib/er";
import { leaderboardPda } from "../lib/program";
import { decodeLeaderboard } from "../lib/deserialize";
import { usd } from "../lib/format";
import type { Leaderboard } from "../lib/types";
import SessionKeyButton from "./SessionKeyButton";

const short = (k: { toBase58: () => string }) => {
  const s = k.toBase58();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
};
const isZero = (k: { toBase58: () => string }) => k.toBase58() === "11111111111111111111111111111111";
const hex = (bytes: number[], n = 8) =>
  bytes.slice(0, n).map((b) => b.toString(16).padStart(2, "0")).join("");
const bpsPct = (bps: number) => `${(bps / 100).toFixed(2)}%`;

function useCountdown(endTs: number) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, endTs - now);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return { left, label: `${mm}:${ss}` };
}

export default function LeaderboardScreen() {
  const [lb, setLb] = useState<Leaderboard | null>(null);

  useEffect(() => {
    const conn = l1Connection();
    let alive = true;
    conn.getAccountInfo(leaderboardPda()).then((i) => {
      if (alive && i) setLb(decodeLeaderboard(i.data as Buffer));
    });
    const unsub = subscribe(conn, leaderboardPda(), (d) => decodeLeaderboard(d as Buffer), (l) => setLb(l));
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const endTs = lb ? lb.endTs.toNumber() : 0;
  const { left, label } = useCountdown(endTs);
  const entries = lb?.entries ?? [];
  const history = useMemo(() => (lb ? [...lb.history].reverse() : []), [lb]);

  return (
    <div className="min-h-screen bg-surface-0 text-txt">
      <header className="h-12 flex items-center gap-6 px-4 border-b border-line bg-surface-1">
        <Link href="/" className="text-long font-bold tracking-tight text-base drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]">
          FluxPerp
        </Link>
        <nav className="flex items-center gap-1 text-2xs">
          <Link href="/trade" className="px-3 h-7 grid place-items-center rounded text-faint hover:text-txt transition-colors">Trade</Link>
          <Link href="/portfolio" className="px-3 h-7 grid place-items-center rounded text-faint hover:text-txt transition-colors">Portfolio</Link>
          <span className="px-3 h-7 grid place-items-center rounded bg-surface-3 text-txt">Leaderboard</span>
        </nav>
        <div className="ml-auto"><SessionKeyButton /></div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-semibold">Tournament</h1>
            <p className="text-2xs text-faint mt-1">
              Provably-fair lucky-trader draw via MagicBlock VRF · epoch {lb ? lb.epoch.toString() : "—"}
            </p>
          </div>
          <div className="flex gap-3">
            <Stat label="Prize Pool" value={lb ? usd(lb.prizePool.toNumber()) : "—"} accent />
            <Stat
              label={lb?.vrfPending ? "Drawing…" : left === 0 ? "Epoch Ended" : "Epoch Ends In"}
              value={lb?.vrfPending ? "VRF" : label}
              pulse={!!lb?.vrfPending}
            />
            <Stat label="Players" value={String(entries.length)} />
          </div>
        </div>

        {lb?.vrfPending && (
          <div className="panel p-3 flex items-center gap-2 text-2xs text-amber-300 border-amber-400/30">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse-dot" aria-hidden />
            MagicBlock VRF request in flight — {lb.candidates.length} profitable trader(s) entered in the draw.
          </div>
        )}

        {}
        <div className="panel overflow-hidden">
          <div className="px-4 h-9 flex items-center border-b border-line text-2xs uppercase tracking-wide text-muted">
            Live Ranking — by PnL%
          </div>
          {entries.length === 0 ? (
            <div className="grid place-items-center h-24 text-2xs text-faint">No entries yet this epoch</div>
          ) : (
            <div className="divide-y divide-line/60">
              <div className="grid grid-cols-12 px-4 h-7 items-center text-2xs uppercase text-faint">
                <span className="col-span-1">#</span>
                <span className="col-span-6">Trader</span>
                <span className="col-span-2 text-right">PnL%</span>
                <span className="col-span-3 text-right">Realized</span>
              </div>
              {entries.map((e, i) => {
                const pnl = e.pnlBps.toNumber();
                const winning = lb && !isZero(lb.winner) && lb.winner.toBase58() === e.trader.toBase58();
                return (
                  <div
                    key={e.trader.toBase58()}
                    className={`grid grid-cols-12 px-4 h-10 items-center font-mono text-2xs tabular-nums ${winning ? "bg-long/10" : ""}`}
                  >
                    <span className="col-span-1 text-faint">{i + 1}</span>
                    <span className="col-span-6 text-txt flex items-center gap-2">
                      {short(e.trader)}
                      {winning && <span className="px-1.5 py-0.5 rounded bg-long/20 text-long text-[9px] uppercase">Winner</span>}
                    </span>
                    <span className={`col-span-2 text-right ${pnl >= 0 ? "text-long" : "text-short"}`}>{bpsPct(pnl)}</span>
                    <span className="col-span-3 text-right text-muted">{usd(e.realizedPnl.toNumber())}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {}
        <div className="panel overflow-hidden">
          <div className="px-4 h-9 flex items-center border-b border-line text-2xs uppercase tracking-wide text-muted">
            Past Winners · VRF Proof
          </div>
          {history.length === 0 ? (
            <div className="grid place-items-center h-20 text-2xs text-faint">No tournaments settled yet</div>
          ) : (
            <div className="divide-y divide-line/60">
              <div className="grid grid-cols-12 px-4 h-7 items-center text-2xs uppercase text-faint">
                <span className="col-span-2">Epoch</span>
                <span className="col-span-4">Winner</span>
                <span className="col-span-2 text-right">Prize</span>
                <span className="col-span-1 text-right">Field</span>
                <span className="col-span-3 text-right">VRF proof</span>
              </div>
              {history.map((w, i) => (
                <div key={i} className="grid grid-cols-12 px-4 h-10 items-center font-mono text-2xs tabular-nums">
                  <span className="col-span-2 text-faint">#{w.epoch.toString()}</span>
                  <span className="col-span-4 text-txt">{short(w.winner)}</span>
                  <span className="col-span-2 text-right text-long">{usd(w.prize.toNumber())}</span>
                  <span className="col-span-1 text-right text-muted">{w.candidates}</span>
                  <span className="col-span-3 text-right text-faint" title={hex(w.vrfResult, 32)}>0x{hex(w.vrfResult)}…</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, accent, pulse }: { label: string; value: string; accent?: boolean; pulse?: boolean }) {
  return (
    <div className="panel px-3 py-2 min-w-[96px]">
      <div className="text-2xs uppercase tracking-wide text-faint">{label}</div>
      <div className={`tnum font-mono text-lg mt-0.5 ${accent ? "text-long" : "text-txt"} ${pulse ? "animate-pulse" : ""}`}>{value}</div>
    </div>
  );
}
