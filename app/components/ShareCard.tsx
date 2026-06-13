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

export default function ShareCard({ trade, onClose }: { trade: ClosedTrade; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const W = 1000;
    const H = 540;
    c.width = W;
    c.height = H;
    const win = trade.pnlPct >= 0;
    const green = "#39ff14";
    const red = "#ff4d4d";
    const accent = win ? green : red;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);
    const grad = ctx.createRadialGradient(W * 0.5, -80, 100, W * 0.5, 0, 720);
    grad.addColorStop(0, win ? "rgba(57,255,20,0.14)" : "rgba(255,77,77,0.12)");
    grad.addColorStop(1, "rgba(10,10,10,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#1c1c20";
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, W - 40, H - 40);

    const mono = "600 1px 'Geist Mono', monospace";
    void mono;

    ctx.fillStyle = green;
    ctx.font = "700 40px system-ui, sans-serif";
    ctx.fillText("FluxPerp", 56, 92);
    ctx.fillStyle = "#5a5a5a";
    ctx.font = "400 18px system-ui, sans-serif";
    ctx.fillText("perp trading at ER speed", 58, 120);

    ctx.fillStyle = "#ededed";
    ctx.font = "700 52px system-ui, sans-serif";
    ctx.fillText(trade.market, 56, 215);
    ctx.fillStyle = trade.side === "long" ? green : red;
    ctx.font = "700 30px system-ui, sans-serif";
    ctx.fillText(`${trade.side.toUpperCase()} · ${trade.leverage}x`, 56, 258);

    ctx.fillStyle = accent;
    ctx.font = "800 130px system-ui, sans-serif";
    const pnlText = `${win ? "+" : ""}${trade.pnlPct.toFixed(2)}%`;
    ctx.fillText(pnlText, 52, 400);
    if (win) {
      ctx.shadowColor = green;
      ctx.shadowBlur = 30;
      ctx.fillText(pnlText, 52, 400);
      ctx.shadowBlur = 0;
    }

    ctx.font = "500 24px 'Geist Mono', monospace";
    ctx.fillStyle = "#8a8a8a";
    ctx.fillText("Entry", 56, 470);
    ctx.fillText("Exit", 320, 470);
    ctx.fillText("PnL", 560, 470);
    ctx.fillStyle = "#ededed";
    ctx.font = "600 30px 'Geist Mono', monospace";
    ctx.fillText(trade.entry.toFixed(2), 56, 506);
    ctx.fillText(trade.exit.toFixed(2), 320, 506);
    ctx.fillStyle = accent;
    ctx.fillText(`${win ? "+" : ""}$${trade.pnlUsd.toFixed(2)}`, 560, 506);

    ctx.fillStyle = "#5a5a5a";
    ctx.font = "400 18px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("settled on Solana · zero trusted components", W - 56, H - 44);
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
    const text = `Just ${win ? "closed +" : "closed "}${trade.pnlPct.toFixed(2)}% on ${trade.market} ${trade.side.toUpperCase()} ${trade.leverage}x at @FluxPerp — fully onchain perps inside @magicblock's Ephemeral Rollup. Sub-100ms fills, settled on @solana.`;
    download();
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface-1 border border-line rounded-xl p-4 max-w-xl w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Position closed</h2>
          <button onClick={onClose} className="text-faint hover:text-txt cursor-pointer" aria-label="Close">✕</button>
        </div>
        <canvas ref={canvasRef} className="w-full rounded-lg border border-line" />
        <div className="flex gap-2 mt-4">
          <button
            onClick={download}
            className="flex-1 h-10 rounded-md bg-surface-2 border border-line text-sm text-txt hover:border-line-strong transition-colors cursor-pointer"
          >
            Download PNG
          </button>
          <button
            onClick={shareX}
            className="flex-1 h-10 rounded-md bg-long text-black font-semibold text-sm hover:bg-long/90 transition-colors cursor-pointer shadow-glow-sm"
          >
            Share on X
          </button>
        </div>
      </div>
    </div>
  );
}
