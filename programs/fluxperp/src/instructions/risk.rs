use anchor_lang::prelude::*;

use crate::errors::FluxError;
use crate::instructions::liquidate::Liquidate;
use crate::instructions::oracle::read_price;
use crate::matching::{execute_taker_order, notional, MakerSet};
use crate::state::*;

#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct InitializeRisk<'info> {
    #[account(mut, constraint = authority.key() == market_config.authority @ FluxError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(seeds = [MARKET_SEED, &[market_index]], bump = market_config.bump)]
    pub market_config: Account<'info, MarketConfig>,
    #[account(
        init,
        payer = authority,
        space = RiskEngine::LEN,
        seeds = [RISK_SEED, &[market_index]],
        bump
    )]
    pub risk_engine: Account<'info, RiskEngine>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_risk(ctx: Context<InitializeRisk>, market_index: u8) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let r = &mut ctx.accounts.risk_engine;
    r.market_index = market_index;
    r.returns = Vec::new();
    r.head = 0;
    r.count = 0;
    r.last_price = 0;
    r.leverage_cap = ctx.accounts.market_config.max_leverage;

    r.price_band_bps = PRICE_BAND_BPS;
    r.circuit_breaker = false;
    r.last_update_ts = now;
    r.bump = ctx.bumps.risk_engine;
    Ok(())
}

#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct ResetRisk<'info> {
    #[account(constraint = authority.key() == market_config.authority @ FluxError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(seeds = [MARKET_SEED, &[market_index]], bump = market_config.bump)]
    pub market_config: Account<'info, MarketConfig>,
    #[account(mut, seeds = [RISK_SEED, &[market_index]], bump = risk_engine.bump)]
    pub risk_engine: Account<'info, RiskEngine>,
}

pub fn reset_risk(ctx: Context<ResetRisk>, _market_index: u8) -> Result<()> {
    let r = &mut ctx.accounts.risk_engine;
    r.returns.clear();
    r.head = 0;
    r.count = 0;
    r.last_price = 0;
    r.leverage_cap = ctx.accounts.market_config.max_leverage;
    r.circuit_breaker = false;
    Ok(())
}

#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct UpdateRisk<'info> {
    pub cranker: Signer<'info>,
    #[account(seeds = [PRICE_SEED, &[market_index]], bump = price_feed.bump)]
    pub price_feed: Account<'info, PriceFeed>,
    #[account(mut, seeds = [RISK_SEED, &[market_index]], bump = risk_engine.bump)]
    pub risk_engine: Account<'info, RiskEngine>,
}

pub fn update_risk(ctx: Context<UpdateRisk>, market_index: u8) -> Result<()> {
    let (mark, _index) = read_price(&ctx.accounts.price_feed);
    require!(mark > 0, FluxError::InvalidPrice);
    let now = Clock::get()?.unix_timestamp;
    let r = &mut ctx.accounts.risk_engine;

    if r.last_price > 0 {
        let ret = ((mark as i128 - r.last_price as i128) * 10000 / r.last_price as i128) as i64;
        r.push_return(ret);
    }
    r.last_price = mark;

    let vol = r.realized_vol_bps();
    r.leverage_cap = vol_to_leverage(vol);
    r.circuit_breaker = vol >= VOL_TIER_3_BPS;
    r.price_band_bps = PRICE_BAND_BPS;
    r.last_update_ts = now;

    emit!(RiskUpdated {
        market_index,
        realized_vol_bps: vol,
        leverage_cap: r.leverage_cap,
        circuit_breaker: r.circuit_breaker,
        ts: now,
    });
    Ok(())
}

