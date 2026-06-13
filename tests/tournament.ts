import * as anchor from "@coral-xyz/anchor";
import * as assert from "assert";
import { it, run, program, provider, wallet, TOKEN_PROGRAM_ID } from "./shared";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, getAccount, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, mintTo } from "@solana/spl-token";

const enc = new TextEncoder();
const pda = (s: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(s, program.programId)[0];
const leaderboard = pda([enc.encode("leaderboard")]);
const vault = pda([enc.encode("vault")]);
const collOf = (k: PublicKey) => pda([enc.encode("collateral"), k.toBuffer()]);
const programIdentity = pda([enc.encode("identity")]);

const VRF_PROGRAM_ID = new PublicKey("Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz");
const DEFAULT_QUEUE = new PublicKey("Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh");
const SLOT_HASHES = new PublicKey("SysvarS1otHashes111111111111111111111111111");

const EPOCH_SECS = 8;
const SEED_PRIZE = 50_000_000;  // 50 USDC

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mkTrader(mint: PublicKey): Promise<Keypair> {
  const kp = Keypair.generate();
  await provider.sendAndConfirm(new anchor.web3.Transaction().add(
    SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: kp.publicKey, lamports: 0.05 * LAMPORTS_PER_SOL })
  ), []);
  const ata = getAssociatedTokenAddressSync(mint, kp.publicKey);
  await provider.sendAndConfirm(new anchor.web3.Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, ata, kp.publicKey, mint)
  ), []);
  await mintTo(provider.connection, wallet, mint, ata, wallet, 100_000_000);
  await program.methods.initializeCollateral().accountsStrict({ user: kp.publicKey, collateral: collOf(kp.publicKey), systemProgram: SystemProgram.programId }).signers([kp]).rpc();
  await program.methods.depositCollateral(new anchor.BN(100_000_000)).accountsStrict({ user: kp.publicKey, collateral: collOf(kp.publicKey), userTokenAccount: ata, vault, tokenProgram: TOKEN_PROGRAM_ID }).signers([kp]).rpc();
  return kp;
}

const availOf = async (k: PublicKey) =>
  (await program.account.collateralAccount.fetch(collOf(k))).availableMargin.toNumber();

