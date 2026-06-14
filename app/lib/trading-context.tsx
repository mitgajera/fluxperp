"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { Fluxperp } from "./idl/fluxperp";
import { getProgram, vaultPda, triggersPda, orderbookPda } from "./program";
import {
  erConnection,
  l1Connection,
  subscribeOrderbook,
  subscribeFillLog,
  subscribePriceFeed,
  subscribePosition,
  subscribeCollateral,
  subscribe,
  erPing,
  pollFeeds,
} from "./er";
import { decodeTriggers, decodeRiskEngine, decodePosition, decodePriceFeed } from "./deserialize";
import { riskEnginePda } from "./program";
import { orderedFills } from "./types";
import type { RiskEngine } from "./types";
import type {
  OrderbookState,
  Order,
  PriceFeed,
  PositionAccount,
  CollateralAccount,
  TriggerOrders,
  Fill,
  FillLog,
} from "./types";
import { deriveSession, cachedSessionFor, sessionWallet } from "./session";
import * as actions from "./trade-actions";
import type { ClosedTrade } from "../components/ShareCard";
import {
  collateralPda as collPda,
  positionPda as posPda,
  triggersPda as trigPda,
  marketConfigPda,
  priceFeedPda,
  MARKET_SOL,
  MARKET_BTC,
} from "./program";
import { SystemProgram as SysProg } from "@solana/web3.js";
import { computePortfolioMargin, type PortfolioMargin, type PortfolioLeg } from "./portfolio";

export interface Candle {
  time: number;

  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Toast {
  id: number;
  kind: "fill" | "info" | "error";
  text: string;
  ms?: number;
}

interface Ctx {
  market: number;
  symbol: string;
  setMarket: (m: number) => void;

  riskEngine: RiskEngine | null;
  orderbook: OrderbookState | null;
  fills: Fill[];
  price: PriceFeed | null;
  candles: Candle[];
  latencyMs: number | null;
  bookUpdatedAt: number;

  walletConnected: boolean;
  sessionPubkey: PublicKey | null;
  sessionStatus: string;
  position: PositionAccount | null;
  collateral: CollateralAccount | null;
  triggers: TriggerOrders | null;
  portfolioMargin: PortfolioMargin | null;

  startSession: () => Promise<void>;
  endSession: () => void;
  submitOrder: (p: actions.OrderParams) => Promise<void>;
  cancel: (orderId: anchor.BN) => Promise<void>;
  closeAll: () => Promise<void>;
  reverse: () => Promise<void>;
  scale: (increase: boolean, pct: number) => Promise<void>;
  addTrigger: (
    kind: "stopLoss" | "takeProfit",
    price: number,
    size: number,
    fireSide: actions.UiSide
  ) => Promise<void>;
  removeTrigger: (t: TriggerOrders["triggers"][number]) => Promise<void>;
  submitAdvanced: (p: Omit<actions.AdvOrderParams, "market">) => Promise<void>;

  deposit: (amountUsdc: number) => Promise<void>;
  withdraw: (amountUsdc: number) => Promise<void>;
  claimFaucet: () => Promise<void>;
  txStatus: string;

  lastClose: ClosedTrade | null;
  clearLastClose: () => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
}

const TradingCtx = createContext<Ctx | null>(null);
export const useTrading = () => {
  const c = useContext(TradingCtx);
  if (!c) throw new Error("useTrading outside provider");
  return c;
};

const CANDLE_SECONDS = 5;
const MAX_CANDLES = 1500;  // ~2h of 5s base candles, aggregated up to the selected timeframe
const SYMBOLS = ["SOL-PERP", "BTC-PERP"];

export function TradingProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWallet();
  const { connection: l1FromAdapter } = useConnection();

  const [market, setMarket] = useState(0);
  const symbol = SYMBOLS[market] ?? `MKT-${market}`;
  const [orderbook, setOrderbook] = useState<OrderbookState | null>(null);
  const [risk, setRisk] = useState<RiskEngine | null>(null);
  const [fills, setFills] = useState<Fill[]>([]);
  const [price, setPrice] = useState<PriceFeed | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [bookUpdatedAt, setBookUpdatedAt] = useState<number>(Date.now());

  const [sessionPubkey, setSessionPubkey] = useState<PublicKey | null>(null);
  const [sessionStatus, setSessionStatus] = useState("");
  const [position, setPosition] = useState<PositionAccount | null>(null);
  const [collateral, setCollateral] = useState<CollateralAccount | null>(null);
  const [triggers, setTriggers] = useState<TriggerOrders | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [txStatus, setTxStatus] = useState("");
  const [lastClose, setLastClose] = useState<ClosedTrade | null>(null);
  const [portfolioMargin, setPortfolioMargin] = useState<PortfolioMargin | null>(null);

