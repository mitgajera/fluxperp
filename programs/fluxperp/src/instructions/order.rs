use anchor_lang::prelude::*;

use crate::errors::FluxError;
use crate::matching::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct PlaceOrder<'info> {
    pub taker: Signer<'info>,
    #[account(seeds = [MARKET_SEED, &[market_index]], bump = market_config.bump)]
    pub market_config: Account<'info, MarketConfig>,
    #[account(mut, seeds = [ORDERBOOK_SEED, &[market_index]], bump = orderbook.bump)]
    pub orderbook: Account<'info, OrderbookState>,
    #[account(mut, seeds = [FILL_LOG_SEED, &[market_index]], bump = fill_log.bump)]
    pub fill_log: Account<'info, FillLog>,
    #[account(
        mut,
        seeds = [POSITION_SEED, taker.key().as_ref(), &[market_index]],
        bump = taker_position.bump,
        constraint = taker_position.user == taker.key() @ FluxError::Unauthorized,
    )]
    pub taker_position: Account<'info, PositionAccount>,
    #[account(
        mut,
        seeds = [COLLATERAL_SEED, taker.key().as_ref()],
        bump = taker_collateral.bump,
        constraint = taker_collateral.user == taker.key() @ FluxError::Unauthorized,
    )]
    pub taker_collateral: Account<'info, CollateralAccount>,

    #[account(seeds = [RISK_SEED, &[market_index]], bump = risk_engine.bump)]
    pub risk_engine: Option<Account<'info, RiskEngine>>,

    #[account(
        seeds = [MARGIN_SEED, taker.key().as_ref()],
        bump = margin_profile.bump,
        constraint = margin_profile.user == taker.key() @ FluxError::Unauthorized,
    )]
    pub margin_profile: Option<Account<'info, MarginProfile>>,
}

pub fn place_order(
    ctx: Context<PlaceOrder>,
    market_index: u8,
    side: Side,
    price: u64,
    size: u64,
    order_type: OrderType,
) -> Result<()> {
    let (lot, tick, static_max) = {
        let mc = &ctx.accounts.market_config;
        (mc.lot_size, mc.tick_size, mc.max_leverage)
    };

    let (max_leverage, circuit_breaker, band_bps, band_ref) =
        match ctx.accounts.risk_engine.as_ref() {
            Some(r) => (
                r.leverage_cap.min(static_max),
                r.circuit_breaker,
                r.price_band_bps as u64,
                r.last_price,
            ),
            None => (static_max, false, 0, 0),
        };

    require!(size >= lot, FluxError::SizeBelowLot);
    require!(size % lot == 0, FluxError::SizeNotAligned);

    if circuit_breaker && order_type == OrderType::Limit && band_ref > 0 {
        let dist = (price as i128 - band_ref as i128).unsigned_abs();
        let max_dist = (band_ref as u128) * band_bps as u128 / 10_000;
        require!(dist <= max_dist, FluxError::PriceNotAligned);
    }

    if order_type == OrderType::Limit {
        require!(price > 0, FluxError::InvalidPrice);
        require!(price % tick == 0, FluxError::PriceNotAligned);

        let mut req = notional(size, price).div_ceil(max_leverage as u64);

        if let Some(mp) = ctx.accounts.margin_profile.as_ref() {
            let opposes = matches!(
                (side, mp.net_side),
                (Side::Long, PositionSide::Short) | (Side::Short, PositionSide::Long)
            );
            if opposes {
                let credit = req * OFFSET_CREDIT_BPS / BPS_DENOMINATOR as u64;
                req = req.saturating_sub(credit);
            }
        }
        require!(
            ctx.accounts.taker_collateral.available_margin >= req,
            FluxError::InsufficientMargin
        );
    }

    let now = Clock::get()?.unix_timestamp;
    let taker_key = ctx.accounts.taker.key();
    let mut makers = MakerSet::load(ctx.remaining_accounts, &crate::ID, &taker_key)?;

    let filled = execute_taker_order(
        &mut ctx.accounts.orderbook,
        &mut ctx.accounts.fill_log,
        taker_key,
        &mut ctx.accounts.taker_position,
        &mut ctx.accounts.taker_collateral,
        &mut makers,
        side,
        price,
        size,
        order_type,
        max_leverage,
        market_index,
        now,
    )?;

    match order_type {
        OrderType::Market => require!(filled > 0, FluxError::NoLiquidity),
        OrderType::Limit => {
            let remaining = size - filled;
            if remaining > 0 {
                let ob = &mut *ctx.accounts.orderbook;
                let len = if side == Side::Long {
                    ob.bids.len()
                } else {
                    ob.asks.len()
                };
                require!(len < MAX_ORDERS_PER_SIDE, FluxError::OrderbookFull);
                let id = ob.next_order_id;
                ob.next_order_id += 1;
                let order = Order {
                    order_id: id,
                    owner: taker_key,
                    price,
                    size: remaining,
                    timestamp: now,
                };
                let book = if side == Side::Long {
                    &mut ob.bids
                } else {
                    &mut ob.asks
                };
                insert_sorted(book, order, side);
            }
        }
    }

    makers.write_back()?;
    Ok(())
}

