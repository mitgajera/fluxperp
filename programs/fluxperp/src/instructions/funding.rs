use anchor_lang::prelude::*;

use crate::errors::FluxError;
use crate::instructions::oracle::read_price;
use crate::matching::{notional, MakerSet};
use crate::state::*;

#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct ApplyFunding<'info> {
    pub cranker: Signer<'info>,
    #[account(seeds = [PRICE_SEED, &[market_index]], bump = price_feed.bump)]
    pub price_feed: Account<'info, PriceFeed>,
    #[account(mut, seeds = [ORDERBOOK_SEED, &[market_index]], bump = orderbook.bump)]
    pub orderbook: Account<'info, OrderbookState>,
}

pub fn apply_funding<'info>(
    ctx: Context<'_, '_, '_, 'info, ApplyFunding<'info>>,
    market_index: u8,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let (mark, index) = read_price(&ctx.accounts.price_feed);
    require!(index > 0 && mark > 0, FluxError::InvalidPrice);

    require!(
        now - ctx.accounts.orderbook.last_funding_ts >= FUNDING_INTERVAL,
        FluxError::FundingNotDue
    );

    let raw = (mark as i128 - index as i128) * FUNDING_BASE_FACTOR_BPS as i128 / index as i128;
    let rate_bps = raw.clamp(-(FUNDING_CLAMP_BPS as i128), FUNDING_CLAMP_BPS as i128) as i64;

    let mut positions = MakerSet::load(ctx.remaining_accounts, &crate::ID, &Pubkey::default())?;
    for p in positions.parties.iter_mut() {
        if p.position.side == PositionSide::Flat || p.position.size == 0 {
            continue;
        }
        let n = notional(p.position.size, mark) as i128;
        let flow = n * rate_bps as i128 / BPS_DENOMINATOR as i128;

        let delta: i128 = match p.position.side {
            PositionSide::Long => -flow,
            PositionSide::Short => flow,
            PositionSide::Flat => 0,
        };
        let new_avail = p.collateral.available_margin as i128 + delta;
        p.collateral.available_margin = if new_avail < 0 { 0 } else { new_avail as u64 };
        p.collateral.funding_paid = (p.collateral.funding_paid as i128 - delta) as i64;
        p.position.last_funding_ts = now;
    }
    positions.write_back()?;

    let ob = &mut ctx.accounts.orderbook;
    ob.last_funding_ts = now;
    ob.funding_rate_bps = rate_bps;

    emit!(FundingApplied {
        market_index,
        funding_rate_bps: rate_bps,
        mark_price: mark,
        index_price: index,
        ts: now,
    });
    Ok(())
}

#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct SetFundingTs<'info> {
    #[account(constraint = authority.key() == market_config.authority @ FluxError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(seeds = [MARKET_SEED, &[market_index]], bump = market_config.bump)]
    pub market_config: Account<'info, MarketConfig>,
    #[account(mut, seeds = [ORDERBOOK_SEED, &[market_index]], bump = orderbook.bump)]
    pub orderbook: Account<'info, OrderbookState>,
}

pub fn set_funding_ts(ctx: Context<SetFundingTs>, _market_index: u8, ts: i64) -> Result<()> {
    ctx.accounts.orderbook.last_funding_ts = ts;
    Ok(())
}