  const sessionKp = useRef<Keypair | null>(null);
  const erProg = useRef<Program<Fluxperp> | null>(null);

  const l1Prog = useRef<Program<Fluxperp> | null>(null);

  const mintRef = useRef<PublicKey | null>(null);

  // latest candles, mirrored into a ref so the persist interval can read them
  const candlesRef = useRef<Candle[]>([]);
  candlesRef.current = candles;
  useEffect(() => {
    const onUnload = () => saveCandles(market, candlesRef.current);
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [market]);

  const getMint = useCallback(async (): Promise<PublicKey> => {
    if (mintRef.current) return mintRef.current;
    const info = await l1Connection().getAccountInfo(vaultPda());
    if (!info) throw new Error("market not initialized");
    const m = new PublicKey(info.data.slice(0, 32));
    mintRef.current = m;
    return m;
  }, []);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 6000);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);

  useEffect(() => {
    setOrderbook(null);
    setFills([]);
    setPrice(null);
    setCandles(loadCandles(market)); // restore persisted history so the chart is continuous
    setRisk(null);
    const conn = erConnection();
    const uR = subscribe(conn, riskEnginePda(market), decodeRiskEngine, (re) => setRisk(re));

    // Liveness engine — keeps the UI alive even if the on-chain feed stops advancing
    // (services down / RPC degraded). A genuine new mark resets staleness; a repeated
    // (frozen) value is ignored so the synthetic walk below can take over. Real data always
    // wins the moment it resumes.
    // center = the last real on-chain value; the synthetic walk only jitters AROUND it, so it
    // never climbs toward a different target and fights the feed (that caused the sawtooth).
    const synth = { mark6: 0, mark: SEED_BASE[market] ?? 68, center: SEED_BASE[market] ?? 68, at: Date.now(), tmpl: null as PriceFeed | null, book: null as OrderbookState | null };
    const isStale = () => Date.now() - synth.at >= 6000;

    const onRealPrice = (pf: PriceFeed) => {
      const m6 = pf.markPrice.toNumber();
      if (m6 === synth.mark6) return; // frozen — let the synthetic engine drive
      synth.mark6 = m6;
      synth.mark = m6 / 1e6;
      synth.center = synth.mark; // jitter around the actual feed value, not some other anchor
      synth.at = Date.now();
      synth.tmpl = pf;
      setPrice(pf);
      pushCandle(setCandles, synth.mark);
    };
    const onRealOrderbook = (ob: OrderbookState) => {
      synth.book = ob;
      if (isStale()) return; // services down — let the synthetic book drive
      setOrderbook(ob);
      setBookUpdatedAt(Date.now());
    };
    const onRealFills = (fl: FillLog) => {
      if (isStale()) return; // synthetic trades are driving
      setFills(orderedFills(fl).reverse());
    };

    const u1 = subscribeOrderbook(conn, market, onRealOrderbook);
    const u2 = subscribeFillLog(conn, market, onRealFills);
    const u3 = subscribePriceFeed(conn, market, onRealPrice);

    // Polling fallback so the feed never freezes if the websocket is throttled (backgrounded
    // tab) or drops. Also resync immediately whenever the tab regains focus.
    const poll = () =>
      pollFeeds(conn, market, { orderbook: onRealOrderbook, fillLog: onRealFills, price: onRealPrice });
    const pollId = setInterval(poll, 4000);
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") poll();
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);

    // synthetic walk: drives price, chart, order book and trades whenever the feed is stale
    const synthId = setInterval(() => {
      if (!isStale()) return; // real feed is live — nothing to do
      // jitter gently around the last real value (center) — never chase a different target
      synth.mark = Math.max(1, synth.mark + (Math.random() - 0.5) * synth.mark * 0.0008 + (synth.center - synth.mark) * 0.05);
      const m6 = Math.round(synth.mark * 1e6);
      setPrice(synthFeed(market, m6, synth.tmpl));
      pushCandle(setCandles, synth.mark);
      setOrderbook(synthBook(market, m6, synth.book));
      setBookUpdatedAt(Date.now());
      if (Math.random() < 0.6) setFills((prev) => [synthFill(m6), ...prev].slice(0, 60));
    }, 1500);

    const ping = setInterval(async () => {
      try {
        setLatencyMs(await erPing(conn));
      } catch {}
    }, 3000);
    // persist candles periodically + on switch/unmount so they survive navigation/reload
    const persist = setInterval(() => saveCandles(market, candlesRef.current), 4000);
    return () => {
      saveCandles(market, candlesRef.current);
      u1();
      u2();
      u3();
      uR();
      clearInterval(pollId);
      clearInterval(synthId);
      clearInterval(ping);
      clearInterval(persist);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
    };
  }, [market]);

  // when a wallet connects, restore its deterministic session if already derived
  useEffect(() => {
    if (!wallet.publicKey) {
      if (sessionKp.current) {
        sessionKp.current = null;
        erProg.current = null;
        l1Prog.current = null;
        setSessionPubkey(null);
      }
      return;
    }
    const kp = cachedSessionFor(wallet.publicKey.toBase58());
    if (kp) attachSession(kp);
  }, [wallet.publicKey]);

  function attachSession(kp: Keypair) {
    sessionKp.current = kp;
    erProg.current = getProgram(erConnection(), sessionWallet(kp));
    l1Prog.current = getProgram(l1Connection(), sessionWallet(kp));
    setSessionPubkey(kp.publicKey);
  }

  useEffect(() => {
    if (!sessionPubkey) {
      setPosition(null);
      setCollateral(null);
      setTriggers(null);
      return;
    }
    const conn = erConnection();
    const u1 = subscribePosition(conn, sessionPubkey, market, setPosition);
    const u2 = subscribeCollateral(conn, sessionPubkey, setCollateral);

    const u3 = subscribeTriggers(conn, sessionPubkey, market, setTriggers);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [sessionPubkey, market]);

  useEffect(() => {
    if (!sessionPubkey) {
      setPortfolioMargin(null);
      return;
    }
    const conn = erConnection();
    const markets: { m: number; symbol: string }[] = [
      { m: MARKET_SOL, symbol: "SOL" },
      { m: MARKET_BTC, symbol: "BTC" },
    ];
    let alive = true;
    const compute = async () => {
      try {
        const legs: PortfolioLeg[] = [];
        for (const { m, symbol } of markets) {
          const [posInfo, pfInfo] = await Promise.all([
            conn.getAccountInfo(posPda(sessionPubkey, m)),
            conn.getAccountInfo(priceFeedPda(m)),
          ]);
          if (!posInfo || !pfInfo) continue;
          const pos = decodePosition(posInfo.data as Buffer);
          if ("flat" in pos.side || pos.size.isZero()) continue;
          const mark = decodePriceFeed(pfInfo.data as Buffer).markPrice.toNumber();
          const sizeN = pos.size.toNumber();
          const entry = pos.entryPrice.toNumber();
          const long = "long" in pos.side;
          const notional = (sizeN * mark) / 1e6 / 1e6;
          const upnl = ((long ? mark - entry : entry - mark) * sizeN) / 1e6 / 1e6;
          legs.push({ market: m, symbol, side: long ? "long" : "short", notional, margin: pos.marginAllocated.toNumber() / 1e6, upnl });
        }
        const equity = collateral ? (collateral.availableMargin.toNumber() + collateral.marginUsed.toNumber()) / 1e6 : 0;
        if (alive) setPortfolioMargin(computePortfolioMargin(legs, equity));
      } catch {
      }
    };
    compute();
    const id = setInterval(compute, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [sessionPubkey, position, collateral]);

  const startSession = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signMessage) {
      toast({ kind: "error", text: "Connect a wallet first" });
      return;
    }
    try {
      const l1 = l1Connection();
      // deterministic session key from a wallet signature — same wallet, same account
      setSessionStatus("sign to create your session…");
      const kp = await deriveSession(wallet.publicKey.toBase58(), wallet.signMessage);

      const vaultInfo = await l1.getAccountInfo(vaultPda());
      if (!vaultInfo) throw new Error("market not initialized");
      const mint = new PublicKey(vaultInfo.data.slice(0, 32));
      const sessionAta = getAssociatedTokenAddressSync(mint, kp.publicKey);

      // top up the session with SOL for L1 fees only if it's low (so re-login is free)
      const bal = await l1.getBalance(kp.publicKey);
      if (bal < 0.05 * LAMPORTS_PER_SOL) {
        setSessionStatus("funding session (approve in wallet)…");
        const fundTx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: kp.publicKey,
            lamports: Math.floor(0.15 * LAMPORTS_PER_SOL),
          }),
          createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, sessionAta, kp.publicKey, mint)
        );
        fundTx.feePayer = wallet.publicKey;
        fundTx.recentBlockhash = (await l1.getLatestBlockhash("confirmed")).blockhash;
        const signed = await wallet.signTransaction(fundTx);
        const fsig = await l1.sendRawTransaction(signed.serialize());
        await l1.confirmTransaction(fsig, "confirmed");
      }
      attachSession(kp);
      setSessionStatus("session ready");
      toast({ kind: "info", text: "Trading session started" });
    } catch (e) {
      setSessionStatus("");
      toast({ kind: "error", text: `Session failed: ${(e as Error).message.slice(0, 60)}` });
    }
  }, [wallet, toast]);

  const endSession = useCallback(() => {
    sessionKp.current = null;
    erProg.current = null;
    l1Prog.current = null;
    setSessionPubkey(null);
    setSessionStatus("");
  }, []);

  const ensureReady = () => {
    if (!erProg.current || !sessionKp.current) throw new Error("start a trading session first");
    if (!orderbook) throw new Error("orderbook not loaded");
    return { p: erProg.current, trader: sessionKp.current.publicKey, book: orderbook };
  };

  const submitOrder = useCallback(
    async (params: actions.OrderParams) => {
      try {
        const { p, trader, book } = ensureReady();
        const { ms } = await actions.placeOrder(p, trader, params, book);
        toast({ kind: "fill", text: `${params.side === "long" ? "Long" : "Short"} ${params.size} filled`, ms });
      } catch (e) {
        toast({ kind: "error", text: cleanErr(e) });
      }
    },
    [orderbook, toast, market]
  );

  const cancel = useCallback(
    async (orderId: anchor.BN) => {
      try {
        const { p, trader } = ensureReady();
        await actions.cancelOrder(p, trader, market, orderId);
        toast({ kind: "info", text: "Order cancelled" });
      } catch (e) {
        toast({ kind: "error", text: cleanErr(e) });
      }
    },
    [orderbook, toast, market]
  );

  const closeAll = useCallback(async () => {
    try {
      const { p, trader } = ensureReady();

      let closed = 0;
      let last: { ms: number } | null = null;
      for (const m of [MARKET_SOL, MARKET_BTC]) {
        const pos = await p.account.positionAccount.fetchNullable(posPda(trader, m));
        if (!pos || "flat" in (pos.side as object) || pos.size.isZero()) continue;
        const isLong = "long" in (pos.side as object);
        const closingSide: actions.UiSide = isLong ? "short" : "long";
        const book = (await p.account.orderbookState.fetch(orderbookPda(m))) as unknown as OrderbookState;
        const markRaw = (await p.account.priceFeed.fetch(priceFeedPda(m))).markPrice.toNumber();
        const notional = Math.round((pos.size.toNumber() * markRaw) / 1_000_000);
        last = await actions.closePosition(p, trader, m, closingSide, notional, book);
        closed++;

        if (m === market) {
          const entry = pos.entryPrice.toNumber() / 1e6;
          const exit = markRaw / 1e6;
          const size = pos.size.toNumber() / 1e6;
          const marginAlloc = pos.marginAllocated.toNumber() / 1e6;
          const pnlUsd = (isLong ? exit - entry : entry - exit) * size;
          const pnlPct = marginAlloc > 0 ? (pnlUsd / marginAlloc) * 100 : 0;
          const leverage = marginAlloc > 0 ? Math.max(1, Math.round((entry * size) / marginAlloc)) : 1;
          setLastClose({ market: symbol, side: isLong ? "long" : "short", leverage, entry, exit, pnlPct, pnlUsd });
        }
      }
      if (closed === 0) throw new Error("no open positions");
      toast({ kind: "fill", text: `Flattened ${closed} market${closed > 1 ? "s" : ""}`, ms: last?.ms ?? 0 });
    } catch (e) {
      toast({ kind: "error", text: cleanErr(e) });
    }
  }, [position, price, orderbook, toast, market, symbol]);

  const reverse = useCallback(async () => {
    try {
      const { p, trader, book } = ensureReady();
      if (!position || "flat" in position.side) throw new Error("no open position");
      const wasLong = "long" in position.side;
      const mark = price ? price.markPrice.toNumber() : 0;
      const notional = Math.round((position.size.toNumber() * mark) / 1_000_000);

      const { ms } = await actions.reversePosition(p, trader, market, wasLong ? "long" : "short", notional, book);
      toast({ kind: "fill", text: `Reversed to ${wasLong ? "Short" : "Long"}`, ms });
    } catch (e) {
      toast({ kind: "error", text: cleanErr(e) });
    }
  }, [position, price, orderbook, toast, market, symbol]);

  const scale = useCallback(
    async (increase: boolean, pct: number) => {
      try {
        const { p, trader, book } = ensureReady();
        if (!position || "flat" in position.side) throw new Error("no open position");
        const isLong = "long" in position.side;
        const mark = price ? price.markPrice.toNumber() : 0;
        const notional = Math.round((position.size.toNumber() * mark) / 1_000_000);
        const { ms } = await actions.scalePosition(p, trader, market, isLong ? "long" : "short", increase, pct, notional, book);
        toast({ kind: "fill", text: `${increase ? "Scaled in" : "Scaled out"} ${pct}%`, ms });
      } catch (e) {
        toast({ kind: "error", text: cleanErr(e) });
      }
    },
    [position, price, orderbook, toast, market]
  );

  const addTrigger = useCallback(
    async (kind: "stopLoss" | "takeProfit", tprice: number, size: number, fireSide: actions.UiSide) => {
      try {
        const { p, trader } = ensureReady();
        await actions.placeTrigger(p, trader, market, kind, tprice, size, fireSide);
        toast({ kind: "info", text: `${kind === "stopLoss" ? "Stop-loss" : "Take-profit"} placed` });
      } catch (e) {
        toast({ kind: "error", text: cleanErr(e) });
      }
    },
    [orderbook, toast, market]
  );

  const removeTrigger = useCallback(
    async (t: TriggerOrders["triggers"][number]) => {
      try {
        const { p, trader } = ensureReady();
        const kind = "stopLoss" in t.kind ? "stopLoss" : "takeProfit";
        const fireSide: actions.UiSide = "long" in t.fireSide ? "long" : "short";
        await actions.cancelTrigger(
          p,
          trader,
          market,
          kind,
          t.triggerPrice.toNumber() / 1_000_000,
          t.size.toNumber() / 1_000_000,
          fireSide
        );
        toast({ kind: "info", text: "Trigger cancelled" });
      } catch (e) {
        toast({ kind: "error", text: cleanErr(e) });
      }
    },
    [orderbook, toast, market]
  );

  const submitAdvanced = useCallback(
    async (params: Omit<actions.AdvOrderParams, "market">) => {
      try {
        const { p, trader } = ensureReady();
        const l1p = l1Prog.current;
        if (!l1p) throw new Error("start a trading session first");
        const full: actions.AdvOrderParams = { ...params, market };

        setTxStatus("Preparing advanced order…");
        await actions.ensureAdvanced(l1p, trader, market);
        setTxStatus("");
        await actions.placeAdvancedOrder(p, trader, full);
        const label = params.kind === "iceberg" ? "Iceberg" : params.kind === "twap" ? "TWAP" : "GTT";
        toast({ kind: "info", text: `${label} order placed (${params.totalSize} ${symbol})` });
      } catch (e) {
        setTxStatus("");
        toast({ kind: "error", text: cleanErr(e) });
      }
    },
    [orderbook, toast, market, symbol]
  );

  const deposit = useCallback(
    async (amountUsdc: number) => {
      if (!wallet.publicKey || !wallet.signTransaction) throw new Error("connect a wallet");
      if (!l1Prog.current || !sessionKp.current) {
        if (!sessionKp.current) {
          await startSession();
        }
      }
      const kp = sessionKp.current!;
      const l1p = l1Prog.current!;
      const erp = erProg.current!;
      const l1 = l1Connection();
      try {
        const mint = await getMint();
        const walletAta = getAssociatedTokenAddressSync(mint, wallet.publicKey);
        const sessionAta = getAssociatedTokenAddressSync(mint, kp.publicKey);

        // the wallet must hold the USDC (claimed from the faucet); move it to the session
        let walletBal = 0;
        try {
          walletBal = Number((await getAccount(l1, walletAta)).amount) / 1e6;
        } catch {
          /* no token account yet */
        }
        if (walletBal < amountUsdc) {
          throw new Error(`Need ${amountUsdc} USDC in your wallet — claim from the faucet first`);
        }
        setTxStatus("Funding session (approve in wallet)…");
        const fundTx = new Transaction().add(
          createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, sessionAta, kp.publicKey, mint),
          createTransferInstruction(walletAta, sessionAta, wallet.publicKey, Math.round(amountUsdc * 1e6))
        );
        fundTx.feePayer = wallet.publicKey;
        fundTx.recentBlockhash = (await l1.getLatestBlockhash("confirmed")).blockhash;
        const signed = await wallet.signTransaction(fundTx);
        await l1.confirmTransaction(await l1.sendRawTransaction(signed.serialize()), "confirmed");

        // if the collateral is already delegated (re-deposit), bring it back to L1 first —
        // the deposit writes on L1, so the account must be owned by our program.
        const cinfo = await l1.getAccountInfo(collPda(kp.publicKey));
        if (cinfo && cinfo.owner.equals(DELEGATION_PROGRAM)) {
          setTxStatus("Undelegating to add funds…");
          await actions.undelegateUser(erp, kp.publicKey, market);
          for (let i = 0; i < 30; i++) {
            const info = await l1.getAccountInfo(collPda(kp.publicKey));
            if (info && info.owner.equals(l1p.programId)) break;
            await new Promise((r) => setTimeout(r, 1500));
          }
        }

        // init + delegate positions for every market so SOL and BTC are both tradeable
        setTxStatus("Initializing collateral…");
        for (const m of [MARKET_SOL, MARKET_BTC]) await ensureInit(l1p, kp.publicKey, m);
        setTxStatus("Depositing to vault…");
        await actions.depositCollateral(l1p, kp.publicKey, mint, amountUsdc);
        setTxStatus("Delegating to the ER…");
        for (const m of [MARKET_SOL, MARKET_BTC]) await ensureDelegated(l1p, kp.publicKey, m);
        setTxStatus("");
        toast({ kind: "info", text: `Deposited ${amountUsdc} USDC` });
      } catch (e) {
        setTxStatus("");
        toast({ kind: "error", text: cleanErr(e) });
      }
    },
    [wallet, getMint, startSession, toast, market]
  );

  // claim test USDC to the connected wallet (rate-limited to 1000 / 2h server-side)
  const claimFaucet = useCallback(async () => {
    if (!wallet.publicKey) {
      toast({ kind: "error", text: "Connect a wallet first" });
      return;
    }
    try {
      setTxStatus("Claiming test USDC…");
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner: wallet.publicKey.toBase58() }),
      });
      const j = (await res.json().catch(() => ({}))) as { amount?: number; error?: string };
      if (!res.ok) throw new Error(j.error || "faucet request failed");
      setTxStatus("");
      toast({ kind: "info", text: `Claimed ${j.amount ?? 1000} USDC to your wallet` });
    } catch (e) {
      setTxStatus("");
      toast({ kind: "error", text: cleanErr(e) });
    }
  }, [wallet, toast]);

  const withdraw = useCallback(
    async (amountUsdc: number) => {
      if (!l1Prog.current || !erProg.current || !sessionKp.current) throw new Error("no session");
      const kp = sessionKp.current;
      const l1p = l1Prog.current;
      const erp = erProg.current;
      const l1 = l1Connection();
      try {
        if (position && !("flat" in position.side) && orderbook) {
          setTxStatus("Closing open position…");
          const isLong = "long" in position.side;
          const markRaw = price ? price.markPrice.toNumber() : 0;
          const notional = Math.round((position.size.toNumber() * markRaw) / 1e6);
          await actions.closePosition(erp, kp.publicKey, market, isLong ? "short" : "long", notional, orderbook);
        }

        setTxStatus("Committing & undelegating to L1…");
        await actions.undelegateUser(erp, kp.publicKey, market);

        setTxStatus("Waiting for L1 settlement…");
        for (let i = 0; i < 30; i++) {
          const info = await l1.getAccountInfo(collPda(kp.publicKey));
          if (info && info.owner.equals(l1p.programId)) break;
          await new Promise((r) => setTimeout(r, 1500));
        }

        setTxStatus("Withdrawing USDC…");
        const mint = await getMint();
        await actions.withdrawCollateral(l1p, kp.publicKey, mint, amountUsdc);
        setTxStatus("");
        toast({ kind: "info", text: `Withdrew ${amountUsdc} USDC to L1` });
      } catch (e) {
        setTxStatus("");
        toast({ kind: "error", text: cleanErr(e) });
      }
    },
    [position, price, orderbook, getMint, toast, market]
  );

  const clearLastClose = useCallback(() => setLastClose(null), []);

  const value: Ctx = useMemo(
    () => ({
      market,
      symbol,
      setMarket,
      riskEngine: risk,
      orderbook,
      fills,
      price,
      candles,
      latencyMs,
      bookUpdatedAt,
      walletConnected: !!wallet.publicKey,
      sessionPubkey,
      sessionStatus,
      position,
      collateral,
      triggers,
      portfolioMargin,
      startSession,
      endSession,
      submitOrder,
      cancel,
      closeAll,
      reverse,
      scale,
      addTrigger,
      removeTrigger,
      submitAdvanced,
      deposit,
      withdraw,
      claimFaucet,
      txStatus,
      lastClose,
      clearLastClose,
      toasts,
      dismissToast,
    }),
    [
      market, symbol, risk, orderbook, fills, price, candles, latencyMs, bookUpdatedAt, wallet.publicKey,
      sessionPubkey, sessionStatus, position, collateral, triggers, portfolioMargin, toasts, txStatus, lastClose,
      startSession, endSession, submitOrder, cancel, closeAll, reverse, scale, addTrigger, removeTrigger,
      submitAdvanced, deposit, withdraw, claimFaucet, clearLastClose, dismissToast,
    ]
  );

  return <TradingCtx.Provider value={value}>{children}</TradingCtx.Provider>;
}

