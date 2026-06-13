use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;
use anchor_lang::Discriminator;

use ephemeral_vrf_sdk::consts::{scoped_vrf_identity, DEFAULT_QUEUE, IDENTITY, VRF_PROGRAM_ID};
use ephemeral_vrf_sdk::rnd::random_u32;
use ephemeral_vrf_sdk::types::{RequestRandomness, SerializableAccountMeta};

use crate::errors::FluxError;
use crate::state::*;

type VrfPubkey = ephemeral_vrf_sdk::compat::Pubkey;
fn to_anchor(p: VrfPubkey) -> Pubkey {
    Pubkey::new_from_array(p.to_bytes())
}
fn to_vrf(p: &Pubkey) -> VrfPubkey {
    VrfPubkey::new_from_array(p.to_bytes())
}
fn collateral_pda(user: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[COLLATERAL_SEED, user.as_ref()], &crate::ID).0
}

pub fn vrf_callback_identity() -> Pubkey {
    to_anchor(scoped_vrf_identity(&to_vrf(&crate::ID)))
}

#[derive(Accounts)]
pub struct InitializeLeaderboard<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = Leaderboard::LEN,
        seeds = [LEADERBOARD_SEED],
        bump
    )]
    pub leaderboard: Account<'info, Leaderboard>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_leaderboard(
    ctx: Context<InitializeLeaderboard>,
    epoch_duration: i64,
    seed_prize: u64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let lb = &mut ctx.accounts.leaderboard;
    lb.authority = ctx.accounts.authority.key();
    lb.epoch = 1;
    lb.start_ts = now;
    lb.epoch_duration = if epoch_duration > 0 { epoch_duration } else { DEMO_EPOCH_SECS };
    lb.end_ts = now + lb.epoch_duration;
    lb.prize_pool = seed_prize;
    lb.entries = Vec::new();
    lb.candidates = Vec::new();
    lb.vrf_pending = false;
    lb.winner = Pubkey::default();
    lb.vrf_result = [0u8; 32];
    lb.history = Vec::new();
    lb.bump = ctx.bumps.leaderboard;
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateLeaderboard<'info> {
    pub cranker: Signer<'info>,
    #[account(mut, seeds = [LEADERBOARD_SEED], bump = leaderboard.bump)]
    pub leaderboard: Account<'info, Leaderboard>,
}

