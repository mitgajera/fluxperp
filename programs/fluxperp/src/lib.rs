use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub mod errors;
pub mod matching;
pub mod state;

pub mod instructions;
pub use instructions::*;
pub use state::{AdvOrderKind, OrderType, Side, TriggerKind};

declare_id!("9AT996FhU1n73PRDHLiQKZHBcwAPRiUVDSN71CgGso8S");

#[ephemeral]
#[program]
pub mod fluxperp {
    use super::*;

    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        market_index: u8,
        symbol: String,
        tick_size: u64,
        lot_size: u64,
        max_leverage: u8,
    ) -> Result<()> {
        instructions::initialize::initialize_market(
            ctx,
            market_index,
            symbol,
            tick_size,
            lot_size,
            max_leverage,
        )
    }

    pub fn initialize_collateral(ctx: Context<InitializeCollateral>) -> Result<()> {
        instructions::initialize::initialize_collateral(ctx)
    }

    pub fn initialize_position(ctx: Context<InitializePosition>, market_index: u8) -> Result<()> {
        instructions::initialize::initialize_position(ctx, market_index)
    }

    pub fn initialize_triggers(ctx: Context<InitializeTriggers>, market_index: u8) -> Result<()> {
        instructions::initialize::initialize_triggers(ctx, market_index)
    }

    pub fn deposit_collateral(ctx: Context<DepositCollateral>, amount: u64) -> Result<()> {
        instructions::collateral::deposit_collateral(ctx, amount)
    }

    pub fn withdraw_collateral(ctx: Context<WithdrawCollateral>, amount: u64) -> Result<()> {
        instructions::collateral::withdraw_collateral(ctx, amount)
    }

    pub fn delegate_collateral(ctx: Context<DelegateCollateral>) -> Result<()> {
        instructions::collateral::delegate_collateral(ctx)
    }

    pub fn delegate_position(ctx: Context<DelegatePosition>, market_index: u8) -> Result<()> {
        instructions::collateral::delegate_position(ctx, market_index)
    }

    pub fn delegate_triggers(ctx: Context<DelegateTriggers>, market_index: u8) -> Result<()> {
        instructions::collateral::delegate_triggers(ctx, market_index)
    }

    pub fn delegate_orderbook(ctx: Context<DelegateOrderbook>, market_index: u8) -> Result<()> {
        instructions::collateral::delegate_orderbook(ctx, market_index)
    }

    pub fn delegate_fill_log(ctx: Context<DelegateFillLog>, market_index: u8) -> Result<()> {
        instructions::collateral::delegate_fill_log(ctx, market_index)
    }

    pub fn delegate_price_feed(ctx: Context<DelegatePriceFeed>, market_index: u8) -> Result<()> {
        instructions::collateral::delegate_price_feed(ctx, market_index)
    }

    pub fn push_price(
        ctx: Context<PushPrice>,
        market_index: u8,
        mark: u64,
        index: u64,
    ) -> Result<()> {
        instructions::oracle::push_price(ctx, market_index, mark, index)
    }

    pub fn place_order(
        ctx: Context<PlaceOrder>,
        market_index: u8,
        side: Side,
        price: u64,
        size: u64,
        order_type: OrderType,
    ) -> Result<()> {
        instructions::order::place_order(ctx, market_index, side, price, size, order_type)
    }

    pub fn cancel_order(ctx: Context<CancelOrder>, market_index: u8, order_id: u64) -> Result<()> {
        instructions::order::cancel_order(ctx, market_index, order_id)
    }

    pub fn close_position(ctx: Context<ClosePosition>, market_index: u8) -> Result<()> {
        instructions::order::close_position(ctx, market_index)
    }

    pub fn reverse_position(ctx: Context<ClosePosition>, market_index: u8) -> Result<()> {
        instructions::order::reverse_position(ctx, market_index)
    }

    pub fn scale_in_out(
        ctx: Context<ClosePosition>,
        market_index: u8,
        pct: u16,
        increase: bool,
    ) -> Result<()> {
        instructions::order::scale_in_out(ctx, market_index, pct, increase)
    }

    pub fn reset_orderbook(ctx: Context<ResetOrderbook>, market_index: u8) -> Result<()> {
        instructions::order::reset_orderbook(ctx, market_index)
    }

    pub fn place_trigger(
        ctx: Context<ManageTrigger>,
        market_index: u8,
        kind: TriggerKind,
        trigger_price: u64,
        size: u64,
        fire_side: Side,
    ) -> Result<()> {
        instructions::triggers::place_trigger(
            ctx,
            market_index,
            kind,
            trigger_price,
            size,
            fire_side,
        )
    }

    pub fn cancel_trigger(
        ctx: Context<ManageTrigger>,
        market_index: u8,
        kind: TriggerKind,
        trigger_price: u64,
        size: u64,
        fire_side: Side,
    ) -> Result<()> {
        instructions::triggers::cancel_trigger(
            ctx,
            market_index,
            kind,
            trigger_price,
            size,
            fire_side,
        )
    }

    pub fn crank_triggers<'info>(
        ctx: Context<'_, '_, '_, 'info, CrankTriggers<'info>>,
        market_index: u8,
        trader: Pubkey,
    ) -> Result<()> {
        instructions::triggers::crank_triggers(ctx, market_index, trader)
    }

    pub fn liquidate<'info>(
        ctx: Context<'_, '_, '_, 'info, Liquidate<'info>>,
        market_index: u8,
        trader: Pubkey,
    ) -> Result<()> {
        instructions::liquidate::liquidate(ctx, market_index, trader)
    }

    pub fn apply_funding<'info>(
        ctx: Context<'_, '_, '_, 'info, ApplyFunding<'info>>,
        market_index: u8,
    ) -> Result<()> {
        instructions::funding::apply_funding(ctx, market_index)
    }

    pub fn set_funding_ts(ctx: Context<SetFundingTs>, market_index: u8, ts: i64) -> Result<()> {
        instructions::funding::set_funding_ts(ctx, market_index, ts)
    }

    pub fn liquidate_partial<'info>(
        ctx: Context<'_, '_, '_, 'info, Liquidate<'info>>,
        market_index: u8,
        trader: Pubkey,
    ) -> Result<()> {
        instructions::risk::liquidate_partial(ctx, market_index, trader)
    }

    pub fn auto_deleverage<'info>(
        ctx: Context<'_, '_, '_, 'info, AutoDeleverage<'info>>,
        market_index: u8,
        count: u8,
        bankruptcy_price: u64,
    ) -> Result<()> {
        instructions::risk::auto_deleverage(ctx, market_index, count, bankruptcy_price)
    }

    pub fn socialize_loss<'info>(
        ctx: Context<'_, '_, '_, 'info, SocializeLoss<'info>>,
        market_index: u8,
        bad_debt: u64,
    ) -> Result<()> {
        instructions::risk::socialize_loss(ctx, market_index, bad_debt)
    }

    pub fn initialize_risk(ctx: Context<InitializeRisk>, market_index: u8) -> Result<()> {
        instructions::risk::initialize_risk(ctx, market_index)
    }

    pub fn update_risk(ctx: Context<UpdateRisk>, market_index: u8) -> Result<()> {
        instructions::risk::update_risk(ctx, market_index)
    }

    pub fn reset_risk(ctx: Context<ResetRisk>, market_index: u8) -> Result<()> {
        instructions::risk::reset_risk(ctx, market_index)
    }

    pub fn initialize_advanced(ctx: Context<InitializeAdvanced>, market_index: u8) -> Result<()> {
        instructions::advanced::initialize_advanced(ctx, market_index)
    }

    pub fn delegate_advanced(ctx: Context<DelegateAdvanced>, market_index: u8) -> Result<()> {
        instructions::collateral::delegate_advanced(ctx, market_index)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn place_advanced_order(
        ctx: Context<PlaceAdvancedOrder>,
        market_index: u8,
        side: Side,
        price: u64,
        total_size: u64,
        display_size: u64,
        slice_interval: i64,
        expiry_ts: i64,
        kind: AdvOrderKind,
    ) -> Result<()> {
        instructions::advanced::place_advanced_order(
            ctx,
            market_index,
            side,
            price,
            total_size,
            display_size,
            slice_interval,
            expiry_ts,
            kind,
        )
    }

    pub fn crank_twap(ctx: Context<CrankAdvanced>, market_index: u8, trader: Pubkey) -> Result<()> {
        instructions::advanced::crank_twap(ctx, market_index, trader)
    }

    pub fn reap_expired(ctx: Context<CrankAdvanced>, market_index: u8, trader: Pubkey) -> Result<()> {
        instructions::advanced::reap_expired(ctx, market_index, trader)
    }

    pub fn delegate_risk(ctx: Context<DelegateRisk>, market_index: u8) -> Result<()> {
        instructions::collateral::delegate_risk(ctx, market_index)
    }

    pub fn initialize_margin_profile(ctx: Context<InitializeMarginProfile>) -> Result<()> {
        instructions::margin::initialize_margin_profile(ctx)
    }

    pub fn delegate_margin(ctx: Context<DelegateMargin>) -> Result<()> {
        instructions::collateral::delegate_margin(ctx)
    }

    pub fn update_margin_profile(ctx: Context<UpdateMarginProfile>) -> Result<()> {
        instructions::margin::update_margin_profile(ctx)
    }

    pub fn initialize_leaderboard(
        ctx: Context<InitializeLeaderboard>,
        epoch_duration: i64,
        seed_prize: u64,
    ) -> Result<()> {
        instructions::tournament::initialize_leaderboard(ctx, epoch_duration, seed_prize)
    }

    pub fn update_leaderboard(
        ctx: Context<UpdateLeaderboard>,
        trader: Pubkey,
        pnl_bps: i64,
        realized_pnl: i64,
        volume: u64,
    ) -> Result<()> {
        instructions::tournament::update_leaderboard(ctx, trader, pnl_bps, realized_pnl, volume)
    }

    pub fn request_tournament_winner(ctx: Context<RequestTournamentWinner>) -> Result<()> {
        instructions::tournament::request_tournament_winner(ctx)
    }

    pub fn settle_tournament<'info>(
        ctx: Context<'_, '_, 'info, 'info, SettleTournament<'info>>,
        randomness: [u8; 32],
    ) -> Result<()> {
        instructions::tournament::settle_tournament(ctx, randomness)
    }

    pub fn settle_tournament_demo<'info>(
        ctx: Context<'_, '_, 'info, 'info, SettleTournamentDemo<'info>>,
    ) -> Result<()> {
        instructions::tournament::settle_tournament_demo(ctx)
    }

    pub fn commit_state<'info>(
        ctx: Context<'_, '_, '_, 'info, CommitState<'info>>,
        market_index: u8,
        insurance_delta: u64,
        protocol_delta: u64,
    ) -> Result<()> {
        instructions::settle::commit_state(ctx, market_index, insurance_delta, protocol_delta)
    }

    pub fn settle_to_l1(
        ctx: Context<SettleToL1>,
        insurance_delta: u64,
        protocol_delta: u64,
    ) -> Result<()> {
        instructions::settle::settle_to_l1(ctx, insurance_delta, protocol_delta)
    }

    pub fn undelegate_user<'info>(
        ctx: Context<'_, '_, '_, 'info, UndelegateUser<'info>>,
        market_index: u8,
    ) -> Result<()> {
        instructions::settle::undelegate_user(ctx, market_index)
    }
}
