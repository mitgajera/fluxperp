"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useTrading, type Candle } from "../lib/trading-context";

const BASE_SECONDS = 5;
const TIMEFRAMES: { label: string; seconds: number }[] = [
  { label: "5s", seconds: 5 },
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
  { label: "15m", seconds: 900 },
  { label: "1h", seconds: 3600 },
];

function aggregate(base: Candle[], tf: number): Candle[] {
  if (tf <= BASE_SECONDS) return base;
  const out: Candle[] = [];
  for (const c of base) {
    const bucket = Math.floor(c.time / tf) * tf;
    const last = out[out.length - 1];
    if (last && last.time === bucket) {
      last.high = Math.max(last.high, c.high);
      last.low = Math.min(last.low, c.low);
      last.close = c.close;
    } else {
      out.push({ time: bucket, open: c.open, high: c.high, low: c.low, close: c.close });
    }
  }
  return out;
}

export default function Chart() {
  const { candles, symbol } = useTrading();
  const [tf, setTf] = useState(60);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const data = useMemo(() => aggregate(candles, tf), [candles, tf]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0e0e10" },
        textColor: "#8a8a8a",
        fontFamily: "var(--font-geist-mono), monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#16161a" },
        horzLines: { color: "#16161a" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: "#1c1c20",
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
      timeScale: {
        borderColor: "#1c1c20",
        timeVisible: true,
        secondsVisible: true,
        barSpacing: 8,
        minBarSpacing: 2,
        rightOffset: 6,
      },
      autoSize: true,
    });
    const series = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      priceFormat: { type: "price", precision: 3, minMove: 0.001 },
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || data.length === 0) return;
    seriesRef.current.setData(
      data.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );
  }, [data]);

  // on timeframe switch, jump back to the latest bars (keep the fixed bar width)
  useEffect(() => {
    chartRef.current?.timeScale().scrollToRealTime();
  }, [tf]);

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 h-9 border-b border-line shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-2xs uppercase tracking-wide text-muted">{symbol}</h2>
          <div className="flex gap-0.5">
            {TIMEFRAMES.map((t) => (
              <button
                key={t.label}
                onClick={() => setTf(t.seconds)}
                className={`px-1.5 h-5 grid place-items-center rounded text-2xs tabular-nums transition-colors cursor-pointer ${
                  tf === t.seconds ? "bg-surface-3 text-txt" : "text-faint hover:text-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <span className="text-2xs text-faint">PriceFeed ticks</span>
      </div>
      {data.length === 0 && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <span className="text-2xs text-faint">waiting for price ticks…</span>
        </div>
      )}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