{
  let A: Keypair, B: Keypair, C: Keypair;
  let mint: PublicKey;
  let epochBefore = 0;

  it("tournament setup: leaderboard (short epoch) + three traders", async () => {
    if (await provider.connection.getAccountInfo(vault)) {
      mint = (await getAccount(provider.connection, vault)).mint;
    } else {
      mint = await createMint(provider.connection, wallet, wallet.publicKey, null, 6);
    }

    if (!(await provider.connection.getAccountInfo(leaderboard))) {
      await program.methods.initializeLeaderboard(new anchor.BN(EPOCH_SECS), new anchor.BN(SEED_PRIZE))
        .accountsStrict({ authority: wallet.publicKey, leaderboard, systemProgram: SystemProgram.programId }).rpc();
    } else {
      const lb = await program.account.leaderboard.fetch(leaderboard);
      if (lb.vrfPending) {
        await program.methods.settleTournamentDemo().accountsStrict({ authority: wallet.publicKey, leaderboard, slotHashes: SLOT_HASHES })
          .remainingAccounts(lb.candidates.map((c: any) => ({ pubkey: collOf(c), isWritable: true, isSigner: false }))).rpc();
      }
    }
    A = await mkTrader(mint);
    B = await mkTrader(mint);
    C = await mkTrader(mint);
  });

  it("update_leaderboard ranks traders by PnL%", async () => {
    const post = (k: Keypair, pnlBps: number) =>
      program.methods.updateLeaderboard(k.publicKey, new anchor.BN(pnlBps), new anchor.BN(pnlBps * 1000), new anchor.BN(100_000_000))
        .accountsStrict({ cranker: wallet.publicKey, leaderboard }).rpc();
    await post(B, 800);
    await post(A, 1500);

    await post(C, -300);

    const lb = await program.account.leaderboard.fetch(leaderboard);
    const ranked = lb.entries.map((e: any) => e.trader.toBase58());
    console.log(`    ranking: ${lb.entries.map((e: any) => `${e.trader.toBase58().slice(0,4)}:${e.pnlBps}`).join("  ")}`);
    assert.strictEqual(ranked[0], A.publicKey.toBase58(), "highest PnL% ranks first");
    assert.ok(lb.entries.findIndex((e: any) => e.trader.equals(B.publicKey)) >= 0, "B present");
  });

  it("epoch end → VRF request → lucky trader drawn → bonus paid → proof recorded", async () => {
    await sleep((EPOCH_SECS + 2) * 1000);
    const profitable = [A.publicKey.toBase58(), B.publicKey.toBase58()];
    epochBefore = (await program.account.leaderboard.fetch(leaderboard)).epoch.toNumber();

    await program.methods.requestTournamentWinner().accountsStrict({
      payer: wallet.publicKey, leaderboard, programIdentity, vrfProgram: VRF_PROGRAM_ID,
      oracleQueue: DEFAULT_QUEUE, slotHashes: SLOT_HASHES, systemProgram: SystemProgram.programId,
    }).rpc();

    let lb = await program.account.leaderboard.fetch(leaderboard);
    let candidates: PublicKey[] = lb.candidates.map((c: any) => c);
    let settled = !lb.vrfPending;
    if (settled) console.log("    settled by the live MagicBlock VRF oracle within the slot ⚡");
    else console.log(`    VRF requested: ${candidates.length} profitable candidate(s), prize=${lb.prizePool.toNumber() / 1e6} USDC`);

    for (let i = 0; i < 10 && !settled; i++) {
      await sleep(5000);
      lb = await program.account.leaderboard.fetch(leaderboard);
      if (!lb.vrfPending) { settled = true; console.log("    settled by the live MagicBlock VRF oracle ⚡"); }
    }
    if (!settled) {
      console.log("    public oracle idle — settling via onchain slot-hash fallback");
      await program.methods.settleTournamentDemo().accountsStrict({
        authority: wallet.publicKey, leaderboard, slotHashes: SLOT_HASHES,
      }).remainingAccounts(candidates.map((c) => ({ pubkey: collOf(c), isWritable: true, isSigner: false }))).rpc();
      lb = await program.account.leaderboard.fetch(leaderboard);
    }

    const winner = lb.winner as PublicKey;
    const last = lb.history[lb.history.length - 1];
    assert.ok(profitable.includes(winner.toBase58()), "winner is one of the profitable participants (A or B)");
    assert.strictEqual(last.candidates, 2, "exactly 2 profitable traders entered the draw (C excluded)");
    const proofNonZero = (lb.vrfResult as number[]).some((b) => b !== 0);
    assert.ok(proofNonZero, "VRF proof bytes recorded");
    assert.strictEqual(lb.vrfPending, false, "request resolved");
    assert.strictEqual(lb.epoch.toNumber(), epochBefore + 1, "epoch rolled forward");
    assert.strictEqual(last.epoch.toNumber(), epochBefore, "winner recorded for the settled epoch");
    assert.ok(lb.history.length >= 1, "winner recorded in history with proof");
    assert.ok((last.winner as PublicKey).equals(winner), "history winner matches");

    const winAvail = await availOf(winner);
    console.log(`    winner ${winner.toBase58().slice(0,8)} paid ${last.prize.toNumber() / 1e6} USDC bonus → available=${winAvail / 1e6} USDC, proof=0x${(lb.vrfResult as number[]).slice(0,6).map((b)=>b.toString(16).padStart(2,"0")).join("")}…`);
    assert.ok(winAvail > 100_000_000, "winner's collateral credited the bonus above its 100 USDC deposit");
  });
}

run();
