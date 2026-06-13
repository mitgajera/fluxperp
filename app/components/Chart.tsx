"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useTrading } from "../lib/trading-context";

export default function Chart() {
  const { candles, symbol } = useTrading();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0e0e10" },
        textColor: "#8a8a8a",
        fontFamily: "var(--font-geist-mono), monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#16161a" },
        horzLines: { color: "#16161a" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#1c1c20" },
      timeScale: { borderColor: "#1c1c20", timeVisible: true, secondsVisible: true },
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
    if (!seriesRef.current || candles.length === 0) return;
    seriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );
  }, [candles]);

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 h-9 border-b border-line shrink-0">
        <h2 className="text-2xs uppercase tracking-wide text-muted">{symbol} · 5s</h2>
        <span className="text-2xs text-faint">PriceFeed ticks</span>
      </div>
      {candles.length === 0 && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <span className="text-2xs text-faint">waiting for price ticks…</span>
        </div>
      )}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
