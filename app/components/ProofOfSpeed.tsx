"use client";

import { useState } from "react";
import { erConnection, erPing } from "../lib/er";

const SIM_L1_MS = 400;

export default function ProofOfSpeed() {
  const [open, setOpen] = useState(false);
  const [racing, setRacing] = useState(false);
  const [erMs, setErMs] = useState<number | null>(null);
  const [runKey, setRunKey] = useState(0);

  const race = async () => {
    setRacing(true);
    setErMs(null);
    try {
      const ms = await erPing(erConnection());
      setErMs(ms);
      setRunKey((k) => k + 1);
    } catch {
      setErMs(null);
    } finally {
      setTimeout(() => setRacing(false), SIM_L1_MS + 200);
    }
  };

  const faster = erMs ? Math.max(1, Math.round(SIM_L1_MS / erMs)) : null;

  return (
    <div className="panel">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 h-9 cursor-pointer"
        aria-expanded={open}
      >
        <span className="text-2xs uppercase tracking-wide text-muted">Proof of Speed</span>
        <span className="text-2xs text-faint">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          <Lane
            label="FluxPerp · Ephemeral Rollup"
            color="bg-long"
            text="text-long"
            durationMs={erMs ?? 0}
            ms={erMs}
            run={runKey}
            active={racing || erMs != null}
            real
          />
          <Lane
            label="Typical L1 DEX (simulated)"
            color="bg-short"
            text="text-short"
            durationMs={SIM_L1_MS}
            ms={racing || erMs != null ? SIM_L1_MS : null}
            run={runKey}
            active={racing || erMs != null}
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-2xs text-faint">
              {faster ? (
                <>
                  <span className="text-long font-semibold">{faster}× faster</span> · same trustless settlement
                </>
              ) : (
                "Race a live ER roundtrip vs a 400ms L1 order"
              )}
            </span>
            <button
              onClick={race}
              disabled={racing}
              className="h-7 px-3 rounded-md bg-long/15 text-long border border-long/40 text-2xs uppercase tracking-wide hover:bg-long/25 transition-colors cursor-pointer disabled:opacity-40"
            >
              {racing ? "Racing…" : "Run Race"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Lane({
  label,
  color,
  text,
  durationMs,
  ms,
  run,
  active,
  real,
}: {
  label: string;
  color: string;
  text: string;
  durationMs: number;
  ms: number | null;
  run: number;
  active: boolean;
  real?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xs text-muted">
          {label} {real && <span className="text-faint">· live</span>}
        </span>
        <span className={`tnum font-mono text-2xs ${ms != null ? text : "text-faint"}`}>
          {ms != null ? `${ms}ms` : "—"}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
        {}
        <div
          key={run}
          className={`h-full ${color} rounded-full`}
          style={{
            width: active ? "100%" : "0%",
            transition: `width ${Math.max(60, durationMs)}ms linear`,
          }}
        />
      </div>
    </div>
  );
}