pub fn liquidate_partial<'info>(
    ctx: Context<'_, '_, '_, 'info, Liquidate<'info>>,
    market_index: u8,
    trader: Pubkey,
) -> Result<()> {
    let (mark, _index) = read_price(&ctx.accounts.price_feed);
    require!(mark > 0, FluxError::InvalidPrice);

    let (side, size, m, u, n, health) = {
        let p = &ctx.accounts.trader_position;
        require!(p.side != PositionSide::Flat, FluxError::NoOpenPosition);
        (
            p.side,
            p.size,
            p.margin_allocated as i128,
            p.unrealized_pnl(mark) as i128,
            p.notional(mark) as i128,
            p.health_bps(mark),
        )
    };
    require!(health < MAINTENANCE_MARGIN_BPS, FluxError::NotLiquidatable);

    let target = PARTIAL_LIQ_TARGET_BPS as i128;
    let den = target * n - u * 10000;
    let full_close = (m + u) <= 0 || den <= m * 10000;

    let lot = ctx.accounts.market_config.lot_size;
    let close_size: u64 = if full_close {
        size
    } else {
        let remaining = (size as i128 * (m * 10000) / den) as u64;

        let mut c = size.saturating_sub(remaining);
        c = (c / lot) * lot;
        if c < lot {
            c = lot;
        }
        c.min(size)
    };

    let closed_notional = notional(close_size, mark);
    let liq_side = match side {
        PositionSide::Long => Side::Short,
        PositionSide::Short => Side::Long,
        PositionSide::Flat => return err!(FluxError::NoOpenPosition),
    };
    let max_leverage = ctx.accounts.market_config.max_leverage;
    let now = Clock::get()?.unix_timestamp;
    let m_before = m as u64;

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

    let mut bad_debt: u64 = 0;

    if !full_close && ctx.accounts.trader_position.size > 0 {
        let m_after = ctx.accounts.trader_position.margin_allocated;
        let released = m_before.saturating_sub(m_after);
        ctx.accounts.trader_position.margin_allocated = m_before;
        let tc = &mut ctx.accounts.trader_collateral;
        if tc.available_margin >= released {
            tc.available_margin -= released;
            tc.margin_used = tc.margin_used.saturating_add(released);
        } else {
            bad_debt += released - tc.available_margin;
            tc.margin_used = tc.margin_used.saturating_add(tc.available_margin);
            tc.available_margin = 0;
        }
    }

    let liq_fee =
        ((closed_notional as u128 * LIQUIDATION_FEE_BPS as u128) / BPS_DENOMINATOR as u128) as u64;
    let bounty =
        ((liq_fee as u128 * LIQUIDATOR_BOUNTY_SHARE_BPS as u128) / BPS_DENOMINATOR as u128) as u64;
    let insurance_share = liq_fee - bounty;
    let charged = liq_fee.min(ctx.accounts.trader_collateral.available_margin);
    bad_debt += liq_fee - charged;
    {
        let tc = &mut ctx.accounts.trader_collateral;
        tc.available_margin -= charged;
        tc.fees_paid = tc.fees_paid.checked_add(charged as i64).ok_or(FluxError::MathOverflow)?;
    }
    {
        let lc = &mut ctx.accounts.liquidator_collateral;
        lc.available_margin = lc.available_margin.checked_add(bounty).ok_or(FluxError::MathOverflow)?;
    }

    let restored = if ctx.accounts.trader_position.size > 0 {
        ctx.accounts.trader_position.health_bps(mark)
    } else {
        0
    };

    emit!(PartialLiquidationEvent {
        market_index,
        trader,
        liquidator: ctx.accounts.liquidator.key(),
        closed_size: filled,
        closed_notional,
        restored_health_bps: restored,
        liquidation_fee: liq_fee,
        liquidator_bounty: bounty,
        insurance_share,
        bad_debt,
        full_close,
        ts: now,
    });
    Ok(())
}

#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct AutoDeleverage<'info> {
    pub cranker: Signer<'info>,
    #[account(seeds = [MARKET_SEED, &[market_index]], bump = market_config.bump)]
    pub market_config: Account<'info, MarketConfig>,
    #[account(seeds = [PRICE_SEED, &[market_index]], bump = price_feed.bump)]
    pub price_feed: Account<'info, PriceFeed>,
}

