use anchor_lang::prelude::*;

use crate::errors::FluxError;
use crate::state::*;

#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct PushPrice<'info> {
    pub publisher: Signer<'info>,
    #[account(
        mut,
        seeds = [PRICE_SEED, &[market_index]],
        bump = price_feed.bump,
        constraint = price_feed.publisher == publisher.key() @ FluxError::PublisherMismatch,
    )]
    pub price_feed: Account<'info, PriceFeed>,
}

pub fn push_price(ctx: Context<PushPrice>, market_index: u8, mark: u64, index: u64) -> Result<()> {
    require!(mark > 0 && index > 0, FluxError::InvalidPrice);
    require!(
        ctx.accounts.price_feed.market_index == market_index,
        FluxError::MarketMismatch
    );

    let pf = &mut ctx.accounts.price_feed;
    pf.mark_price = mark;
    pf.index_price = index;
    pf.last_update_ts = Clock::get()?.unix_timestamp;
    Ok(())
}

pub fn read_price(price_feed: &PriceFeed) -> (u64, u64) {
    (price_feed.mark_price, price_feed.index_price)
}
