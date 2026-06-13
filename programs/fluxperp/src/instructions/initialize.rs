use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::errors::FluxError;
use crate::state::*;

#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct InitializeMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = MarketConfig::LEN,
        seeds = [MARKET_SEED, &[market_index]],
        bump
    )]
    pub market_config: Account<'info, MarketConfig>,
    #[account(
        init,
        payer = authority,
        space = OrderbookState::LEN,
        seeds = [ORDERBOOK_SEED, &[market_index]],
        bump
    )]
    pub orderbook: Account<'info, OrderbookState>,
    #[account(
        init,
        payer = authority,
        space = FillLog::LEN,
        seeds = [FILL_LOG_SEED, &[market_index]],
        bump
    )]
    pub fill_log: Account<'info, FillLog>,
    #[account(
        init,
        payer = authority,
        space = PriceFeed::LEN,
        seeds = [PRICE_SEED, &[market_index]],
        bump
    )]
    pub price_feed: Account<'info, PriceFeed>,

    pub collateral_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = authority,
        seeds = [VAULT_SEED],
        bump,
        token::mint = collateral_mint,
        token::authority = vault
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = authority,
        space = InsuranceFund::LEN,
        seeds = [INSURANCE_SEED],
        bump
    )]
    pub insurance_fund: Account<'info, InsuranceFund>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_market(
    ctx: Context<InitializeMarket>,
    market_index: u8,
    symbol: String,
    tick_size: u64,
    lot_size: u64,
    max_leverage: u8,
) -> Result<()> {
    require!(
        max_leverage >= 1 && max_leverage <= MAX_LEVERAGE,
        FluxError::InvalidLeverage
    );
    require!(tick_size > 0 && lot_size > 0, FluxError::InvalidAmount);
    let sym_bytes = symbol.as_bytes();
    require!(sym_bytes.len() <= SYMBOL_LEN, FluxError::CapacityExceeded);

    let now = Clock::get()?.unix_timestamp;

    let mc = &mut ctx.accounts.market_config;
    mc.market_index = market_index;
    let mut sym = [0u8; SYMBOL_LEN];
    sym[..sym_bytes.len()].copy_from_slice(sym_bytes);
    mc.symbol = sym;
    mc.tick_size = tick_size;
    mc.lot_size = lot_size;
    mc.max_leverage = max_leverage;
    mc.vault = ctx.accounts.vault.key();
    mc.authority = ctx.accounts.authority.key();
    mc.bump = ctx.bumps.market_config;

    let ob = &mut ctx.accounts.orderbook;
    ob.market_index = market_index;
    ob.bids = Vec::new();
    ob.asks = Vec::new();
    ob.last_trade_price = 0;
    ob.sequence = 0;
    ob.next_order_id = 1;
    ob.funding_rate_bps = 0;
    ob.last_funding_ts = now;
    ob.bump = ctx.bumps.orderbook;

    let fl = &mut ctx.accounts.fill_log;
    fl.market_index = market_index;
    fl.fills = Vec::new();
    fl.head = 0;
    fl.count = 0;
    fl.bump = ctx.bumps.fill_log;

    let pf = &mut ctx.accounts.price_feed;
    pf.market_index = market_index;
    pf.mark_price = 0;
    pf.index_price = 0;
    pf.last_update_ts = now;
    pf.publisher = ctx.accounts.authority.key();
    pf.bump = ctx.bumps.price_feed;

    ctx.accounts.insurance_fund.bump = ctx.bumps.insurance_fund;

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeCollateral<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = CollateralAccount::LEN,
        seeds = [COLLATERAL_SEED, user.key().as_ref()],
        bump
    )]
    pub collateral: Account<'info, CollateralAccount>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_collateral(ctx: Context<InitializeCollateral>) -> Result<()> {
    let c = &mut ctx.accounts.collateral;
    c.user = ctx.accounts.user.key();
    c.deposited = 0;
    c.available_margin = 0;
    c.margin_used = 0;
    c.realized_pnl = 0;
    c.fees_paid = 0;
    c.funding_paid = 0;
    c.bump = ctx.bumps.collateral;
    Ok(())
}

#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct InitializePosition<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [MARKET_SEED, &[market_index]], bump = market_config.bump)]
    pub market_config: Account<'info, MarketConfig>,
    #[account(
        init,
        payer = user,
        space = PositionAccount::LEN,
        seeds = [POSITION_SEED, user.key().as_ref(), &[market_index]],
        bump
    )]
    pub position: Account<'info, PositionAccount>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_position(ctx: Context<InitializePosition>, market_index: u8) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let p = &mut ctx.accounts.position;
    p.user = ctx.accounts.user.key();
    p.market_index = market_index;
    p.side = PositionSide::Flat;
    p.size = 0;
    p.entry_price = 0;
    p.margin_allocated = 0;
    p.last_funding_ts = now;
    p.bump = ctx.bumps.position;
    Ok(())
}

#[derive(Accounts)]
#[instruction(market_index: u8)]
pub struct InitializeTriggers<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [MARKET_SEED, &[market_index]], bump = market_config.bump)]
    pub market_config: Account<'info, MarketConfig>,
    #[account(
        init,
        payer = user,
        space = TriggerOrders::LEN,
        seeds = [TRIGGERS_SEED, user.key().as_ref(), &[market_index]],
        bump
    )]
    pub triggers: Account<'info, TriggerOrders>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_triggers(ctx: Context<InitializeTriggers>, market_index: u8) -> Result<()> {
    let t = &mut ctx.accounts.triggers;
    t.user = ctx.accounts.user.key();
    t.market_index = market_index;
    t.triggers = Vec::new();
    t.bump = ctx.bumps.triggers;
    Ok(())
}
