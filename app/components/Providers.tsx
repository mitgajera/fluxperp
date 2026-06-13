"use client";

import { useMemo } from "react";
import {
  ConnectionProvider as RawConnectionProvider,
  WalletProvider as RawWalletProvider,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { L1_RPC } from "../lib/er";
import { TradingProvider } from "../lib/trading-context";

const ConnectionProvider = RawConnectionProvider as unknown as React.FC<{
  endpoint: string;
  children: React.ReactNode;
}>;
const WalletProvider = RawWalletProvider as unknown as React.FC<{
  wallets: any[];
  autoConnect?: boolean;
  children: React.ReactNode;
}>;

export default function Providers({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={L1_RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <TradingProvider>{children}</TradingProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
