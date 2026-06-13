use anchor_lang::prelude::*;

use crate::errors::FluxError;
use crate::matching::{insert_sorted, notional};
use crate::state::*;

fn book_order_size(ob: &OrderbookState, id: u64) -> Option<u64> {
    ob.bids
        .iter()
        .chain(ob.asks.iter())
        .find(|o| o.order_id == id)
        .map(|o| o.size)
}

fn remove_book_order(ob: &mut OrderbookState, id: u64) {
    if let Some(i) = ob.bids.iter().position(|o| o.order_id == id) {
        ob.bids.remove(i);
        return;
    }
    if let Some(i) = ob.asks.iter().position(|o| o.order_id == id) {
        ob.asks.remove(i);
    }
}

fn place_slice(ob: &mut OrderbookState, owner: Pubkey, side: Side, price: u64, size: u64, now: i64) -> Result<u64> {
    let len = if side == Side::Long { ob.bids.len() } else { ob.asks.len() };
    require!(len < MAX_ORDERS_PER_SIDE, FluxError::OrderbookFull);
    let id = ob.next_order_id;
    ob.next_order_id += 1;
    let order = Order { order_id: id, owner, price, size, timestamp: now };
    let book = if side == Side::Long { &mut ob.bids } else { &mut ob.asks };
    insert_sorted(book, order, side);
    Ok(id)
}

#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct InitializeAdvanced<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [MARKET_SEED, &[market_index]], bump = market_config.bump)]
    pub market_config: Account<'info, MarketConfig>,
    #[account(
        init,
        payer = user,
        space = AdvancedOrders::LEN,
        seeds = [ADV_SEED, user.key().as_ref(), &[market_index]],
        bump
    )]
    pub advanced: Account<'info, AdvancedOrders>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_advanced(ctx: Context<InitializeAdvanced>, market_index: u8) -> Result<()> {
    let a = &mut ctx.accounts.advanced;
    a.user = ctx.accounts.user.key();
    a.market_index = market_index;
    a.orders = Vec::new();
    a.next_adv_id = 1;
    a.bump = ctx.bumps.advanced;
    Ok(())
}

#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct PlaceAdvancedOrder<'info> {
    pub user: Signer<'info>,
    #[account(seeds = [MARKET_SEED, &[market_index]], bump = market_config.bump)]
    pub market_config: Account<'info, MarketConfig>,
    #[account(mut, seeds = [ORDERBOOK_SEED, &[market_index]], bump = orderbook.bump)]
    pub orderbook: Account<'info, OrderbookState>,
    #[account(
        mut,
        seeds = [ADV_SEED, user.key().as_ref(), &[market_index]],
        bump = advanced.bump,
        constraint = advanced.user == user.key() @ FluxError::Unauthorized,
    )]
    pub advanced: Account<'info, AdvancedOrders>,
    #[account(mut, seeds = [COLLATERAL_SEED, user.key().as_ref()], bump = collateral.bump)]
    pub collateral: Account<'info, CollateralAccount>,

    #[account(seeds = [RISK_SEED, &[market_index]], bump = risk_engine.bump)]
    pub risk_engine: Option<Account<'info, RiskEngine>>,
}

