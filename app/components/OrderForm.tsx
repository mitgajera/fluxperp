"use client";

import { useEffect, useMemo, useState } from "react";
import { useTrading } from "../lib/trading-context";
import { usd } from "../lib/format";
import type { UiSide } from "../lib/trade-actions";

const TAKER_BPS = 5;
const MAKER_BPS = 2;

type AdvKind = "iceberg" | "twap" | "gtt";

export default function OrderForm() {
  const { price, collateral, position, sessionPubkey, submitOrder, submitAdvanced, reverse, scale, closeAll, startSession, market, symbol, riskEngine } = useTrading();
  const [mode, setMode] = useState<"standard" | "advanced">("standard");
  const [side, setSide] = useState<UiSide>("long");
  const [type, setType] = useState<"limit" | "market">("market");
  const [priceInput, setPriceInput] = useState("");
  const [size, setSize] = useState("");
  const [leverage, setLeverage] = useState(5);
  const [busy, setBusy] = useState(false);

  const [advKind, setAdvKind] = useState<AdvKind>("iceberg");
  const [advPrice, setAdvPrice] = useState("");
  const [advTotal, setAdvTotal] = useState("");
  const [advDisplay, setAdvDisplay] = useState("");
  const [advInterval, setAdvInterval] = useState("30");
  const [advExpiryMin, setAdvExpiryMin] = useState("60");

  const mark = price ? price.markPrice.toNumber() / 1e6 : 0;
  const maxLev = riskEngine ? riskEngine.leverageCap : 10;
  useEffect(() => {
    if (type === "limit" && !priceInput && mark) setPriceInput(mark.toFixed(3));
  }, [type, mark, priceInput]);
  useEffect(() => {
    if (leverage > maxLev) setLeverage(maxLev);
  }, [maxLev, leverage]);

  const effPrice = type === "market" ? mark : parseFloat(priceInput) || 0;
  const sizeNum = parseFloat(size) || 0;
  const notional = effPrice * sizeNum;
  const margin = leverage > 0 ? notional / leverage : 0;
  const feeBps = type === "market" ? TAKER_BPS : MAKER_BPS;
  const fee = (notional * feeBps) / 10000;
  const avail = collateral ? collateral.availableMargin.toNumber() / 1e6 : 0;
  const hasSession = !!sessionPubkey;
  const canPlace = hasSession && sizeNum > 0 && (type === "market" || effPrice > 0) && margin <= avail;
  const hasPosition = !!position && !("flat" in position.side);

  const submit = async () => {
    setBusy(true);
    try {
      await submitOrder({ market, side, type, price: effPrice, size: sizeNum });
      setSize("");
    } finally {
      setBusy(false);
    }
  };

  const advPriceNum = parseFloat(advPrice) || 0;
  const advTotalNum = parseFloat(advTotal) || 0;
  const advDisplayNum = parseFloat(advDisplay) || 0;
  const advIntervalNum = parseFloat(advInterval) || 0;
  const showsDisplay = advKind === "iceberg" || advKind === "twap";
  const showsInterval = advKind === "twap";
  const showsExpiry = advKind === "gtt";
  const advCanPlace =
    hasSession &&
    advPriceNum > 0 &&
    advTotalNum > 0 &&
    (!showsDisplay || (advDisplayNum > 0 && advDisplayNum <= advTotalNum)) &&
    (!showsInterval || advIntervalNum > 0);

  const submitAdv = async () => {
    setBusy(true);
    try {
      const expiry = showsExpiry ? Math.floor(Date.now() / 1000) + Math.round((parseFloat(advExpiryMin) || 0) * 60) : 0;
      const displaySize = showsDisplay ? advDisplayNum : advTotalNum;
      await submitAdvanced({
        side,
        kind: advKind,
        price: advPriceNum,
        totalSize: advTotalNum,
        displaySize,
        sliceInterval: showsInterval ? advIntervalNum : 0,
        expiry,
      });
      setAdvTotal("");
      setAdvDisplay("");
    } finally {
      setBusy(false);
    }
  };

  const sideBtn = (s: UiSide, label: string) => (
    <button
      onClick={() => setSide(s)}
      className={`flex-1 h-9 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
        side === s
          ? s === "long"
            ? "bg-long/15 text-long border border-long/40 shadow-glow-sm"
            : "bg-short/15 text-short border border-short/40"
          : "bg-surface-2 text-muted border border-line hover:text-txt"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="panel flex flex-col p-3 gap-3">
      <div className="flex gap-1 bg-surface-2 rounded-md p-0.5 border border-line">
        {(["standard", "advanced"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 h-7 rounded text-2xs uppercase tracking-wide transition-colors cursor-pointer ${
              mode === m ? "bg-surface-3 text-txt" : "text-faint hover:text-muted"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="flex gap-2">{sideBtn("long", "Long")}{sideBtn("short", "Short")}</div>

      {mode === "standard" ? (
      <>
      <div className="flex gap-1 bg-surface-2 rounded-md p-0.5 border border-line">
        {(["market", "limit"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`flex-1 h-7 rounded text-2xs uppercase tracking-wide transition-colors cursor-pointer ${
              type === t ? "bg-surface-3 text-txt" : "text-faint hover:text-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <Field label="Price (USDC)">
        <input
          inputMode="decimal"
          value={type === "market" ? "Market" : priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
          disabled={type === "market"}
          className="w-full bg-transparent text-right tnum font-mono text-sm text-txt outline-none disabled:text-faint"
          placeholder="0.000"
        />
      </Field>

      <Field label="Size (SOL)">
        <input
          inputMode="decimal"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          className="w-full bg-transparent text-right tnum font-mono text-sm text-txt outline-none"
          placeholder="0.000"
        />
      </Field>

      <div>
        <div className="flex justify-between text-2xs text-faint mb-1">
          <span>Leverage</span>
          <span className="tnum text-long">{leverage}×</span>
        </div>
        <input
          type="range"
          min={1}
          max={maxLev}
          step={1}
          value={Math.min(leverage, maxLev)}
          onChange={(e) => setLeverage(Number(e.target.value))}
          className="w-full accent-long cursor-pointer"
          aria-label="Leverage"
        />
        <div className="flex justify-between text-[9px] text-faint mt-0.5 tnum">
          {[1, 2, 5, 10].map((n) => (
            <span key={n}>{n}×</span>
          ))}
        </div>
      </div>

      <div className="text-2xs space-y-1 border-t border-line pt-2">
        <Preview label="Order Value" value={notional > 0 ? usd(Math.round(notional * 1e6)) : "—"} />
        <Preview label="Est. Margin" value={margin > 0 ? usd(Math.round(margin * 1e6)) : "—"} />
        <Preview label={`Est. Fee (${feeBps} bps)`} value={fee > 0 ? usd(Math.round(fee * 1e6)) : "—"} />
        <Preview label="Available" value={usd(Math.round(avail * 1e6))} muted />
      </div>

      {!hasSession ? (
        <button
          onClick={startSession}
          className="h-10 rounded-md bg-long text-black text-sm font-semibold hover:bg-long/90 transition-colors cursor-pointer shadow-glow-sm active:scale-[0.99]"
        >
          Start Trading Session
        </button>
      ) : (
        <button
          onClick={submit}
          disabled={!canPlace || busy}
          className={`h-10 rounded-md text-sm font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] ${
            side === "long"
              ? "bg-long text-black hover:bg-long/90 shadow-glow-sm"
              : "bg-short text-white hover:bg-short/90"
          }`}
        >
          {busy ? "Placing…" : `${side === "long" ? "Buy / Long" : "Sell / Short"} ${symbol}`}
        </button>
      )}

      {margin > avail && sizeNum > 0 && hasSession && (
        <p className="text-2xs text-short text-center">Insufficient margin</p>
      )}
      </>
      ) : (
      <>
        <div className="flex gap-1 bg-surface-2 rounded-md p-0.5 border border-line">
          {(["iceberg", "twap", "gtt"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setAdvKind(k)}
              className={`flex-1 h-7 rounded text-2xs uppercase tracking-wide transition-colors cursor-pointer ${
                advKind === k ? "bg-surface-3 text-txt" : "text-faint hover:text-muted"
              }`}
            >
              {k === "gtt" ? "GTT" : k}
            </button>
          ))}
        </div>

        <p className="text-[10px] text-faint leading-snug">
          {advKind === "iceberg"
            ? "Iceberg: only the display slice is visible on the book; the keeper reveals the next slice as each fills."
            : advKind === "twap"
            ? "TWAP: releases a display-size slice every interval until the full size is worked."
            : "GTT: a resting limit order auto-reaped after it expires."}
        </p>

        <Field label="Price (USDC)">
          <input
            inputMode="decimal"
            value={advPrice}
            onChange={(e) => setAdvPrice(e.target.value)}
            className="w-full bg-transparent text-right tnum font-mono text-sm text-txt outline-none"
            placeholder={mark ? mark.toFixed(3) : "0.000"}
          />
        </Field>

        <Field label="Total Size (SOL)">
          <input
            inputMode="decimal"
            value={advTotal}
            onChange={(e) => setAdvTotal(e.target.value)}
            className="w-full bg-transparent text-right tnum font-mono text-sm text-txt outline-none"
            placeholder="0.000"
          />
        </Field>

        {showsDisplay && (
          <Field label="Display Size (SOL)">
            <input
              inputMode="decimal"
              value={advDisplay}
              onChange={(e) => setAdvDisplay(e.target.value)}
              className="w-full bg-transparent text-right tnum font-mono text-sm text-txt outline-none"
              placeholder="0.000"
            />
          </Field>
        )}

        {showsInterval && (
          <Field label="Slice Interval (s)">
            <input
              inputMode="numeric"
              value={advInterval}
              onChange={(e) => setAdvInterval(e.target.value)}
              className="w-full bg-transparent text-right tnum font-mono text-sm text-txt outline-none"
              placeholder="30"
            />
          </Field>
        )}

        {showsExpiry && (
          <Field label="Expires In (min)">
            <input
              inputMode="numeric"
              value={advExpiryMin}
              onChange={(e) => setAdvExpiryMin(e.target.value)}
              className="w-full bg-transparent text-right tnum font-mono text-sm text-txt outline-none"
              placeholder="60"
            />
          </Field>
        )}

        <div className="text-2xs space-y-1 border-t border-line pt-2">
          <Preview
            label="Order Value"
            value={advPriceNum > 0 && advTotalNum > 0 ? usd(Math.round(advPriceNum * advTotalNum * 1e6)) : "—"}
          />
          {showsDisplay && (
            <Preview
              label="Visible / Hidden"
              value={advTotalNum > 0 ? `${advDisplayNum || 0} / ${Math.max(0, advTotalNum - (advDisplayNum || 0))}` : "—"}
            />
          )}
        </div>

        {!hasSession ? (
          <button
            onClick={startSession}
            className="h-10 rounded-md bg-long/15 text-long border border-long/40 text-sm font-semibold hover:bg-long/25 transition-colors cursor-pointer shadow-glow-sm"
          >
            Start Trading Session
          </button>
        ) : (
          <button
            onClick={submitAdv}
            disabled={!advCanPlace || busy}
            className={`h-10 rounded-md text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              side === "long" ? "bg-long text-black hover:bg-long/90 shadow-glow" : "bg-short text-white hover:bg-short/90"
            }`}
          >
            {busy ? "Placing…" : `Place ${advKind === "gtt" ? "GTT" : advKind === "twap" ? "TWAP" : "Iceberg"} ${side === "long" ? "Long" : "Short"}`}
          </button>
        )}
      </>
      )}

      {}
      <div className="flex gap-2">
        <button
          onClick={() => scale(false, 25)}
          disabled={!hasPosition || busy}
          className="flex-1 h-8 rounded-md bg-surface-2 border border-line text-2xs uppercase tracking-wide text-muted hover:text-short transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="Reduce 25% at market"
        >
          Scale −25%
        </button>
        <button
          onClick={() => scale(true, 25)}
          disabled={!hasPosition || busy}
          className="flex-1 h-8 rounded-md bg-surface-2 border border-line text-2xs uppercase tracking-wide text-muted hover:text-long transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="Add 25% at market"
        >
          Scale +25%
        </button>
      </div>
      <div className="flex gap-2">
        <button
          onClick={reverse}
          disabled={!hasPosition || busy}
          className="flex-1 h-8 rounded-md bg-surface-2 border border-line text-2xs uppercase tracking-wide text-muted hover:text-txt transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Reverse
        </button>
        <button
          onClick={closeAll}
          disabled={!hasPosition || busy}
          className="flex-1 h-8 rounded-md bg-surface-2 border border-line text-2xs uppercase tracking-wide text-muted hover:text-short transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Close All
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between bg-surface-2 border border-line rounded-md px-3 h-10 focus-within:border-line-strong transition-colors">
      <span className="text-2xs text-faint whitespace-nowrap mr-2">{label}</span>
      {children}
    </label>
  );
}

function Preview({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-faint">{label}</span>
      <span className={`tnum font-mono ${muted ? "text-muted" : "text-txt"}`}>{value}</span>
    </div>
  );
}