#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct CancelOrder<'info> {
    pub owner: Signer<'info>,
    #[account(mut, seeds = [ORDERBOOK_SEED, &[market_index]], bump = orderbook.bump)]
    pub orderbook: Account<'info, OrderbookState>,
}

pub fn cancel_order(ctx: Context<CancelOrder>, _market_index: u8, order_id: u64) -> Result<()> {
    let owner = ctx.accounts.owner.key();
    let ob = &mut *ctx.accounts.orderbook;

    if let Some(i) = ob.bids.iter().position(|o| o.order_id == order_id) {
        require!(ob.bids[i].owner == owner, FluxError::Unauthorized);
        ob.bids.remove(i);
        return Ok(());
    }
    if let Some(i) = ob.asks.iter().position(|o| o.order_id == order_id) {
        require!(ob.asks[i].owner == owner, FluxError::Unauthorized);
        ob.asks.remove(i);
        return Ok(());
    }
    err!(FluxError::OrderNotFound)
}

#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct ResetOrderbook<'info> {
    #[account(constraint = authority.key() == market_config.authority @ FluxError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(seeds = [MARKET_SEED, &[market_index]], bump = market_config.bump)]
    pub market_config: Account<'info, MarketConfig>,
    #[account(mut, seeds = [ORDERBOOK_SEED, &[market_index]], bump = orderbook.bump)]
    pub orderbook: Account<'info, OrderbookState>,
}

pub fn reset_orderbook(ctx: Context<ResetOrderbook>, _market_index: u8) -> Result<()> {
    let ob = &mut ctx.accounts.orderbook;
    ob.bids.clear();
    ob.asks.clear();
    Ok(())
}

#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct ClosePosition<'info> {
    pub taker: Signer<'info>,
    #[account(seeds = [MARKET_SEED, &[market_index]], bump = market_config.bump)]
    pub market_config: Account<'info, MarketConfig>,
    #[account(mut, seeds = [ORDERBOOK_SEED, &[market_index]], bump = orderbook.bump)]
    pub orderbook: Account<'info, OrderbookState>,
    #[account(mut, seeds = [FILL_LOG_SEED, &[market_index]], bump = fill_log.bump)]
    pub fill_log: Account<'info, FillLog>,
    #[account(
        mut,
        seeds = [POSITION_SEED, taker.key().as_ref(), &[market_index]],
        bump = taker_position.bump,
        constraint = taker_position.user == taker.key() @ FluxError::Unauthorized,
    )]
    pub taker_position: Account<'info, PositionAccount>,
    #[account(
        mut,
        seeds = [COLLATERAL_SEED, taker.key().as_ref()],
        bump = taker_collateral.bump,
        constraint = taker_collateral.user == taker.key() @ FluxError::Unauthorized,
    )]
    pub taker_collateral: Account<'info, CollateralAccount>,
}