pub fn update_leaderboard(
    ctx: Context<UpdateLeaderboard>,
    trader: Pubkey,
    pnl_bps: i64,
    realized_pnl: i64,
    volume: u64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let lb = &mut ctx.accounts.leaderboard;
    lb.upsert(LeaderEntry { trader, pnl_bps, realized_pnl, volume });

    lb.prize_pool = lb.prize_pool.saturating_add(volume / 10_000);
    let rank = lb.entries.iter().position(|e| e.trader == trader).unwrap_or(0) as u8;
    emit!(LeaderboardUpdated {
        epoch: lb.epoch,
        trader,
        pnl_bps,
        rank,
        prize_pool: lb.prize_pool,
        ts: now,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct RequestTournamentWinner<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [LEADERBOARD_SEED], bump = leaderboard.bump)]
    pub leaderboard: Account<'info, Leaderboard>,
    /// CHECK: our program's VRF request identity PDA (signs the request via invoke_signed).

    #[account(seeds = [IDENTITY], bump)]
    pub program_identity: AccountInfo<'info>,
    /// CHECK: the MagicBlock VRF program.

    #[account(address = to_anchor(VRF_PROGRAM_ID))]
    pub vrf_program: AccountInfo<'info>,
    /// CHECK: the VRF oracle queue (base-layer default queue).

    #[account(mut, address = to_anchor(DEFAULT_QUEUE))]
    pub oracle_queue: AccountInfo<'info>,
    /// CHECK: SlotHashes sysvar, read by the VRF program.

    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub slot_hashes: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn request_tournament_winner(ctx: Context<RequestTournamentWinner>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let lb_key = ctx.accounts.leaderboard.key();

    let (epoch, candidates, metas) = {
        let lb = &ctx.accounts.leaderboard;
        require!(now >= lb.end_ts, FluxError::EpochNotEnded);
        require!(!lb.vrf_pending, FluxError::VrfAlreadyPending);

        let mut candidates: Vec<Pubkey> = Vec::new();
        let mut metas: Vec<SerializableAccountMeta> = vec![SerializableAccountMeta {
            pubkey: to_vrf(&lb_key),
            is_signer: false,
            is_writable: true,
        }];
        for e in lb.entries.iter().filter(|e| e.pnl_bps > 0).take(MAX_CANDIDATES) {
            candidates.push(e.trader);
            metas.push(SerializableAccountMeta {
                pubkey: to_vrf(&collateral_pda(&e.trader)),
                is_signer: false,
                is_writable: true,
            });
        }
        require!(!candidates.is_empty(), FluxError::NoCandidates);
        (lb.epoch, candidates, metas)
    };

    let mut caller_seed = [0u8; 32];
    caller_seed[..8].copy_from_slice(&epoch.to_le_bytes());
    caller_seed[8..16].copy_from_slice(&now.to_le_bytes());

    let mut data = RequestRandomness {
        caller_seed,
        callback_program_id: to_vrf(&crate::ID),
        callback_discriminator: crate::instruction::SettleTournament::DISCRIMINATOR.to_vec(),
        callback_accounts_metas: metas,
        callback_args: vec![],
    }
    .to_bytes();
    data[0] = 11;

    let ix = Instruction {
        program_id: ctx.accounts.vrf_program.key(),
        accounts: vec![
            AccountMeta::new(ctx.accounts.payer.key(), true),
            AccountMeta::new_readonly(ctx.accounts.program_identity.key(), true),
            AccountMeta::new(ctx.accounts.oracle_queue.key(), false),
            AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
            AccountMeta::new_readonly(ctx.accounts.slot_hashes.key(), false),
        ],
        data,
    };

    invoke_signed(
        &ix,
        &[
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.program_identity.to_account_info(),
            ctx.accounts.oracle_queue.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.slot_hashes.to_account_info(),
            ctx.accounts.vrf_program.to_account_info(),
        ],
        &[&[IDENTITY, &[ctx.bumps.program_identity]]],
    )?;

    let lb = &mut ctx.accounts.leaderboard;
    lb.candidates = candidates;
    lb.vrf_pending = true;
    emit!(TournamentRequested {
        epoch: lb.epoch,
        candidates: lb.candidates.len() as u32,
        prize_pool: lb.prize_pool,
        ts: now,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct SettleTournament<'info> {
    /// CHECK: the scoped VRF program identity — proves the oracle made this call.

    #[account(address = vrf_callback_identity() @ FluxError::Unauthorized)]
    pub vrf_program_identity: Signer<'info>,
    #[account(mut, seeds = [LEADERBOARD_SEED], bump = leaderboard.bump)]
    pub leaderboard: Account<'info, Leaderboard>,
}

pub fn settle_tournament<'info>(
    ctx: Context<'_, '_, 'info, 'info, SettleTournament<'info>>,
    randomness: [u8; 32],
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    settle_inner(&mut ctx.accounts.leaderboard, ctx.remaining_accounts, randomness, now)
}

#[derive(Accounts)]
pub struct SettleTournamentDemo<'info> {
    #[account(constraint = authority.key() == leaderboard.authority @ FluxError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [LEADERBOARD_SEED], bump = leaderboard.bump)]
    pub leaderboard: Account<'info, Leaderboard>,
    /// CHECK: SlotHashes sysvar — the most-recent block hash is the randomness source.

    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub slot_hashes: AccountInfo<'info>,
}

pub fn settle_tournament_demo<'info>(
    ctx: Context<'_, '_, 'info, 'info, SettleTournamentDemo<'info>>,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let randomness = {
        let data = ctx.accounts.slot_hashes.try_borrow_data()?;
        require!(data.len() >= 48, FluxError::NoVrfPending);
        let mut r = [0u8; 32];
        r.copy_from_slice(&data[16..48]);
        r
    };
    settle_inner(&mut ctx.accounts.leaderboard, ctx.remaining_accounts, randomness, now)
}

fn settle_inner<'info>(
    lb: &mut Account<'info, Leaderboard>,
    remaining: &'info [AccountInfo<'info>],
    randomness: [u8; 32],
    now: i64,
) -> Result<()> {
    require!(lb.vrf_pending, FluxError::NoVrfPending);
    let n = lb.candidates.len();
    require!(n > 0, FluxError::NoCandidates);
    require!(remaining.len() == n, FluxError::MissingAccount);

    let idx = (random_u32(&randomness) as usize) % n;
    let winner = lb.candidates[idx];
    let winner_ai = &remaining[idx];
    require!(winner_ai.key() == collateral_pda(&winner), FluxError::WinnerMismatch);

    let prize = lb.prize_pool;

    {
        let mut coll: Account<CollateralAccount> = Account::try_from(winner_ai)?;
        require!(coll.user == winner, FluxError::Unauthorized);
        coll.available_margin = coll.available_margin.saturating_add(prize);
        coll.deposited = coll.deposited.saturating_add(prize);
        coll.exit(&crate::ID)?;
    }

    lb.winner = winner;
    lb.vrf_result = randomness;
    lb.vrf_pending = false;
    if lb.history.len() >= MAX_HISTORY {
        lb.history.remove(0);
    }
    let epoch = lb.epoch;
    lb.history.push(WinnerRecord {
        epoch,
        winner,
        prize,
        vrf_result: randomness,
        candidates: n as u32,
        ts: now,
    });

    lb.epoch += 1;
    lb.start_ts = now;
    lb.end_ts = now + lb.epoch_duration;
    lb.entries.clear();
    lb.candidates.clear();
    lb.prize_pool = 0;

    emit!(TournamentSettled {
        epoch: lb.epoch - 1,
        winner,
        prize,
        candidates: n as u32,
        vrf_result: randomness,
        ts: now,
    });
    Ok(())
}
