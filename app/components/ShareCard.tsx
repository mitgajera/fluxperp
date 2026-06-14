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

    // backdrop
    ctx.fillStyle = "#0a0b0d";
    ctx.fillRect(0, 0, W, H);

    // faint grid
    ctx.strokeStyle = "rgba(255,255,255,0.025)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // directional glow (bottom-left)
    const glow = ctx.createRadialGradient(120, H + 60, 60, 120, H + 60, 720);
    glow.addColorStop(0, `rgba(${accentRGB},0.20)`);
    glow.addColorStop(1, "rgba(10,11,13,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // inner border
    roundRect(ctx, 24, 24, W - 48, H - 48, 24);
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const PAD = 72;

    // --- header: logo mark + wordmark ---
    roundRect(ctx, PAD, 64, 36, 36, 9);
    ctx.fillStyle = `rgba(${accentRGB},0.14)`;
    ctx.fill();
    ctx.fillStyle = green;
    bolt(ctx, PAD + 18, 82, 14);
    ctx.font = "700 30px system-ui, sans-serif";
    ctx.fillStyle = "#e8eaed";
    ctx.fillText("Flux", PAD + 50, 91);
    const fluxW = ctx.measureText("Flux").width;
    ctx.fillStyle = green;
    ctx.fillText("Perp", PAD + 50 + fluxW, 91);

    // ER badge (top-right)
    ctx.font = "600 16px system-ui, sans-serif";
    const badge = "ONCHAIN · MAGICBLOCK ER";
    const bw = ctx.measureText(badge).width + 32;
    roundRect(ctx, W - PAD - bw, 66, bw, 32, 16);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#8b909c";
    ctx.fillText(badge, W - PAD - bw + 16, 87);

    // --- market + side ---
    const base = trade.market.split("-")[0].toUpperCase();
    drawToken(ctx, base, PAD + 17, 196, 34);
    ctx.font = "700 46px system-ui, sans-serif";
    ctx.fillStyle = "#e8eaed";
    ctx.fillText(trade.market, PAD + 50, 212);

    // side pill
    const pill = `${long ? "LONG" : "SHORT"}  ${trade.leverage}×`;
    ctx.font = "700 20px system-ui, sans-serif";
    const pw = ctx.measureText(pill).width + 36;
    const sideCol = long ? green : red;
    const sideRGB = long ? "46,189,133" : "246,70,93";
    roundRect(ctx, PAD + 52 + ctx.measureText(trade.market).width + 24, 178, pw, 38, 19);
    ctx.fillStyle = `rgba(${sideRGB},0.15)`;
    ctx.fill();
    ctx.fillStyle = sideCol;
    ctx.fillText(pill, PAD + 52 + ctx.measureText(trade.market).width + 24 + 18, 204);

    // --- hero PnL% ---
    const pnlText = `${win ? "+" : ""}${trade.pnlPct.toFixed(2)}%`;
    ctx.font = "800 132px system-ui, sans-serif";
    ctx.fillStyle = accent;
    if (win) {
      ctx.shadowColor = `rgba(${accentRGB},0.55)`;
      ctx.shadowBlur = 40;
    }
    ctx.fillText(pnlText, PAD - 4, 400);
    ctx.shadowBlur = 0;

    // $ amount
    ctx.font = "600 34px 'Geist Mono', ui-monospace, monospace";
    ctx.fillStyle = accent;
    ctx.fillText(`${win ? "+" : "−"}$${Math.abs(trade.pnlUsd).toFixed(2)}`, PAD, 452);

    // --- stat chips: entry -> exit ---
    const chipY = 520;
    const chipH = 86;
    statChip(ctx, PAD, chipY, 300, chipH, "ENTRY", trade.entry.toFixed(3), "#e8eaed");
    // arrow
    ctx.strokeStyle = "#585d68";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(PAD + 326, chipY + chipH / 2);
    ctx.lineTo(PAD + 366, chipY + chipH / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(PAD + 358, chipY + chipH / 2 - 7);
    ctx.lineTo(PAD + 366, chipY + chipH / 2);
    ctx.lineTo(PAD + 358, chipY + chipH / 2 + 7);
    ctx.stroke();
    statChip(ctx, PAD + 392, chipY, 300, chipH, "EXIT", trade.exit.toFixed(3), accent);

    // footer tagline (right)
    ctx.font = "400 18px system-ui, sans-serif";
    ctx.fillStyle = "#585d68";
    ctx.textAlign = "right";
    ctx.fillText("Sub-100ms fills · settled on Solana", W - PAD, H - 76);
    ctx.fillText("flux.perp", W - PAD, H - 50);
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
