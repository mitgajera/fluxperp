import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fluxperp } from "../target/types/fluxperp";
import idl from "../target/idl/fluxperp.json";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { createMint, getAccount } from "@solana/spl-token";
import { readFileSync } from "fs";

const MARKET = Number(process.env.MARKET || 0);
const SYMBOL = process.env.SYMBOL || (MARKET === 1 ? "BTC-PERP" : "SOL-PERP");
const TOKEN = anchor.utils.token.TOKEN_PROGRAM_ID;
const DELEG = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const L1_RPC = process.env.SOLANA_L1_RPC || process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";

const main = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.ANCHOR_WALLET!, "utf8"))));
const l1 = new Connection(L1_RPC, "confirmed");
const wallet = { publicKey: main.publicKey, payer: main, signTransaction: async (t: any) => { t.partialSign(main); return t; }, signAllTransactions: async (ts: any[]) => { ts.forEach((t) => t.partialSign(main)); return ts; } } as any;
const program = new Program<Fluxperp>(idl as Fluxperp, new anchor.AnchorProvider(l1, wallet, { commitment: "confirmed" }));

const enc = new TextEncoder();
const mi = Buffer.from([MARKET]);
const pda = (s: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(s, program.programId)[0];
const marketConfig = pda([enc.encode("market"), mi]);
const orderbook = pda([enc.encode("orderbook"), mi]);
const fillLog = pda([enc.encode("fill_log"), mi]);
const priceFeed = pda([enc.encode("price"), mi]);
const vault = pda([enc.encode("vault")]);
const insurance = pda([enc.encode("insurance")]);

const delegated = async (a: PublicKey) => {
  const i = await l1.getAccountInfo(a);
  return !!i && i.owner.equals(DELEG);
};

(async () => {
  let mint: PublicKey;
  if (!(await l1.getAccountInfo(marketConfig))) {
    const vaultInfo = await l1.getAccountInfo(vault);
    if (vaultInfo) {
      mint = (await getAccount(l1, vault)).mint;
      console.log(`reusing shared vault mint = ${mint.toBase58()}`);
    } else {
      console.log("creating collateral mint (devnet stand-in for USDC)…");
      mint = await createMint(l1, main, main.publicKey, null, 6);
      console.log(`  mint = ${mint.toBase58()}`);
    }
    console.log(`initialize_market ${MARKET} (${SYMBOL})…`);
    await program.methods
      .initializeMarket(MARKET, SYMBOL, new anchor.BN(1000), new anchor.BN(1000), 10)
      .accountsStrict({
        authority: main.publicKey,
        marketConfig,
        orderbook,
        fillLog,
        priceFeed,
        collateralMint: mint,
        vault,
        insuranceFund: insurance,
        tokenProgram: TOKEN,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  } else {
    mint = (await getAccount(l1, vault)).mint;
    console.log(`market 0 already initialized · mint = ${mint.toBase58()}`);
  }

  for (const [name, addr, ix] of [
    ["orderbook", orderbook, "delegateOrderbook"],
    ["fill_log", fillLog, "delegateFillLog"],
    ["price_feed", priceFeed, "delegatePriceFeed"],
  ] as const) {
    if (await delegated(addr)) {
      console.log(`  ${name} already delegated`);
      continue;
    }
    console.log(`delegating ${name} to the ER…`);
    await (program.methods as any)[ix](MARKET).accountsPartial({ payer: main.publicKey, [name === "fill_log" ? "fillLog" : name === "price_feed" ? "priceFeed" : "orderbook"]: addr }).rpc();
  }

  console.log("\nsetup complete. Next: price-publisher · market-maker · keeper.");
  process.exit(0);
})().catch((e) => {
  console.error("ERR:", (e as Error).message);
  process.exit(1);
});
