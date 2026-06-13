use anchor_lang::prelude::*;

use crate::errors::FluxError;
use crate::state::*;

#[derive(Accounts)]
pub struct InitializeMarginProfile<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = MarginProfile::LEN,
        seeds = [MARGIN_SEED, user.key().as_ref()],
        bump
    )]
    pub margin_profile: Account<'info, MarginProfile>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_margin_profile(ctx: Context<InitializeMarginProfile>) -> Result<()> {
    let mp = &mut ctx.accounts.margin_profile;
    mp.user = ctx.accounts.user.key();
    mp.legs = Vec::new();
    mp.gross_notional = 0;
    mp.net_notional = 0;
    mp.margin_naive = 0;
    mp.margin_required = 0;
    mp.margin_saved = 0;
    mp.net_side = PositionSide::Flat;
    mp.last_update_ts = 0;
    mp.bump = ctx.bumps.margin_profile;
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateMarginProfile<'info> {
    pub cranker: Signer<'info>,
    #[account(
        mut,
        seeds = [MARGIN_SEED, margin_profile.user.as_ref()],
        bump = margin_profile.bump,
    )]
    pub margin_profile: Account<'info, MarginProfile>,
}

pub fn update_margin_profile(ctx: Context<UpdateMarginProfile>) -> Result<()> {
    let user = ctx.accounts.margin_profile.user;
    let accs = ctx.remaining_accounts;

    let mut legs: Vec<MarginLeg> = Vec::new();
    let mut i = 0usize;
    while i + 1 < accs.len() {
        let pos = {
            let data = accs[i].try_borrow_data()?;
            PositionAccount::try_deserialize(&mut &data[..])?
        };
        let pf = {
            let data = accs[i + 1].try_borrow_data()?;
            PriceFeed::try_deserialize(&mut &data[..])?
        };
        require!(pos.user == user, FluxError::Unauthorized);
        require!(pf.market_index == pos.market_index, FluxError::InvalidPrice);

        if pos.side != PositionSide::Flat && pos.size > 0 {
            require!(legs.len() < MAX_MARGIN_LEGS, FluxError::OrderbookFull);
            legs.push(MarginLeg {
                market_index: pos.market_index,
                side: pos.side,
                notional: pos.notional(pf.mark_price),
                margin: pos.margin_allocated,
            });
        }
        i += 2;
    }

    let now = Clock::get()?.unix_timestamp;
    let mp = &mut ctx.accounts.margin_profile;
    mp.legs = legs;
    mp.recompute(now);

    emit!(MarginProfileUpdated {
        user,
        gross_notional: mp.gross_notional,
        net_notional: mp.net_notional,
        margin_naive: mp.margin_naive,
        margin_required: mp.margin_required,
        margin_saved: mp.margin_saved,
        leg_count: mp.legs.len() as u8,
        ts: now,
    });
    Ok(())
}
