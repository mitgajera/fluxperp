use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::errors::FluxError;
use crate::state::*;

fn pinned_config() -> DelegateConfig {
    DelegateConfig {
        validator: Some(ephemeral_rollups_sdk::compat::Pubkey::new_from_array(
            ER_VALIDATOR.to_bytes(),
        )),
        ..DelegateConfig::default()
    }
}

#[derive(Accounts)]
pub struct DepositCollateral<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [COLLATERAL_SEED, user.key().as_ref()],
        bump = collateral.bump,
        has_one = user
    )]
    pub collateral: Account<'info, CollateralAccount>,
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ FluxError::Unauthorized,
        constraint = user_token_account.mint == vault.mint @ FluxError::MarketMismatch
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut, seeds = [VAULT_SEED], bump)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn deposit_collateral(ctx: Context<DepositCollateral>, amount: u64) -> Result<()> {
    require!(amount > 0, FluxError::InvalidAmount);

    let cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    );
    token::transfer(cpi, amount)?;

    let c = &mut ctx.accounts.collateral;
    c.deposited = c.deposited.checked_add(amount).ok_or(FluxError::MathOverflow)?;
    c.available_margin = c
        .available_margin
        .checked_add(amount)
        .ok_or(FluxError::MathOverflow)?;

    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawCollateral<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [COLLATERAL_SEED, user.key().as_ref()],
        bump = collateral.bump,
        has_one = user
    )]
    pub collateral: Account<'info, CollateralAccount>,
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ FluxError::Unauthorized,
        constraint = user_token_account.mint == vault.mint @ FluxError::MarketMismatch
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut, seeds = [VAULT_SEED], bump)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn withdraw_collateral(ctx: Context<WithdrawCollateral>, amount: u64) -> Result<()> {
    require!(amount > 0, FluxError::InvalidAmount);

    let c = &ctx.accounts.collateral;

    require!(c.margin_used == 0, FluxError::OpenPositionsExist);
    require!(amount <= c.available_margin, FluxError::InsufficientFunds);

    let vault_bump = ctx.bumps.vault;
    let signer_seeds: &[&[&[u8]]] = &[&[VAULT_SEED, &[vault_bump]]];
    let cpi = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(cpi, amount)?;

    let c = &mut ctx.accounts.collateral;
    c.deposited = c.deposited.checked_sub(amount).ok_or(FluxError::MathOverflow)?;
    c.available_margin = c
        .available_margin
        .checked_sub(amount)
        .ok_or(FluxError::MathOverflow)?;

    Ok(())
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateCollateral<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: CollateralAccount PDA, validated by seeds; delegated to the ER.

    #[account(mut, del, seeds = [COLLATERAL_SEED, payer.key().as_ref()], bump)]
    pub collateral: AccountInfo<'info>,
}

pub fn delegate_collateral(ctx: Context<DelegateCollateral>) -> Result<()> {
    let user = ctx.accounts.payer.key();
    ctx.accounts.delegate_collateral(
        &ctx.accounts.payer,
        &[COLLATERAL_SEED, user.as_ref()],
        pinned_config(),
    )?;
    Ok(())
}

#[delegate]
#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct DelegatePosition<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: PositionAccount PDA, validated by seeds; delegated to the ER.

    #[account(mut, del, seeds = [POSITION_SEED, payer.key().as_ref(), &[market_index]], bump)]
    pub position: AccountInfo<'info>,
}

pub fn delegate_position(ctx: Context<DelegatePosition>, market_index: u8) -> Result<()> {
    let user = ctx.accounts.payer.key();
    ctx.accounts.delegate_position(
        &ctx.accounts.payer,
        &[POSITION_SEED, user.as_ref(), &[market_index]],
        pinned_config(),
    )?;
    Ok(())
}

#[delegate]
#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct DelegateTriggers<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: TriggerOrders PDA, validated by seeds; delegated to the ER.

    #[account(mut, del, seeds = [TRIGGERS_SEED, payer.key().as_ref(), &[market_index]], bump)]
    pub triggers: AccountInfo<'info>,
}