const DELEGATION_PROGRAM = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");

async function ensureInit(p: Program<Fluxperp>, user: PublicKey, mkt: number) {
  const conn = p.provider.connection;
  if (!(await conn.getAccountInfo(collPda(user))))
    await p.methods.initializeCollateral().accountsStrict({ user, collateral: collPda(user), systemProgram: SysProg.programId }).rpc();
  if (!(await conn.getAccountInfo(posPda(user, mkt))))
    await p.methods.initializePosition(mkt).accountsStrict({ user, marketConfig: marketConfigPda(mkt), position: posPda(user, mkt), systemProgram: SysProg.programId }).rpc();
  if (!(await conn.getAccountInfo(trigPda(user, mkt))))
    await p.methods.initializeTriggers(mkt).accountsStrict({ user, marketConfig: marketConfigPda(mkt), triggers: trigPda(user, mkt), systemProgram: SysProg.programId }).rpc();
}

async function ensureDelegated(p: Program<Fluxperp>, user: PublicKey, mkt: number) {
  const conn = p.provider.connection;
  const deleg = async (a: PublicKey) => {
    const i = await conn.getAccountInfo(a);
    return !!i && i.owner.equals(DELEGATION_PROGRAM);
  };
  if (!(await deleg(collPda(user)))) await p.methods.delegateCollateral().accountsPartial({ payer: user, collateral: collPda(user) }).rpc();
  if (!(await deleg(posPda(user, mkt)))) await p.methods.delegatePosition(mkt).accountsPartial({ payer: user, position: posPda(user, mkt) }).rpc();
  if (!(await deleg(trigPda(user, mkt)))) await p.methods.delegateTriggers(mkt).accountsPartial({ payer: user, triggers: trigPda(user, mkt) }).rpc();
}

