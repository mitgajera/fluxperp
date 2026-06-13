use anchor_lang::prelude::*;

use crate::errors::FluxError;
use crate::instructions::oracle::read_price;
use crate::matching::{execute_taker_order, notional, MakerSet};
use crate::state::*;

#[derive(Accounts)]
#[instruction(market_index: u8, trader: Pubkey)]
pub struct Liquidate<'info> {
    pub liquidator: Signer<'info>,
    #[account(seeds = [MARKET_SEED, &[market_index]], bump = market_config.bump)]
    pub market_config: Account<'info, MarketConfig>,
    #[account(seeds = [PRICE_SEED, &[market_index]], bump = price_feed.bump)]
    pub price_feed: Account<'info, PriceFeed>,
    #[account(mut, seeds = [ORDERBOOK_SEED, &[market_index]], bump = orderbook.bump)]
    pub orderbook: Account<'info, OrderbookState>,
    #[account(mut, seeds = [FILL_LOG_SEED, &[market_index]], bump = fill_log.bump)]
    pub fill_log: Account<'info, FillLog>,
    #[account(
        mut,
        seeds = [POSITION_SEED, trader.as_ref(), &[market_index]],
        bump = trader_position.bump,
        constraint = trader_position.user == trader @ FluxError::Unauthorized,
    )]
    pub trader_position: Account<'info, PositionAccount>,
    #[account(
        mut,
        seeds = [COLLATERAL_SEED, trader.as_ref()],
        bump = trader_collateral.bump,
        constraint = trader_collateral.user == trader @ FluxError::Unauthorized,
    )]
    pub trader_collateral: Account<'info, CollateralAccount>,
    #[account(
        mut,
        seeds = [COLLATERAL_SEED, liquidator.key().as_ref()],
        bump = liquidator_collateral.bump,
        constraint = liquidator_collateral.user == liquidator.key() @ FluxError::Unauthorized,
    )]
    pub liquidator_collateral: Account<'info, CollateralAccount>,
}

pub fn liquidate<'info>(
    ctx: Context<'_, '_, '_, 'info, Liquidate<'info>>,
    market_index: u8,
    trader: Pubkey,
) -> Result<()> {
    let (mark, _index) = read_price(&ctx.accounts.price_feed);
    require!(mark > 0, FluxError::InvalidPrice);

    let (side, close_size, health) = {
        let p = &ctx.accounts.trader_position;
        require!(p.side != PositionSide::Flat, FluxError::NoOpenPosition);
        (p.side, p.size, p.health_bps(mark))
    };
    require!(health < MAINTENANCE_MARGIN_BPS, FluxError::NotLiquidatable);

    let closed_notional = notional(close_size, mark);
    let liq_side = match side {
        PositionSide::Long => Side::Short,

        PositionSide::Short => Side::Long,

        PositionSide::Flat => return err!(FluxError::NoOpenPosition),
    };
    let max_leverage = ctx.accounts.market_config.max_leverage;
    let now = Clock::get()?.unix_timestamp;

    let mut makers = MakerSet::load(ctx.remaining_accounts, &crate::ID, &trader)?;
    let filled = execute_taker_order(
        &mut ctx.accounts.orderbook,
        &mut ctx.accounts.fill_log,
        trader,
        &mut ctx.accounts.trader_position,
        &mut ctx.accounts.trader_collateral,
        &mut makers,
        liq_side,
        0,
        close_size,
        OrderType::Market,
        max_leverage,
        market_index,
        now,
    )?;
    require!(filled > 0, FluxError::NoLiquidity);
    makers.write_back()?;

    let liq_fee = ((closed_notional as u128 * LIQUIDATION_FEE_BPS as u128)
        / BPS_DENOMINATOR as u128) as u64;
    let bounty = ((liq_fee as u128 * LIQUIDATOR_BOUNTY_SHARE_BPS as u128)
        / BPS_DENOMINATOR as u128) as u64;
    let insurance_share = liq_fee - bounty;

    let charged = liq_fee.min(ctx.accounts.trader_collateral.available_margin);
    let bad_debt = liq_fee - charged;

    {
        let tc = &mut ctx.accounts.trader_collateral;
        tc.available_margin -= charged;
        tc.fees_paid = tc
            .fees_paid
            .checked_add(charged as i64)
            .ok_or(FluxError::MathOverflow)?;
    }

    {
        let lc = &mut ctx.accounts.liquidator_collateral;
        lc.available_margin = lc
            .available_margin
            .checked_add(bounty)
            .ok_or(FluxError::MathOverflow)?;
    }

    emit!(LiquidationEvent {
        market_index,
        trader,
        liquidator: ctx.accounts.liquidator.key(),
        closed_size: filled,
        closed_notional,
        liquidation_fee: liq_fee,
        liquidator_bounty: bounty,
        insurance_share,
        bad_debt,
        ts: now,
    });

    Ok(())
}