#[allow(clippy::too_many_arguments)]
pub fn place_advanced_order(
    ctx: Context<PlaceAdvancedOrder>,
    _market_index: u8,
    side: Side,
    price: u64,
    total_size: u64,
    display_size: u64,
    slice_interval: i64,
    expiry_ts: i64,
    kind: AdvOrderKind,
) -> Result<()> {
    let (lot, tick, static_max) = {
        let mc = &ctx.accounts.market_config;
        (mc.lot_size, mc.tick_size, mc.max_leverage)
    };
    let max_leverage = ctx
        .accounts
        .risk_engine
        .as_ref()
        .map(|r| r.leverage_cap.min(static_max))
        .unwrap_or(static_max);

    require!(total_size >= lot && display_size >= lot, FluxError::SizeBelowLot);
    require!(display_size <= total_size, FluxError::InvalidAmount);
    require!(price > 0 && price % tick == 0, FluxError::PriceNotAligned);
    require!(ctx.accounts.advanced.orders.len() < MAX_ADV_ORDERS, FluxError::CapacityExceeded);

    let req = notional(total_size, price).div_ceil(max_leverage as u64);
    require!(ctx.accounts.collateral.available_margin >= req, FluxError::InsufficientMargin);

    let now = Clock::get()?.unix_timestamp;
    let user = ctx.accounts.user.key();
    let slice = display_size.min(total_size);
    let resting_id = place_slice(&mut ctx.accounts.orderbook, user, side, price, slice, now)?;

    let adv = &mut ctx.accounts.advanced;
    let adv_id = adv.next_adv_id;
    adv.next_adv_id += 1;
    adv.orders.push(AdvancedOrder {
        id: adv_id,
        kind,
        side,
        price,
        total_size,
        filled: 0,
        display_size,
        slice_interval,
        expiry_ts,
        last_slice_ts: now,
        resting_order_id: resting_id,
        resting_size: slice,
    });

    emit!(AdvancedSlice {
        market_index: _market_index,
        user,
        adv_id,
        kind,
        slice_size: slice,
        filled: 0,
        total_size,
        resting_order_id: resting_id,
        ts: now,
    });
    Ok(())
}

#[derive(Accounts)]
#[instruction(market_index: u8, trader: Pubkey)]
pub struct CrankAdvanced<'info> {
    pub cranker: Signer<'info>,
    #[account(mut, seeds = [ORDERBOOK_SEED, &[market_index]], bump = orderbook.bump)]
    pub orderbook: Account<'info, OrderbookState>,
    #[account(
        mut,
        seeds = [ADV_SEED, trader.as_ref(), &[market_index]],
        bump = advanced.bump,
        constraint = advanced.user == trader @ FluxError::Unauthorized,
    )]
    pub advanced: Account<'info, AdvancedOrders>,
}

pub fn crank_twap(ctx: Context<CrankAdvanced>, market_index: u8, trader: Pubkey) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let ob = &mut ctx.accounts.orderbook;
    let adv = &mut ctx.accounts.advanced;

    for o in adv.orders.iter_mut() {
        let remaining = book_order_size(ob, o.resting_order_id).unwrap_or(0);
        let consumed = o.resting_size.saturating_sub(remaining);
        o.filled = o.filled.saturating_add(consumed);
        o.resting_size = remaining;

        if o.filled >= o.total_size {
            continue;
        }

        let reveal = match o.kind {
            AdvOrderKind::Iceberg => remaining == 0,
            AdvOrderKind::Twap => now - o.last_slice_ts >= o.slice_interval,
            AdvOrderKind::Gtt => false,
        };
        if !reveal {
            continue;
        }

        if remaining > 0 {
            remove_book_order(ob, o.resting_order_id);
        }
        let slice = o.display_size.min(o.total_size - o.filled);
        let id = place_slice(ob, trader, o.side, o.price, slice, now)?;
        o.resting_order_id = id;
        o.resting_size = slice;
        o.last_slice_ts = now;

        emit!(AdvancedSlice {
            market_index,
            user: trader,
            adv_id: o.id,
            kind: o.kind,
            slice_size: slice,
            filled: o.filled,
            total_size: o.total_size,
            resting_order_id: id,
            ts: now,
        });
    }

    adv.orders.retain(|o| o.filled < o.total_size);
    Ok(())
}

pub fn reap_expired(ctx: Context<CrankAdvanced>, market_index: u8, trader: Pubkey) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let ob = &mut ctx.accounts.orderbook;
    let adv = &mut ctx.accounts.advanced;

    let mut reaped = 0u32;
    for o in adv.orders.iter() {
        if o.expiry_ts > 0 && now > o.expiry_ts {
            remove_book_order(ob, o.resting_order_id);
            emit!(AdvancedReaped { market_index, user: trader, adv_id: o.id, ts: now });
            reaped += 1;
        }
    }
    adv.orders.retain(|o| !(o.expiry_ts > 0 && now > o.expiry_ts));
    require!(reaped > 0, FluxError::NoTriggersFired);
    Ok(())
}