pub fn auto_deleverage<'info>(
    ctx: Context<'_, '_, '_, 'info, AutoDeleverage<'info>>,
    market_index: u8,
    count: u8,
    bankruptcy_price: u64,
) -> Result<()> {
    let (mark, _index) = read_price(&ctx.accounts.price_feed);
    require!(mark > 0 && bankruptcy_price > 0, FluxError::InvalidPrice);
    let now = Clock::get()?.unix_timestamp;

    let mut parties = MakerSet::load(ctx.remaining_accounts, &crate::ID, &Pubkey::default())?;

    let mut scored: Vec<(usize, i128)> = parties
        .parties
        .iter()
        .enumerate()
        .filter_map(|(i, p)| {
            if p.position.side == PositionSide::Flat || p.position.size == 0 {
                return None;
            }
            let u = p.position.unrealized_pnl(mark) as i128;
            if u <= 0 {
                return None;
            }
            let m = (p.position.margin_allocated.max(1)) as i128;
            let pnl_pct = u * 10000 / m;
            let lev = p.position.effective_leverage(mark) as i128;
            Some((i, pnl_pct * lev))
        })
        .collect();
    scored.sort_by(|a, b| b.1.cmp(&a.1));

    let take = (count as usize).min(scored.len());
    require!(take > 0, FluxError::NoOpenPosition);
    for s in scored.iter().take(take) {
        let party = &mut parties.parties[s.0];
        let (side, size, entry, m, owner) = {
            let p = &party.position;
            (p.side, p.size, p.entry_price, p.margin_allocated, party.owner)
        };
        let realized: i128 = match side {
            PositionSide::Long => (bankruptcy_price as i128 - entry as i128) * size as i128 / SIZE_SCALE as i128,
            PositionSide::Short => (entry as i128 - bankruptcy_price as i128) * size as i128 / SIZE_SCALE as i128,
            PositionSide::Flat => 0,
        };
        {
            let c = &mut party.collateral;
            c.margin_used = c.margin_used.saturating_sub(m);
            let avail = c.available_margin as i128 + m as i128 + realized;
            c.available_margin = if avail < 0 { 0 } else { avail as u64 };
            c.realized_pnl = (c.realized_pnl as i128 + realized) as i64;
        }
        {
            let p = &mut party.position;
            p.side = PositionSide::Flat;
            p.size = 0;
            p.entry_price = 0;
            p.margin_allocated = 0;
        }
        emit!(ADLEvent {
            market_index,
            counterparty: owner,
            bankruptcy_price,
            closed_size: size,
            settled_pnl: realized as i64,
            ts: now,
        });
    }
    parties.write_back()?;
    Ok(())
}

#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct SocializeLoss<'info> {
    pub cranker: Signer<'info>,
    #[account(seeds = [INSURANCE_SEED], bump = insurance_fund.bump)]
    pub insurance_fund: Account<'info, InsuranceFund>,
}

pub fn socialize_loss<'info>(
    ctx: Context<'_, '_, '_, 'info, SocializeLoss<'info>>,
    market_index: u8,
    bad_debt: u64,
) -> Result<()> {
    require!(ctx.accounts.insurance_fund.balance == 0, FluxError::Unauthorized);
    require!(bad_debt > 0, FluxError::InvalidAmount);

    let mut parties = MakerSet::load(ctx.remaining_accounts, &crate::ID, &Pubkey::default())?;
    let total: u128 = parties.parties.iter().map(|p| p.collateral.available_margin as u128).sum();
    require!(total > 0, FluxError::InsufficientFunds);

    let mut n: u32 = 0;
    for party in parties.parties.iter_mut() {
        let share = ((party.collateral.available_margin as u128 * bad_debt as u128) / total) as u64;
        party.collateral.available_margin = party.collateral.available_margin.saturating_sub(share);
        n += 1;
    }
    parties.write_back()?;

    emit!(SocializedLossEvent {
        market_index,
        bad_debt,
        accounts_haircut: n,
        ts: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
