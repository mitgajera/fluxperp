"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { PhantomWalletName } from "@solana/wallet-adapter-phantom";
import { useTrading } from "../lib/trading-context";
import { shortKey } from "../lib/format";

export default function SessionKeyButton() {
  const wallet = useWallet();
  const { sessionPubkey, sessionStatus, startSession, endSession } = useTrading();

  const connect = async () => {
    try {
      wallet.select(PhantomWalletName);
      await wallet.connect();
    } catch {
    }
  };

  if (!wallet.connected) {
    return (
      <button
        onClick={connect}
        className="h-8 px-4 rounded-md bg-surface-2 border border-line text-2xs uppercase tracking-wide text-txt hover:border-line-strong transition-colors cursor-pointer"
      >
        Connect Wallet
      </button>
    );
  }

  if (!sessionPubkey) {
    return (
      <button
        onClick={startSession}
        className="h-8 px-4 rounded-md bg-long/15 text-long border border-long/40 text-2xs uppercase tracking-wide hover:bg-long/25 transition-colors cursor-pointer shadow-glow-sm"
      >
        {sessionStatus || "Start Trading Session"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 h-8 px-3 rounded-md bg-surface-2 border border-line">
      <span className="h-1.5 w-1.5 rounded-full bg-long animate-pulse-dot" aria-hidden />
      <span className="text-2xs text-muted">session</span>
      <span className="tnum font-mono text-2xs text-txt">{shortKey(sessionPubkey.toBase58())}</span>
      <button
        onClick={endSession}
        className="text-2xs text-faint hover:text-short transition-colors cursor-pointer ml-1"
        aria-label="End trading session"
      >
        ✕
      </button>
    </div>
  );
}
