import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AccountMeta, Connection, PublicKey } from "@solana/web3.js";
import idl from "./idl/fluxperp.json";
import type { Fluxperp } from "./idl/fluxperp";
import type { Order } from "./types";

export const PROGRAM_ID = new PublicKey((idl as any).address);
export const MARKET_SOL = 0;
export const MARKET_BTC = 1;

const enc = new TextEncoder();
const mi = (m: number) => Buffer.from([m]);
const pda = (seeds: (Buffer | Uint8Array)[]) =>
  PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];

export const marketConfigPda = (m: number) => pda([enc.encode("market"), mi(m)]);
export const orderbookPda = (m: number) => pda([enc.encode("orderbook"), mi(m)]);
export const fillLogPda = (m: number) => pda([enc.encode("fill_log"), mi(m)]);
export const priceFeedPda = (m: number) => pda([enc.encode("price"), mi(m)]);
export const riskEnginePda = (m: number) => pda([enc.encode("risk"), mi(m)]);
export const vaultPda = () => pda([enc.encode("vault")]);
export const insurancePda = () => pda([enc.encode("insurance")]);
export const leaderboardPda = () => pda([enc.encode("leaderboard")]);
export const collateralPda = (user: PublicKey) =>
  pda([enc.encode("collateral"), user.toBuffer()]);
export const positionPda = (user: PublicKey, m: number) =>
  pda([enc.encode("position"), user.toBuffer(), mi(m)]);
export const triggersPda = (user: PublicKey, m: number) =>
  pda([enc.encode("triggers"), user.toBuffer(), mi(m)]);
export const advancedPda = (user: PublicKey, m: number) =>
  pda([enc.encode("adv"), user.toBuffer(), mi(m)]);

export function getProgram(
  connection: Connection,
  wallet: anchor.Wallet
): Program<Fluxperp> {
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  return new Program<Fluxperp>(idl as Fluxperp, provider);
}

export function makerPairs(
  restingOrders: Order[],
  market: number,
  opts: { excludeOwner?: PublicKey; topN?: number } = {}
): AccountMeta[] {
  const { excludeOwner, topN = 8 } = opts;
  const seen = new Set<string>();
  const owners: PublicKey[] = [];
  for (const o of restingOrders.slice(0, topN)) {
    const k = o.owner.toBase58();
    if (excludeOwner && o.owner.equals(excludeOwner)) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    owners.push(o.owner);
  }
  return owners.flatMap((owner) => [
    { pubkey: positionPda(owner, market), isWritable: true, isSigner: false },
    { pubkey: collateralPda(owner), isWritable: true, isSigner: false },
  ]);
}
