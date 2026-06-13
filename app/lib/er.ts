import { Connection, PublicKey } from "@solana/web3.js";
import {
  orderbookPda,
  fillLogPda,
  priceFeedPda,
  positionPda,
  collateralPda,
} from "./program";
import {
  decodeOrderbook,
  decodeFillLog,
  decodePriceFeed,
  decodePosition,
  decodeCollateral,
} from "./deserialize";
import type {
  OrderbookState,
  FillLog,
  PriceFeed,
  PositionAccount,
  CollateralAccount,
} from "./types";

export const L1_RPC =
  process.env.NEXT_PUBLIC_SOLANA_L1_RPC || "https://api.devnet.solana.com";
export const ER_RPC =
  process.env.NEXT_PUBLIC_ER_RPC || "https://devnet-as.magicblock.app";
export const ER_WS =
  process.env.NEXT_PUBLIC_ER_WS || "wss://devnet-as.magicblock.app";
export const ROUTER_RPC =
  process.env.NEXT_PUBLIC_MAGIC_ROUTER_RPC || "https://devnet-router.magicblock.app";

let _l1: Connection | null = null;
let _er: Connection | null = null;
let _router: Connection | null = null;

export function l1Connection(): Connection {
  if (!_l1) _l1 = new Connection(L1_RPC, "confirmed");
  return _l1;
}

export function erConnection(): Connection {
  if (!_er) _er = new Connection(ER_RPC, { wsEndpoint: ER_WS, commitment: "confirmed" });
  return _er;
}

export function routerConnection(): Connection {
  if (!_router) _router = new Connection(ROUTER_RPC, "confirmed");
  return _router;
}

export type Unsub = () => void;

export function subscribe<T>(
  conn: Connection,
  address: PublicKey,
  decode: (d: Buffer) => T,
  cb: (value: T, slot: number) => void
): Unsub {
  let active = true;
  conn
    .getAccountInfo(address, "confirmed")
    .then((info) => {
      if (active && info) cb(decode(info.data as Buffer), 0);
    })
    .catch(() => {});
  const id = conn.onAccountChange(
    address,
    (info, ctx) => {
      if (active) cb(decode(info.data as Buffer), ctx.slot);
    },
    "confirmed"
  );
  return () => {
    active = false;
    conn.removeAccountChangeListener(id).catch(() => {});
  };
}

export const subscribeOrderbook = (
  conn: Connection,
  market: number,
  cb: (ob: OrderbookState, slot: number) => void
): Unsub => subscribe(conn, orderbookPda(market), decodeOrderbook, cb);

export const subscribeFillLog = (
  conn: Connection,
  market: number,
  cb: (fl: FillLog, slot: number) => void
): Unsub => subscribe(conn, fillLogPda(market), decodeFillLog, cb);

export const subscribePriceFeed = (
  conn: Connection,
  market: number,
  cb: (pf: PriceFeed, slot: number) => void
): Unsub => subscribe(conn, priceFeedPda(market), decodePriceFeed, cb);

export const subscribePosition = (
  conn: Connection,
  user: PublicKey,
  market: number,
  cb: (p: PositionAccount, slot: number) => void
): Unsub => subscribe(conn, positionPda(user, market), decodePosition, cb);

export const subscribeCollateral = (
  conn: Connection,
  user: PublicKey,
  cb: (c: CollateralAccount, slot: number) => void
): Unsub => subscribe(conn, collateralPda(user), decodeCollateral, cb);

export async function erPing(conn: Connection): Promise<number> {
  const t0 = performance.now();
  await conn.getLatestBlockhash("confirmed");
  return Math.round(performance.now() - t0);
}
