use anchor_lang::prelude::*;
use anchor_lang::InstructionData;
use ephemeral_rollups_sdk::anchor::{action, commit};
use ephemeral_rollups_sdk::ephem::{
    CallHandler, FoldableIntentBuilder, MagicIntentBundleBuilder,
};
use ephemeral_rollups_sdk::{ActionArgs, ShortAccountMeta};

use crate::errors::FluxError;
use crate::state::*;

#[action]
#[derive(Accounts)]
pub struct SettleToL1<'info> {
    #[account(mut, seeds = [INSURANCE_SEED], bump = insurance_fund.bump)]
    pub insurance_fund: Account<'info, InsuranceFund>,
}

pub fn settle_to_l1(
    ctx: Context<SettleToL1>,
    insurance_delta: u64,
    protocol_delta: u64,
) -> Result<()> {
    let _ = &ctx.accounts.escrow;

    let fund = &mut ctx.accounts.insurance_fund;
    fund.balance = fund
        .balance
        .checked_add(insurance_delta)
        .ok_or(FluxError::MathOverflow)?;

    msg!(
        "settle_to_l1: insurance +{} protocol +{} -> insurance.balance={}",
        insurance_delta,
        protocol_delta,
        fund.balance
    );
    Ok(())
}

#[commit]
#[derive(Accounts)]
pub struct CommitState<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: InsuranceFund on L1 — target of the settle_to_l1 action.
    pub insurance_fund: UncheckedAccount<'info>,
    // remaining_accounts: the per-user financial accounts to settle to L1
    // (taker + maker PositionAccount / CollateralAccount pairs). The orderbook,
    // fill_log, and price_feed stay ER-ephemeral — committing those shared,
    // high-frequency accounts collides with the live publisher/market-maker (0xa0000000).
}

pub fn commit_state<'info>(
    ctx: Context<'_, '_, '_, 'info, CommitState<'info>>,
    _market_index: u8,
    insurance_delta: u64,
    protocol_delta: u64,
) -> Result<()> {
    let data = crate::instruction::SettleToL1 {
        insurance_delta,
        protocol_delta,
    }
    .data();

    let mut insurance_meta =
        ShortAccountMeta::from(&ctx.accounts.insurance_fund.to_account_info());
    insurance_meta.is_writable = true;

    let action = CallHandler {
        destination_program: crate::ID,
        accounts: vec![insurance_meta],
        args: ActionArgs::new(data),
        escrow_authority: ctx.accounts.payer.to_account_info(),
        compute_units: 200_000,
    };

    let commit_accounts: Vec<_> = ctx.remaining_accounts.to_vec();

    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit(&commit_accounts)
    .add_post_commit_actions([action])
    .build_and_invoke()?;

    Ok(())
}

#[commit]
#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct UndelegateUser<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [COLLATERAL_SEED, user.key().as_ref()],
        bump = collateral.bump,
        constraint = collateral.user == user.key() @ FluxError::Unauthorized,
    )]
    pub collateral: Account<'info, CollateralAccount>,
    #[account(
        mut,
        seeds = [POSITION_SEED, user.key().as_ref(), &[market_index]],
        bump = position.bump,
    )]
    pub position: Account<'info, PositionAccount>,
    #[account(
        mut,
        seeds = [TRIGGERS_SEED, user.key().as_ref(), &[market_index]],
        bump = triggers.bump,
    )]
    pub triggers: Account<'info, TriggerOrders>,
}

pub fn undelegate_user<'info>(
    ctx: Context<'_, '_, '_, 'info, UndelegateUser<'info>>,
    _market_index: u8,
) -> Result<()> {
    AccountsExit::exit(&ctx.accounts.collateral, &crate::ID)?;
    AccountsExit::exit(&ctx.accounts.position, &crate::ID)?;
    AccountsExit::exit(&ctx.accounts.triggers, &crate::ID)?;

    let accounts = vec![
        ctx.accounts.collateral.to_account_info(),
        ctx.accounts.position.to_account_info(),
        ctx.accounts.triggers.to_account_info(),
    ];

    MagicIntentBundleBuilder::new(
        ctx.accounts.user.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&accounts)
    .build_and_invoke()?;

    Ok(())
}
