"use client";

import { useEffect, useRef } from "react";

export interface ClosedTrade {
  market: string;
  side: "long" | "short";
  leverage: number;
  entry: number;
  exit: number;
  pnlPct: number;
  pnlUsd: number;
}

const W = 1200;
const H = 675;

export default function ShareCard({ trade, onClose }: { trade: ClosedTrade; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = 2;
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.scale(dpr, dpr);

    const win = trade.pnlPct >= 0;
    const green = "#2ebd85";
    const red = "#f6465d";
    const accent = win ? green : red;
    const accentRGB = win ? "46,189,133" : "246,70,93";
    const long = trade.side === "long";
    const sideRGB = long ? "46,189,133" : "246,70,93";
    const sideCol = long ? green : red;

    // backdrop
    ctx.fillStyle = "#0a0b0d";
    ctx.fillRect(0, 0, W, H);

    // single soft directional glow from the right edge — calm, not busy
    const glow = ctx.createRadialGradient(W - 80, 140, 40, W - 80, 140, 760);
    glow.addColorStop(0, `rgba(${accentRGB},0.14)`);
    glow.addColorStop(1, "rgba(10,11,13,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // inner hairline frame
    roundRect(ctx, 20, 20, W - 40, H - 40, 22);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const PAD = 72;
    ctx.textAlign = "left";

    // --- header: logo mark + wordmark ---
    roundRect(ctx, PAD, 66, 34, 34, 9);
    ctx.fillStyle = "rgba(46,189,133,0.14)";
    ctx.fill();
    ctx.fillStyle = green;
    bolt(ctx, PAD + 17, 83, 13);
    ctx.font = "700 27px system-ui, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#e8eaed";
    ctx.fillText("Flux", PAD + 46, 92);
    const fluxW = ctx.measureText("Flux").width;
    ctx.fillStyle = green;
    ctx.fillText("Perp", PAD + 46 + fluxW, 92);

    // ER badge (top-right)
    ctx.font = "600 14px system-ui, sans-serif";
    const badge = "ONCHAIN · MAGICBLOCK ER";
    const bw = ctx.measureText(badge).width + 30;
    roundRect(ctx, W - PAD - bw, 68, bw, 30, 15);
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#8b909c";
    ctx.fillText(badge, W - PAD - bw + 15, 87);

    // --- market + side pill (measured under the SAME font, so it never overlaps) ---
    const base = trade.market.split("-")[0].toUpperCase();
    const marketY = 200;
    drawToken(ctx, base, PAD + 16, marketY - 12, 32);
    ctx.font = "700 42px system-ui, sans-serif";
    ctx.fillStyle = "#e8eaed";
    const marketX = PAD + 46;
    ctx.fillText(trade.market, marketX, marketY);
    const marketW = ctx.measureText(trade.market).width;

    const pill = `${long ? "LONG" : "SHORT"} · ${trade.leverage}×`;
    ctx.font = "700 17px system-ui, sans-serif";
    const pillTextW = ctx.measureText(pill).width;
    const pillW = pillTextW + 28;
    const pillX = marketX + marketW + 20;
    const pillY = marketY - 27;
    roundRect(ctx, pillX, pillY, pillW, 32, 16);
    ctx.fillStyle = `rgba(${sideRGB},0.14)`;
    ctx.fill();
    ctx.fillStyle = sideCol;
    ctx.fillText(pill, pillX + 14, pillY + 21);

    // --- hero PnL% ---
    ctx.font = "500 16px system-ui, sans-serif";
    ctx.fillStyle = "#585d68";
    ctx.fillText("REALIZED PnL", PAD, 300);

    const pnlText = `${win ? "+" : "−"}${Math.abs(trade.pnlPct).toFixed(2)}%`;
    ctx.font = "800 124px system-ui, sans-serif";
    ctx.fillStyle = accent;
    if (win) {
      ctx.shadowColor = `rgba(${accentRGB},0.45)`;
      ctx.shadowBlur = 36;
    }
    ctx.fillText(pnlText, PAD - 4, 412);
    ctx.shadowBlur = 0;

    // $ amount
    ctx.font = "600 30px 'Geist Mono', ui-monospace, monospace";
    ctx.fillStyle = accent;
    ctx.fillText(`${win ? "+" : "−"}$${Math.abs(trade.pnlUsd).toFixed(2)}`, PAD, 458);

    // --- three aligned stat chips: ENTRY / EXIT / LEVERAGE ---
    const chipY = 506;
    const chipH = 88;
    const gap = 16;
    const chipW = (W - 2 * PAD - 2 * gap) / 3;
    statChip(ctx, PAD, chipY, chipW, chipH, "ENTRY", trade.entry.toFixed(3), "#e8eaed");
    statChip(ctx, PAD + chipW + gap, chipY, chipW, chipH, "EXIT", trade.exit.toFixed(3), accent);
    statChip(ctx, PAD + 2 * (chipW + gap), chipY, chipW, chipH, "LEVERAGE", `${trade.leverage}×`, "#e8eaed");

    // footer tagline (right)
    ctx.font = "400 16px system-ui, sans-serif";
    ctx.fillStyle = "#4b5059";
    ctx.textAlign = "right";
    ctx.fillText("Sub-100ms fills · settled on Solana · flux.perp", W - PAD, H - 56);
    ctx.textAlign = "left";
  }, [trade]);

  const download = () => {
    const url = canvasRef.current?.toDataURL("image/png");
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `fluxperp-${trade.side}-${trade.pnlPct.toFixed(1)}pct.png`;
    a.click();
  };

  const shareX = () => {
    const win = trade.pnlPct >= 0;
    const text = `${win ? "Closed +" : "Closed "}${trade.pnlPct.toFixed(2)}% on ${trade.market} ${trade.side.toUpperCase()} ${trade.leverage}x at @FluxPerp - fully onchain perps inside @magicblock's Ephemeral Rollup. Sub-100ms fills, settled on @solana.`;
    download();
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface-1 border border-line-strong rounded-2xl p-4 max-w-2xl w-full shadow-2xl shadow-black/60" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-semibold">Position closed</h2>
          <button onClick={onClose} className="text-faint hover:text-txt cursor-pointer h-7 w-7 grid place-items-center rounded-md hover:bg-surface-2 transition-colors" aria-label="Close">✕</button>
        </div>
        <canvas ref={canvasRef} style={{ aspectRatio: `${W} / ${H}` }} className="w-full rounded-xl border border-line" />
        <div className="flex gap-2 mt-4">
          <button
            onClick={download}
            className="flex-1 h-11 rounded-lg bg-surface-2 border border-line text-sm font-medium text-txt hover:border-line-strong transition-colors cursor-pointer"
          >
            Download PNG
          </button>
          <button
            onClick={shareX}
            className="flex-1 h-11 rounded-lg bg-long text-black font-semibold text-sm hover:bg-long/90 transition-colors cursor-pointer shadow-glow-sm active:scale-[0.99]"
          >
            Share on X
          </button>
        </div>
      </div>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function statChip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, value: string, valueColor: string) {
  roundRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = "600 15px system-ui, sans-serif";
  ctx.fillStyle = "#585d68";
  ctx.fillText(label, x + 22, y + 32);
  ctx.font = "600 38px 'Geist Mono', ui-monospace, monospace";
  ctx.fillStyle = valueColor;
  ctx.fillText(value, x + 22, y + 70);
}

function bolt(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.save();
  ctx.translate(cx - s / 2, cy - s / 2);
  ctx.scale(s / 24, s / 24);
  ctx.beginPath();
  ctx.moveTo(13.2, 4);
  ctx.lineTo(7, 13.2);
  ctx.lineTo(10.7, 13.2);
  ctx.lineTo(9.7, 20);
  ctx.lineTo(16.8, 10.4);
  ctx.lineTo(12.7, 10.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawToken(ctx: CanvasRenderingContext2D, base: string, cx: number, cy: number, size: number) {
  if (base === "SOL") {
    const g = ctx.createLinearGradient(cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2);
    g.addColorStop(0, "#9945FF");
    g.addColorStop(1, "#19FB9B");
    ctx.fillStyle = g;
    const w = size * 0.92;
    const h = size * 0.18;
    const skew = size * 0.18;
    const gap = size * 0.14;
    for (let i = -1; i <= 1; i++) {
      const y = cy + i * (h + gap);
      const dir = i === 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2 + (dir < 0 ? skew : 0), y - h / 2);
      ctx.lineTo(cx + w / 2 + (dir < 0 ? 0 : skew), y - h / 2);
      ctx.lineTo(cx + w / 2 + (dir < 0 ? skew : 0), y + h / 2);
      ctx.lineTo(cx - w / 2 + (dir < 0 ? 0 : skew), y + h / 2);
      ctx.closePath();
      ctx.fill();
    }
  } else if (base === "BTC") {
    ctx.fillStyle = "#F7931A";
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${size * 0.7}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("₿", cx, cy + size * 0.25);
    ctx.textAlign = "left";
  } else {
    ctx.fillStyle = "#1d2027";
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
