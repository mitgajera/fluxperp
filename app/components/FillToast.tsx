"use client";

import { useTrading } from "../lib/trading-context";

const TONE = {
  fill: { icon: "bg-long/15 text-long", bar: "bg-long", text: "text-txt" },
  info: { icon: "bg-surface-3 text-muted", bar: "bg-line-strong", text: "text-txt" },
  error: { icon: "bg-short/15 text-short", bar: "bg-short", text: "text-txt" },
} as const;

export default function FillToast() {
  const { toasts, dismissToast } = useTrading();
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 w-80 pointer-events-none">
      {toasts.map((t) => {
        const tone = TONE[t.kind];
        return (
          <div key={t.id} className="pointer-events-auto animate-toast-in">
            <button
              onClick={() => dismissToast(t.id)}
              className="group relative w-full overflow-hidden rounded-xl border border-line-strong bg-surface-2/95 backdrop-blur-sm text-left shadow-xl shadow-black/40 hover:border-line-strong/80 transition-colors"
            >
              <div className="flex items-start gap-3 px-3.5 py-3">
                <span className={`mt-px grid h-7 w-7 shrink-0 place-items-center rounded-full ${tone.icon}`}>
                  <ToastIcon kind={t.kind} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm leading-snug ${tone.text}`}>{t.text}</span>
                    {t.kind === "fill" && t.ms != null && (
                      <span className="flex items-center gap-1 tnum font-mono text-xs text-long whitespace-nowrap">
                        <Bolt />
                        {t.ms}ms
                      </span>
                    )}
                  </div>
                  {t.kind === "fill" && t.ms != null && (
                    <div className="text-2xs text-faint mt-0.5">send → ER confirm</div>
                  )}
                </div>
              </div>
              <span
                className={`absolute bottom-0 left-0 h-[2px] w-full origin-left ${tone.bar} opacity-70 animate-toast-bar`}
                style={{ animationDuration: "6s" }}
                aria-hidden
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ToastIcon({ kind }: { kind: "fill" | "info" | "error" }) {
  const common = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "fill") return <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>;
  if (kind === "error") return <svg {...common}><path d="M18 6 6 18M6 6l12 12" /></svg>;
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v4M12 8h.01" />
    </svg>
  );
}

function Bolt() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-12H12l1-8z" />
    </svg>
  );
}
