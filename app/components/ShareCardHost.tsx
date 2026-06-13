"use client";

import { useTrading } from "../lib/trading-context";
import ShareCard from "./ShareCard";

export default function ShareCardHost() {
  const { lastClose, clearLastClose } = useTrading();
  if (!lastClose) return null;
  return <ShareCard trade={lastClose} onClose={clearLastClose} />;
}