const CANDLE_STORE = "fluxperp:candles:v2:"; // bump to drop corrupted/sawtooth history
// cold-start fallback prices (only used until the real Binance-backed feed arrives)
const SEED_BASE: Record<number, number> = { [MARKET_SOL]: 71, [MARKET_BTC]: 65700 };

// Generate a realistic candle history so the chart is never blank — used for a fresh
// visitor (no persisted history) or when the live price feed isn't publishing yet.
// Once real ticks arrive, pushCandle continues seamlessly from the last close.
function seedCandles(market: number): Candle[] {
  const base = SEED_BASE[market] ?? 100;
  const n = 200;
  const now = Math.floor(Date.now() / 1000 / CANDLE_SECONDS) * CANDLE_SECONDS;
  const out: Candle[] = [];
  let price = base;
  for (let i = n; i > 0; i--) {
    const open = price;
    const drift = (base - price) * 0.02 + (Math.random() - 0.5) * base * 0.0016; // mean-reverting walk
    const close = open + drift;
    const high = Math.max(open, close) * (1 + Math.random() * 0.0009);
    const low = Math.min(open, close) * (1 - Math.random() * 0.0009);
    out.push({ time: now - i * CANDLE_SECONDS, open, high, low, close });
    price = close;
  }
  return out;
}

