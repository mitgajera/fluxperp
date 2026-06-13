use anchor_lang::prelude::*;

use crate::errors::FluxError;
use crate::instructions::oracle::read_price;
use crate::matching::{execute_taker_order, MakerSet};
use crate::state::*;

fn trigger_crossed(t: &TriggerOrder, mark: u64) -> bool {
    match (t.kind, t.fire_side) {
        (TriggerKind::StopLoss, Side::Short) => mark <= t.trigger_price,

        (TriggerKind::TakeProfit, Side::Short) => mark >= t.trigger_price,

        (TriggerKind::StopLoss, Side::Long) => mark >= t.trigger_price,

        (TriggerKind::TakeProfit, Side::Long) => mark <= t.trigger_price,
    }
}

#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct ManageTrigger<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [TRIGGERS_SEED, user.key().as_ref(), &[market_index]],
        bump = triggers.bump,
        constraint = triggers.user == user.key() @ FluxError::Unauthorized,
    )]
    pub triggers: Account<'info, TriggerOrders>,
}

pub fn place_trigger(
    ctx: Context<ManageTrigger>,
    _market_index: u8,
    kind: TriggerKind,
    trigger_price: u64,
    size: u64,
    fire_side: Side,
) -> Result<()> {
    require!(trigger_price > 0 && size > 0, FluxError::InvalidAmount);
    let t = &mut ctx.accounts.triggers;
    require!(t.triggers.len() < MAX_TRIGGERS, FluxError::TriggersFull);
    t.triggers.push(TriggerOrder {
        kind,
        trigger_price,
        size,
        fire_side,
    });
    Ok(())
}

pub fn cancel_trigger(
    ctx: Context<ManageTrigger>,
    _market_index: u8,
    kind: TriggerKind,
    trigger_price: u64,
    size: u64,
    fire_side: Side,
) -> Result<()> {
    let t = &mut ctx.accounts.triggers;
    let idx = t
        .triggers
        .iter()
        .position(|x| {
            x.kind == kind
                && x.trigger_price == trigger_price
                && x.size == size
                && x.fire_side == fire_side
        })
        .ok_or_else(|| error!(FluxError::TriggerNotFound))?;
    t.triggers.remove(idx);
    Ok(())
}

#[derive(Accounts)]
#[instruction(market_index: u8, trader: Pubkey)]
pub struct CrankTriggers<'info> {
    pub cranker: Signer<'info>,
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
        seeds = [TRIGGERS_SEED, trader.as_ref(), &[market_index]],
        bump = trader_triggers.bump,
        constraint = trader_triggers.user == trader @ FluxError::Unauthorized,
    )]
    pub trader_triggers: Account<'info, TriggerOrders>,
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
}

pub fn crank_triggers<'info>(
    ctx: Context<'_, '_, '_, 'info, CrankTriggers<'info>>,
    market_index: u8,
    trader: Pubkey,
) -> Result<()> {
    let (mark, _index) = read_price(&ctx.accounts.price_feed);
    require!(mark > 0, FluxError::InvalidPrice);
    let max_leverage = ctx.accounts.market_config.max_leverage;
    let now = Clock::get()?.unix_timestamp;

    let crossed: Vec<TriggerOrder> = ctx
        .accounts
        .trader_triggers
        .triggers
        .iter()
        .copied()
        .filter(|t| trigger_crossed(t, mark))
        .collect();
    require!(!crossed.is_empty(), FluxError::NoTriggersFired);

    let mut makers = MakerSet::load(ctx.remaining_accounts, &crate::ID, &trader)?;

    for t in crossed.iter() {
        let filled = execute_taker_order(
            &mut ctx.accounts.orderbook,
            &mut ctx.accounts.fill_log,
            trader,
            &mut ctx.accounts.trader_position,
            &mut ctx.accounts.trader_collateral,
            &mut makers,
            t.fire_side,
            0,
            t.size,
            OrderType::Market,
            max_leverage,
            market_index,
            now,
        )?;
        emit!(TriggerFired {
            market_index,
            user: trader,
            kind: t.kind,
            trigger_price: t.trigger_price,
            mark_price: mark,
            size: filled,
            ts: now,
        });
    }
    makers.write_back()?;

    ctx.accounts
        .trader_triggers
        .triggers
        .retain(|t| !trigger_crossed(t, mark));

    Ok(())
}