pub fn close_position(ctx: Context<ClosePosition>, market_index: u8) -> Result<()> {
    let (pos_side, close_size) = {
        let p = &ctx.accounts.taker_position;
        (p.side, p.size)
    };
    require!(pos_side != PositionSide::Flat, FluxError::NoOpenPosition);

    let side = match pos_side {
        PositionSide::Long => Side::Short,

        PositionSide::Short => Side::Long,

        PositionSide::Flat => return err!(FluxError::NoOpenPosition),
    };
    let max_leverage = ctx.accounts.market_config.max_leverage;
    let now = Clock::get()?.unix_timestamp;
    let taker_key = ctx.accounts.taker.key();
    let mut makers = MakerSet::load(ctx.remaining_accounts, &crate::ID, &taker_key)?;

    let filled = execute_taker_order(
        &mut ctx.accounts.orderbook,
        &mut ctx.accounts.fill_log,
        taker_key,
        &mut ctx.accounts.taker_position,
        &mut ctx.accounts.taker_collateral,
        &mut makers,
        side,
        0,

        close_size,
        OrderType::Market,
        max_leverage,
        market_index,
        now,
    )?;
    require!(filled > 0, FluxError::NoLiquidity);

    makers.write_back()?;
    Ok(())
}

pub fn reverse_position(ctx: Context<ClosePosition>, market_index: u8) -> Result<()> {
    let (pos_side, size) = {
        let p = &ctx.accounts.taker_position;
        (p.side, p.size)
    };
    require!(pos_side != PositionSide::Flat, FluxError::NoOpenPosition);
    let side = match pos_side {
        PositionSide::Long => Side::Short,
        PositionSide::Short => Side::Long,
        PositionSide::Flat => return err!(FluxError::NoOpenPosition),
    };
    let order_size = size.checked_mul(2).ok_or(FluxError::MathOverflow)?;
    let max_leverage = ctx.accounts.market_config.max_leverage;
    let now = Clock::get()?.unix_timestamp;
    let taker_key = ctx.accounts.taker.key();
    let mut makers = MakerSet::load(ctx.remaining_accounts, &crate::ID, &taker_key)?;

    let filled = execute_taker_order(
        &mut ctx.accounts.orderbook,
        &mut ctx.accounts.fill_log,
        taker_key,
        &mut ctx.accounts.taker_position,
        &mut ctx.accounts.taker_collateral,
        &mut makers,
        side,
        0,
        order_size,
        OrderType::Market,
        max_leverage,
        market_index,
        now,
    )?;
    require!(filled > 0, FluxError::NoLiquidity);

    makers.write_back()?;
    Ok(())
}

pub fn scale_in_out(
    ctx: Context<ClosePosition>,
    market_index: u8,
    pct: u16,
    increase: bool,
) -> Result<()> {
    require!(pct > 0, FluxError::InvalidAmount);
    let (pos_side, size) = {
        let p = &ctx.accounts.taker_position;
        (p.side, p.size)
    };
    require!(pos_side != PositionSide::Flat, FluxError::NoOpenPosition);

    let mut delta = (size as u128 * pct as u128 / 100) as u64;
    let side = if increase {
        match pos_side {
            PositionSide::Long => Side::Long,
            PositionSide::Short => Side::Short,
            PositionSide::Flat => return err!(FluxError::NoOpenPosition),
        }
    } else {
        delta = delta.min(size);
        match pos_side {
            PositionSide::Long => Side::Short,
            PositionSide::Short => Side::Long,
            PositionSide::Flat => return err!(FluxError::NoOpenPosition),
        }
    };
    require!(delta > 0, FluxError::InvalidAmount);

    let max_leverage = ctx.accounts.market_config.max_leverage;
    let now = Clock::get()?.unix_timestamp;
    let taker_key = ctx.accounts.taker.key();
    let mut makers = MakerSet::load(ctx.remaining_accounts, &crate::ID, &taker_key)?;

    let filled = execute_taker_order(
        &mut ctx.accounts.orderbook,
        &mut ctx.accounts.fill_log,
        taker_key,
        &mut ctx.accounts.taker_position,
        &mut ctx.accounts.taker_collateral,
        &mut makers,
        side,
        0,
        delta,
        OrderType::Market,
        max_leverage,
        market_index,
        now,
    )?;
    require!(filled > 0, FluxError::NoLiquidity);

    makers.write_back()?;
    Ok(())
}