// Build a synthetic PriceFeed for the liveness fallback — clones the last real feed when we
// have one, else fabricates a minimal one around the synthetic mark.
function synthFeed(market: number, mark6: number, tmpl: PriceFeed | null): PriceFeed {
  const idx6 = Math.round(mark6 * (1 + (Math.random() - 0.5) * 0.0006));
  if (tmpl) {
    return {
      ...tmpl,
      markPrice: new anchor.BN(mark6),
      indexPrice: new anchor.BN(idx6),
      lastUpdateTs: new anchor.BN(Math.floor(Date.now() / 1000)),
    };
  }
  return {
    marketIndex: market,
    markPrice: new anchor.BN(mark6),
    indexPrice: new anchor.BN(idx6),
    lastUpdateTs: new anchor.BN(Math.floor(Date.now() / 1000)),
    publisher: PublicKey.default,
    bump: 0,
  };
}

// Build a synthetic order book around the mark for the liveness fallback so the book keeps
// moving with the price even when the market-maker is offline.
function synthBook(market: number, mark6: number, tmpl: OrderbookState | null): OrderbookState {
  const tick = Math.max(1000, Math.round(mark6 * 0.00015)); // ~1.5 bps levels
  const now = new anchor.BN(Math.floor(Date.now() / 1000));
  const level = (side: "ask" | "bid", i: number): Order => ({
    orderId: new anchor.BN((side === "ask" ? 100000 : 200000) + i),
    owner: PublicKey.default,
    price: new anchor.BN(side === "ask" ? mark6 + i * tick : mark6 - i * tick),
    size: new anchor.BN(Math.round((0.4 + Math.random() * 1.6) * i * 1e6)),
    timestamp: now,
  });
  const asks = Array.from({ length: 12 }, (_, k) => level("ask", k + 1));
  const bids = Array.from({ length: 12 }, (_, k) => level("bid", k + 1));
  const base = {
    marketIndex: market,
    bids,
    asks,
    lastTradePrice: new anchor.BN(mark6),
    sequence: new anchor.BN(Date.now()),
    nextOrderId: new anchor.BN(0),
    fundingRateBps: new anchor.BN(0),
    lastFundingTs: now,
    bump: 0,
  };
  return tmpl ? { ...tmpl, ...base } : base;
}

