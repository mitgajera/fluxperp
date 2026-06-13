"use client";

import { useTrading } from "../lib/trading-context";

export default function FillToast() {
  const { toasts, dismissToast } = useTrading();
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-72">
      {toasts.map((t) => {
        const accent =
          t.kind === "fill" ? "border-long/50 shadow-glow-sm" : t.kind === "error" ? "border-short/50" : "border-line-strong";
        return (
          <button
            key={t.id}
            onClick={() => dismissToast(t.id)}
            className={`text-left animate-toast-in bg-surface-2 border ${accent} rounded-lg px-4 py-3 cursor-pointer hover:bg-surface-3 transition-colors`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className={`text-sm ${t.kind === "error" ? "text-short" : t.kind === "fill" ? "text-long" : "text-txt"}`}>
                {t.text}
              </span>
              {t.kind === "fill" && t.ms != null && (
                <span className="tnum font-mono text-sm text-long whitespace-nowrap drop-shadow-[0_0_6px_rgba(57,255,20,0.5)]">
                  {t.ms}ms ⚡
                </span>
              )}
            </div>
            {t.kind === "fill" && t.ms != null && (
              <div className="text-2xs text-faint mt-0.5">send → ER confirm</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