pub fn delegate_triggers(ctx: Context<DelegateTriggers>, market_index: u8) -> Result<()> {
    let user = ctx.accounts.payer.key();
    ctx.accounts.delegate_triggers(
        &ctx.accounts.payer,
        &[TRIGGERS_SEED, user.as_ref(), &[market_index]],
        pinned_config(),
    )?;
    Ok(())
}

#[delegate]
#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct DelegateOrderbook<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: OrderbookState PDA, validated by seeds; delegated to the ER.

    #[account(mut, del, seeds = [ORDERBOOK_SEED, &[market_index]], bump)]
    pub orderbook: AccountInfo<'info>,
}

pub fn delegate_orderbook(ctx: Context<DelegateOrderbook>, market_index: u8) -> Result<()> {
    ctx.accounts.delegate_orderbook(
        &ctx.accounts.payer,
        &[ORDERBOOK_SEED, &[market_index]],
        pinned_config(),
    )?;
    Ok(())
}

#[delegate]
#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct DelegateFillLog<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: FillLog PDA, validated by seeds; delegated to the ER.

    #[account(mut, del, seeds = [FILL_LOG_SEED, &[market_index]], bump)]
    pub fill_log: AccountInfo<'info>,
}

pub fn delegate_fill_log(ctx: Context<DelegateFillLog>, market_index: u8) -> Result<()> {
    ctx.accounts.delegate_fill_log(
        &ctx.accounts.payer,
        &[FILL_LOG_SEED, &[market_index]],
        pinned_config(),
    )?;
    Ok(())
}

#[delegate]
#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct DelegatePriceFeed<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: PriceFeed PDA, validated by seeds; delegated to the ER.

    #[account(mut, del, seeds = [PRICE_SEED, &[market_index]], bump)]
    pub price_feed: AccountInfo<'info>,
}

pub fn delegate_price_feed(ctx: Context<DelegatePriceFeed>, market_index: u8) -> Result<()> {
    ctx.accounts.delegate_price_feed(
        &ctx.accounts.payer,
        &[PRICE_SEED, &[market_index]],
        pinned_config(),
    )?;
    Ok(())
}

#[delegate]
#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct DelegateRisk<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: RiskEngine PDA, validated by seeds; delegated to the ER.

    #[account(mut, del, seeds = [RISK_SEED, &[market_index]], bump)]
    pub risk_engine: AccountInfo<'info>,
}

pub fn delegate_risk(ctx: Context<DelegateRisk>, market_index: u8) -> Result<()> {
    ctx.accounts.delegate_risk_engine(
        &ctx.accounts.payer,
        &[RISK_SEED, &[market_index]],
        pinned_config(),
    )?;
    Ok(())
}

#[delegate]
#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct DelegateAdvanced<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: AdvancedOrders PDA, validated by seeds; delegated to the ER.

    #[account(mut, del, seeds = [ADV_SEED, payer.key().as_ref(), &[market_index]], bump)]
    pub advanced: AccountInfo<'info>,
}

pub fn delegate_advanced(ctx: Context<DelegateAdvanced>, market_index: u8) -> Result<()> {
    let user = ctx.accounts.payer.key();
    ctx.accounts.delegate_advanced(
        &ctx.accounts.payer,
        &[ADV_SEED, user.as_ref(), &[market_index]],
        pinned_config(),
    )?;
    Ok(())
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateMargin<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: MarginProfile PDA, validated by seeds; delegated to the ER.

    #[account(mut, del, seeds = [MARGIN_SEED, payer.key().as_ref()], bump)]
    pub margin_profile: AccountInfo<'info>,
}

pub fn delegate_margin(ctx: Context<DelegateMargin>) -> Result<()> {
    let user = ctx.accounts.payer.key();
    ctx.accounts.delegate_margin_profile(
        &ctx.accounts.payer,
        &[MARGIN_SEED, user.as_ref()],
        pinned_config(),
    )?;
    Ok(())
}
