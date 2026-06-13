// verify-portfolio.ts — proves the /portfolio deposit→delegate→undelegate→withdraw
// money loop on devnet, using lib/trade-actions (the exact code the Withdraw button calls).
//
// Run: ANCHOR_WALLET=$HOME/.config/solana/id.json ts-node app/scripts/verify-portfolio.ts

import * as anchor from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
  mintTo,
} from "@solana/spl-token";
import { readFileSync } from "fs";
import { getProgram, vaultPda, collateralPda, positionPda, triggersPda, marketConfigPda } from "../lib/program";
import { erConnection, l1Connection } from "../lib/er";
import { sessionWallet } from "../lib/session";
import * as actions from "../lib/trade-actions";

const MARKET = 0;
const TOKEN = anchor.utils.token.TOKEN_PROGRAM_ID;
const DELEG = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const main = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.ANCHOR_WALLET!, "utf8"))));
const l1 = l1Connection();
const er = erConnection();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const mint = (await getAccount(l1, vaultPda())).mint;
  const kp = Keypair.generate();
  const ata = getAssociatedTokenAddressSync(mint, kp.publicKey);
  const l1kp = getProgram(l1, sessionWallet(kp));
  const erkp = getProgram(er, sessionWallet(kp));

  console.log("funding + depositing 100 USDC, delegating…");
  await l1.confirmTransaction(await l1.sendTransaction(new Transaction().add(SystemProgram.transfer({ fromPubkey: main.publicKey, toPubkey: kp.publicKey, lamports: 0.15 * LAMPORTS_PER_SOL })), [main]), "confirmed");
  await l1.confirmTransaction(await l1.sendTransaction(new Transaction().add(createAssociatedTokenAccountIdempotentInstruction(main.publicKey, ata, kp.publicKey, mint)), [main]), "confirmed");
  await mintTo(l1, main, mint, ata, main, 100_000_000);

  await l1kp.methods.initializeCollateral().accountsStrict({ user: kp.publicKey, collateral: collateralPda(kp.publicKey), systemProgram: SystemProgram.programId }).rpc();
  await actions.depositCollateral(l1kp, kp.publicKey, mint, 100);
  await l1kp.methods.initializePosition(MARKET).accountsStrict({ user: kp.publicKey, marketConfig: marketConfigPda(MARKET), position: positionPda(kp.publicKey, MARKET), systemProgram: SystemProgram.programId }).rpc();
  await l1kp.methods.initializeTriggers(MARKET).accountsStrict({ user: kp.publicKey, marketConfig: marketConfigPda(MARKET), triggers: triggersPda(kp.publicKey, MARKET), systemProgram: SystemProgram.programId }).rpc();
  await l1kp.methods.delegateCollateral().accountsPartial({ payer: kp.publicKey, collateral: collateralPda(kp.publicKey) }).rpc();
  await l1kp.methods.delegatePosition(MARKET).accountsPartial({ payer: kp.publicKey, position: positionPda(kp.publicKey, MARKET) }).rpc();
  await l1kp.methods.delegateTriggers(MARKET).accountsPartial({ payer: kp.publicKey, triggers: triggersPda(kp.publicKey, MARKET) }).rpc();

  const ataAfterDeposit = Number((await getAccount(l1, ata)).amount);
  console.log(`  deposited: session ATA USDC = ${ataAfterDeposit / 1e6} (vault holds the 100)`);

  // --- the Withdraw button's path ---
  console.log("undelegate_user (commit + undelegate to L1)…");
  await actions.undelegateUser(erkp, kp.publicKey, MARKET);

  console.log("waiting for L1 ownership to flip back to the program…");
  let undeleg = false;
  for (let i = 0; i < 30; i++) {
    const info = await l1.getAccountInfo(collateralPda(kp.publicKey));
    if (info && info.owner.equals(l1kp.programId)) {
      undeleg = true;
      break;
    }
    await sleep(1500);
  }
  console.log(`  collateral undelegated on L1 = ${undeleg}`);

  console.log("withdraw_collateral 100 USDC…");
  await actions.withdrawCollateral(l1kp, kp.publicKey, mint, 100);
  const ataAfterWithdraw = Number((await getAccount(l1, ata)).amount);
  console.log(`  withdrawn: session ATA USDC = ${ataAfterWithdraw / 1e6}`);

  const ok = undeleg && ataAfterWithdraw === 100_000_000;
  console.log(ok ? "\nPORTFOLIO LOOP OK (deposit · delegate · undelegate · withdraw)" : "\nFAILED");
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error("ERR:", (e as Error).message);
  process.exit(1);
});
