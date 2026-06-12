use anchor_lang::prelude::*;

#[error_code]
pub enum FluxError {
    #[msg("Caller is not the required authority")]
    Unauthorized,
    #[msg("Publisher does not match the price feed publisher")]
    PublisherMismatch,
    #[msg("Maker account does not match the resting order owner")]
    MakerAccountMismatch,  // §5 ix 9

    #[msg("Order is not owned by the caller")]
    OrderOwnerMismatch,

    #[msg("Invalid market index")]
    InvalidMarketIndex,
    #[msg("Account does not belong to this market")]
    MarketMismatch,
    #[msg("Account is missing from remaining_accounts")]
    MissingAccount,

    #[msg("Order size is below the market lot size")]
    SizeBelowLot,
    #[msg("Size must be a multiple of the lot size")]
    SizeNotAligned,
    #[msg("Price is not a multiple of the tick size")]
    PriceNotAligned,
    #[msg("Price must be non-zero for a limit order")]
    InvalidPrice,
    #[msg("Leverage exceeds the market maximum")]
    InvalidLeverage,
    #[msg("Insufficient available margin for this order")]
    InsufficientMargin,

    #[msg("Market order found no liquidity")]
    NoLiquidity,  // §5 ix 9

    #[msg("Orderbook side is at capacity")]
    OrderbookFull,
    #[msg("Order id not found in the book")]
    OrderNotFound,

    #[msg("Trigger list is at capacity")]
    TriggersFull,
    #[msg("Trigger not found")]
    TriggerNotFound,
    #[msg("No triggers crossed the current price")]
    NoTriggersFired,  // §5 ix 13

    #[msg("Position health is above the maintenance margin; not liquidatable")]
    NotLiquidatable,
    #[msg("Position is flat; nothing to liquidate or close")]
    NoOpenPosition,

    #[msg("Funding interval has not elapsed yet")]
    FundingNotDue,

    #[msg("Deposit/withdraw amount must be non-zero")]
    InvalidAmount,
    #[msg("Withdraw amount exceeds available margin")]
    InsufficientFunds,
    #[msg("Account must be undelegated before this operation")]
    AccountStillDelegated,
    #[msg("Cannot withdraw while positions are open")]
    OpenPositionsExist,
    #[msg("Cannot withdraw while orders are resting")]
    OpenOrdersExist,

    #[msg("Tournament epoch has not ended yet")]
    EpochNotEnded,
    #[msg("A VRF request is already in flight")]
    VrfAlreadyPending,
    #[msg("No VRF request is pending")]
    NoVrfPending,
    #[msg("No profitable participants to draw from")]
    NoCandidates,
    #[msg("Winner account does not match the drawn candidate")]
    WinnerMismatch,

    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Account capacity exceeded")]
    CapacityExceeded,
}