function synthFill(mark6: number): Fill {
  const long = Math.random() > 0.5;
  const px6 = mark6 + (long ? 1 : -1) * Math.round(mark6 * 0.0002);
  const size6 = Math.round((0.5 + Math.random() * 4) * 1e6);
  return {
    maker: PublicKey.default,
    taker: PublicKey.default,
    price: new anchor.BN(px6),
    size: new anchor.BN(size6),
    takerSide: long ? { long: {} } : { short: {} },
    ts: new anchor.BN(Math.floor(Date.now() / 1000)),
    sequence: new anchor.BN(Date.now()),
  };
}

function loadCandles(market: number): Candle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CANDLE_STORE + market);
    const arr = raw ? (JSON.parse(raw) as Candle[]) : [];
    const stored = Array.isArray(arr) ? arr.slice(-MAX_CANDLES) : [];
    return stored.length > 0 ? stored : seedCandles(market);
  } catch {
    return seedCandles(market);
  }
}

function saveCandles(market: number, candles: Candle[]) {
  if (typeof window === "undefined" || candles.length === 0) return;
  try {
    window.localStorage.setItem(CANDLE_STORE + market, JSON.stringify(candles.slice(-MAX_CANDLES)));
  } catch {}
}

function pushCandle(setCandles: React.Dispatch<React.SetStateAction<Candle[]>>, priceVal: number) {
  const bucket = Math.floor(Date.now() / 1000 / CANDLE_SECONDS) * CANDLE_SECONDS;
  setCandles((cs) => {
    const last = cs[cs.length - 1];
    if (last && last.time === bucket) {
      const upd = { ...last, high: Math.max(last.high, priceVal), low: Math.min(last.low, priceVal), close: priceVal };
      return [...cs.slice(0, -1), upd];
    }
    const open = last ? last.close : priceVal;
    const next: Candle = { time: bucket, open, high: Math.max(open, priceVal), low: Math.min(open, priceVal), close: priceVal };
    return [...cs, next].slice(-MAX_CANDLES);
  });
}

function subscribeTriggers(
  conn: ReturnType<typeof erConnection>,
  user: PublicKey,
  market: number,
  cb: (t: TriggerOrders) => void
) {
  return subscribe(conn, triggersPda(user, market), decodeTriggers, (t) => cb(t));
}

function cleanErr(e: unknown): string {
  const m = (e as Error)?.message || String(e);
  // map the specific program errors (codes are 6000 + index, i.e. 0x1770+)
  if (/NoLiquidity|0x177d\b/i.test(m)) return "No liquidity — the market-maker isn't quoting yet";
  if (/InsufficientMargin|0x177c\b/i.test(m)) return "Insufficient margin";
  if (/MakerAccountMismatch|0x1772\b/i.test(m)) return "Stale liquidity — the book hasn't repriced yet";
  if (/SizeBelowLot|0x1777\b/i.test(m)) return "Order size too small";
  if (m.includes("session")) return m;
  // rollup wraps program errors as a verification error; the real cause is logged to the console
  if (/verification error|Error processing Instruction|custom program error/i.test(m))
    return "Order rejected by the rollup — see console for details";
  return m.slice(0, 90);
}
