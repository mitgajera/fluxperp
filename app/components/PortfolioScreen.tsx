"use client";

import { useState } from "react";
import Link from "next/link";
import { useTrading } from "../lib/trading-context";
import { px, sz, usd, signedUsd } from "../lib/format";
import type { PortfolioMargin } from "../lib/portfolio";
import SessionKeyButton from "./SessionKeyButton";
import FillToast from "./FillToast";

const usdf = (n: number) => usd(Math.round(n * 1e6));

export default function PortfolioScreen() {
  const { collateral, position, price, fills, sessionPubkey, deposit, withdraw, txStatus, portfolioMargin } = useTrading();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<"deposit" | "withdraw" | null>(null);

  const mark = price ? price.markPrice.toNumber() : 0;
  const c = collateral;
  const hasPos = !!position && !("flat" in position.side);
  const upnl = hasPos
    ? (("long" in position!.side ? mark - position!.entryPrice.toNumber() : position!.entryPrice.toNumber() - mark) *
        position!.size.toNumber()) /
      1e6
    : 0;

  const myFills = fills.filter(
    (f) => f.maker.toBase58() === sessionPubkey?.toBase58() || f.taker.toBase58() === sessionPubkey?.toBase58()
  );

  const run = async (kind: "deposit" | "withdraw") => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    setBusy(kind);
    try {
      await (kind === "deposit" ? deposit(n) : withdraw(n));
      setAmount("");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 text-txt">
      <header className="h-12 flex items-center gap-6 px-4 border-b border-line bg-surface-1">
        <Link href="/" className="text-long font-bold tracking-tight text-base drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]">
          FluxPerp
        </Link>
        <nav className="flex items-center gap-1 text-2xs">
          <Link href="/trade" className="px-3 h-7 grid place-items-center rounded text-faint hover:text-txt transition-colors">
            Trade
          </Link>
          <span className="px-3 h-7 grid place-items-center rounded bg-surface-3 text-txt">Portfolio</span>
          <Link href="/leaderboard" className="px-3 h-7 grid place-items-center rounded text-faint hover:text-txt transition-colors">
            Leaderboard
          </Link>
        </nav>
        <div className="ml-auto">
          <SessionKeyButton />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <h1 className="text-xl font-semibold">Portfolio</h1>

        {!sessionPubkey ? (
          <div className="panel p-10 text-center">
            <p className="text-muted text-sm mb-4">Start a trading session to view and manage your account.</p>
            <SessionKeyButton />
          </div>
        ) : (
          <>
            {}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Metric label="Deposited" value={c ? usd(c.deposited) : "—"} />
              <Metric label="Available" value={c ? usd(c.availableMargin) : "—"} accent />
              <Metric label="Margin Used" value={c ? usd(c.marginUsed) : "—"} />
              <Metric label="Realized PnL" value={c ? signedUsd(c.realizedPnl) : "—"} signed={c?.realizedPnl.toNumber()} />
              <Metric label="Fees (net)" value={c ? signedUsd(c.feesPaid) : "—"} hint="− = rebate" signed={c ? -c.feesPaid.toNumber() : 0} />
              <Metric label="Funding (net)" value={c ? signedUsd(c.fundingPaid) : "—"} signed={c ? -c.fundingPaid.toNumber() : 0} />
            </div>

            {}
            <PortfolioMarginPanel pm={portfolioMargin} />

            {}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Panel title="Open Position">
                  {!hasPos ? (
                    <Empty>No open position</Empty>
                  ) : (
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <KV label="Side / Size" value={`${"long" in position!.side ? "LONG" : "SHORT"} ${sz(position!.size)}`} color={"long" in position!.side ? "text-long" : "text-short"} />
                      <KV label="Entry" value={px(position!.entryPrice)} />
                      <KV label="Mark" value={px(mark)} />
                      <KV label="uPnL" value={signedUsd(Math.round(upnl * 1e6))} color={upnl >= 0 ? "text-long" : "text-short"} />
                    </div>
                  )}
                </Panel>

                <Panel title={`Fill History (${myFills.length})`}>
                  {myFills.length === 0 ? (
                    <Empty>No fills yet</Empty>
                  ) : (
                    <div className="max-h-72 overflow-y-auto divide-y divide-line/60">
                      <div className="grid grid-cols-4 px-4 h-7 items-center text-2xs uppercase text-faint sticky top-0 bg-surface-1">
                        <span>Role</span>
                        <span className="text-right">Price</span>
                        <span className="text-right">Size</span>
                        <span className="text-right">Time</span>
                      </div>
                      {myFills.map((f, i) => {
                        const maker = f.maker.toBase58() === sessionPubkey?.toBase58();
                        return (
                          <div key={i} className="grid grid-cols-4 px-4 h-9 items-center font-mono text-2xs tabular-nums">
                            <span className={maker ? "text-long" : "text-muted"}>{maker ? "Maker" : "Taker"}</span>
                            <span className="text-right">{px(f.price)}</span>
                            <span className="text-right text-muted">{sz(f.size)}</span>
                            <span className="text-right text-faint">{new Date(f.ts.toNumber() * 1000).toLocaleTimeString([], { hour12: false })}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Panel>
              </div>

              {}
              <Panel title="Deposit / Withdraw">
                <div className="p-4 space-y-3">
                  <label className="flex items-center justify-between bg-surface-2 border border-line rounded-md px-3 h-11">
                    <span className="text-2xs text-faint">Amount (USDC)</span>
                    <input
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-24 bg-transparent text-right tnum font-mono text-sm text-txt outline-none"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => run("deposit")}
                      disabled={!!busy}
                      className="flex-1 h-10 rounded-md bg-long/15 text-long border border-long/40 text-sm font-semibold hover:bg-long/25 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      {busy === "deposit" ? "…" : "Deposit"}
                    </button>
                    <button
                      onClick={() => run("withdraw")}
                      disabled={!!busy}
                      className="flex-1 h-10 rounded-md bg-surface-2 border border-line text-sm font-semibold text-txt hover:border-line-strong transition-colors cursor-pointer disabled:opacity-40"
                    >
                      {busy === "withdraw" ? "…" : "Withdraw"}
                    </button>
                  </div>

                  {txStatus && (
                    <div className="flex items-center gap-2 text-2xs text-muted bg-surface-2 border border-line rounded-md px-3 py-2 animate-row-in">
                      <span className="h-1.5 w-1.5 rounded-full bg-long animate-pulse-dot" aria-hidden />
                      {txStatus}
                    </div>
                  )}
                  <p className="text-[10px] text-faint leading-relaxed">
                    Withdraw walks the undelegate path: close position → commit &amp; undelegate to L1 → withdraw from the vault.
                  </p>
                </div>
              </Panel>
            </div>
          </>
        )}
      </main>
      <FillToast />
    </div>
  );
}

function PortfolioMarginPanel({ pm }: { pm: PortfolioMargin | null }) {
  const hedged = !!pm && pm.legs.length >= 2 && pm.marginSaved > 0;
  const healthPct = pm ? pm.accountHealthBps / 100 : 0;
  const healthColor = healthPct >= 20 ? "text-long" : healthPct >= 8 ? "text-amber-400" : "text-short";
  return (
    <Panel title="Portfolio Margin — cross-market netting (§A6)">
      {!pm || pm.legs.length === 0 ? (
        <Empty>No open positions across markets</Empty>
      ) : (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KV label="Gross Notional" value={usdf(pm.grossNotional)} />
            <KV label="Net Notional" value={usdf(pm.netNotional)} />
            <KV
              label="Margin Saved"
              value={`${usdf(pm.marginSaved)} (${pm.savedPct.toFixed(1)}%)`}
              color={hedged ? "text-long" : "text-muted"}
            />
            <KV label="Account Health" value={`${healthPct.toFixed(1)}%`} color={healthColor} />
          </div>

          <div className="flex items-center gap-3 text-2xs">
            <span className="text-faint">Naive margin</span>
            <span className="tnum font-mono text-muted line-through">{usdf(pm.marginNaive)}</span>
            <span className="text-faint">→ Net requirement</span>
            <span className="tnum font-mono text-long text-sm">{usdf(pm.marginRequired)}</span>
            {hedged && (
              <span className="ml-auto px-2 py-0.5 rounded bg-long/15 text-long border border-long/30 uppercase tracking-wide">
                Hedged · 20% offset credit
              </span>
            )}
          </div>

          <div className="divide-y divide-line/60 border-t border-line/60">
            <div className="grid grid-cols-4 h-7 items-center text-2xs uppercase text-faint">
              <span>Market</span>
              <span className="text-right">Side</span>
              <span className="text-right">Notional</span>
              <span className="text-right">uPnL</span>
            </div>
            {pm.legs.map((l) => (
              <div key={l.market} className="grid grid-cols-4 h-9 items-center font-mono text-2xs tabular-nums">
                <span className="text-txt">{l.symbol}-PERP</span>
                <span className={`text-right ${l.side === "long" ? "text-long" : "text-short"}`}>{l.side.toUpperCase()}</span>
                <span className="text-right text-muted">{usdf(l.notional)}</span>
                <span className={`text-right ${l.upnl >= 0 ? "text-long" : "text-short"}`}>{signedUsd(Math.round(l.upnl * 1e6))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function Metric({ label, value, accent, hint, signed }: { label: string; value: string; accent?: boolean; hint?: string; signed?: number }) {
  const color = signed === undefined ? (accent ? "text-long" : "text-txt") : signed > 0 ? "text-long" : signed < 0 ? "text-short" : "text-txt";
  return (
    <div className="panel p-3">
      <div className="text-2xs uppercase tracking-wide text-faint flex items-center gap-1">
        {label} {hint && <span className="text-[9px] text-faint/70">({hint})</span>}
      </div>
      <div className={`tnum font-mono text-lg mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel overflow-hidden">
      <div className="px-4 h-9 flex items-center border-b border-line text-2xs uppercase tracking-wide text-muted">{title}</div>
      {children}
    </div>
  );
}

function KV({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-2xs text-faint">{label}</span>
      <span className={`tnum font-mono text-sm ${color ?? "text-txt"}`}>{value}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="grid place-items-center h-24 text-2xs text-faint">{children}</div>;
}
