use anchor_lang::prelude::*;
use anchor_lang::pubkey;

pub const MARKET_SEED: &[u8] = b"market";
pub const COLLATERAL_SEED: &[u8] = b"collateral";
pub const ORDERBOOK_SEED: &[u8] = b"orderbook";
pub const POSITION_SEED: &[u8] = b"position";
pub const PRICE_SEED: &[u8] = b"price";
pub const FILL_LOG_SEED: &[u8] = b"fill_log";
pub const TRIGGERS_SEED: &[u8] = b"triggers";
pub const INSURANCE_SEED: &[u8] = b"insurance";
pub const VAULT_SEED: &[u8] = b"vault";

pub const PRICE_SCALE: u64 = 1_000_000;
pub const SIZE_SCALE: u64 = 1_000_000;
pub const BPS_DENOMINATOR: i64 = 10_000;

pub const SOL_PERP_INDEX: u8 = 0;
pub const BTC_PERP_INDEX: u8 = 1;

pub const MAX_ORDERS_PER_SIDE: usize = 32;
pub const MAX_FILLS: usize = 64;
pub const MAX_TRIGGERS: usize = 8;
pub const SYMBOL_LEN: usize = 16;

pub const TAKER_FEE_BPS: u64 = 5;
pub const MAKER_REBATE_BPS: u64 = 2;
pub const INSURANCE_FEE_BPS: u64 = 2;
pub const PROTOCOL_FEE_BPS: u64 = 1;

pub const MAX_LEVERAGE: u8 = 10;
pub const MAINTENANCE_MARGIN_BPS: i64 = 500;  // health < 500 bps ⇒ liquidatable

pub const LIQUIDATION_FEE_BPS: u64 = 100;

pub const LIQUIDATOR_BOUNTY_SHARE_BPS: u64 = 5_000;  // 50% of liquidation fee

pub const INSURANCE_LIQ_SHARE_BPS: u64 = 5_000;  // 50% of liquidation fee

pub const FUNDING_INTERVAL: i64 = 3_600;

pub const FUNDING_CLAMP_BPS: i64 = 50;  // ±0.5%/hr

pub const FUNDING_BASE_FACTOR_BPS: i64 = 100;  // the "× 1%" in (mark−index)/index × 1%

pub const MAX_FILLS_PER_PASS: usize = 10;

pub const PARTIAL_LIQ_TARGET_BPS: i64 = 800;  // restore health to 8% on partial liq

pub const ADV_SEED: &[u8] = b"adv";
pub const MAX_ADV_ORDERS: usize = 8;

pub const LEADERBOARD_SEED: &[u8] = b"leaderboard";
pub const MAX_LEADERS: usize = 32;  // top-32 by PnL%

pub const MAX_CANDIDATES: usize = 32;

pub const MAX_HISTORY: usize = 8;

pub const DEMO_EPOCH_SECS: i64 = 600;

pub const MARGIN_SEED: &[u8] = b"margin";
pub const MAX_MARGIN_LEGS: usize = 2;

pub const OFFSET_CREDIT_BPS: u64 = 2_000;  // 20% credit on directionally-opposing exposure

pub const RISK_SEED: &[u8] = b"risk";
pub const VOL_WINDOW: usize = 64;

pub const PRICE_BAND_BPS: u16 = 200;  // reject fills > 200 bps from oracle mark when tripped

pub const VOL_TIER_1_BPS: u64 = 100;
pub const VOL_TIER_2_BPS: u64 = 200;
pub const VOL_TIER_3_BPS: u64 = 400;

pub const ER_VALIDATOR: Pubkey = pubkey!("MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57");
pub const DELEGATION_PROGRAM: Pubkey = pubkey!("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
pub const USDC_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum Side {
    #[default]
    Long,
    Short,
}
impl Side {
    pub fn opposite(&self) -> Side {
        match self {
            Side::Long => Side::Short,
            Side::Short => Side::Long,
        }
    }
    pub fn as_position(&self) -> PositionSide {
        match self {
            Side::Long => PositionSide::Long,
            Side::Short => PositionSide::Short,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum PositionSide {
    #[default]
    Flat,
    Long,
    Short,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum OrderType {
    #[default]
    Limit,
    Market,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum TriggerKind {
    #[default]
    StopLoss,
    TakeProfit,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum AdvOrderKind {
    #[default]
    Iceberg,

    Twap,

    Gtt,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct Order {
    pub order_id: u64,  // 8

    pub owner: Pubkey,  // 32

    pub price: u64,  // 8

    pub size: u64,

    pub timestamp: i64,  // 8
}
impl Order {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct Fill {
    pub maker: Pubkey,  // 32

    pub taker: Pubkey,  // 32

    pub price: u64,  // 8

    pub size: u64,  // 8

    pub taker_side: Side,  // 1

    pub ts: i64,  // 8

    pub sequence: u64,  // 8
}
impl Fill {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 1 + 8 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct AdvancedOrder {
    pub id: u64,  // 8

    pub kind: AdvOrderKind,  // 1

    pub side: Side,  // 1

    pub price: u64,  // 8

    pub total_size: u64,  // 8

    pub filled: u64,  // 8

    pub display_size: u64,  // 8

    pub slice_interval: i64,  // 8

    pub expiry_ts: i64,  // 8

    pub last_slice_ts: i64,  // 8

    pub resting_order_id: u64,

    pub resting_size: u64,
}
impl AdvancedOrder {
    pub const LEN: usize = 8 + 1 + 1 + 8 * 9;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct TriggerOrder {
    pub kind: TriggerKind,  // 1

    pub trigger_price: u64,  // 8

    pub size: u64,  // 8

    pub fire_side: Side,  // 1
}
impl TriggerOrder {
    pub const LEN: usize = 1 + 8 + 8 + 1;
}

#[account]
pub struct MarketConfig {
    pub market_index: u8,  // 1

    pub symbol: [u8; SYMBOL_LEN],  // 16

    pub tick_size: u64,  // 8

    pub lot_size: u64,  // 8

    pub max_leverage: u8,  // 1

    pub vault: Pubkey,  // 32

    pub authority: Pubkey,  // 32

    pub bump: u8,  // 1
}
impl MarketConfig {
    pub const LEN: usize = 8 + 1 + 16 + 8 + 8 + 1 + 32 + 32 + 1;
}

#[account]
pub struct CollateralAccount {
    pub user: Pubkey,  // 32

    pub deposited: u64,  // 8

    pub available_margin: u64,  // 8

    pub margin_used: u64,  // 8

    pub realized_pnl: i64,  // 8

    pub fees_paid: i64,  // 8  (net; negative = net rebate earned)

    pub funding_paid: i64,  // 8  (net; negative = net funding received)

    pub bump: u8,  // 1
}
impl CollateralAccount {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 1;
}

#[account]
pub struct OrderbookState {
    pub market_index: u8,  // 1

    pub bids: Vec<Order>,  // 4 + 32*64 = 2052

    pub asks: Vec<Order>,  // 4 + 32*64 = 2052

    pub last_trade_price: u64,  // 8

    pub sequence: u64,  // 8

    pub next_order_id: u64,  // 8

    pub funding_rate_bps: i64,  // 8

    pub last_funding_ts: i64,  // 8

    pub bump: u8,  // 1
}
impl OrderbookState {
    const BOOK_VEC_LEN: usize = 4 + MAX_ORDERS_PER_SIDE * Order::LEN;  // 4 + 32*64 = 2052

    pub const LEN: usize = 8
        + 1
        + Self::BOOK_VEC_LEN
        + Self::BOOK_VEC_LEN
        + 8
        + 8
        + 8
        + 8
        + 8
        + 1;
}

#[account]
pub struct PositionAccount {
    pub user: Pubkey,  // 32

    pub market_index: u8,  // 1

    pub side: PositionSide,  // 1

    pub size: u64,  // 8

    pub entry_price: u64,  // 8  (VWAP)

    pub margin_allocated: u64,  // 8

    pub last_funding_ts: i64,  // 8

    pub bump: u8,  // 1
}
impl PositionAccount {
    pub const LEN: usize = 8 + 32 + 1 + 1 + 8 + 8 + 8 + 8 + 1;

    pub fn notional(&self, mark: u64) -> u64 {
        ((self.size as u128 * mark as u128) / SIZE_SCALE as u128) as u64
    }

    pub fn unrealized_pnl(&self, mark: u64) -> i64 {
        if self.side == PositionSide::Flat || self.size == 0 {
            return 0;
        }
        let diff = mark as i128 - self.entry_price as i128;
        let pnl = diff * self.size as i128 / SIZE_SCALE as i128;
        let signed = match self.side {
            PositionSide::Long => pnl,
            PositionSide::Short => -pnl,
            PositionSide::Flat => 0,
        };
        signed as i64
    }

    pub fn health_bps(&self, mark: u64) -> i64 {
        let notional = self.notional(mark);
        if notional == 0 {
            return i64::MAX;
        }
        let equity = self.margin_allocated as i128 + self.unrealized_pnl(mark) as i128;
        (equity * BPS_DENOMINATOR as i128 / notional as i128) as i64
    }

    pub fn bankruptcy_price(&self) -> u64 {
        if self.size == 0 {
            return 0;
        }
        let m_per_unit = (self.margin_allocated as u128 * SIZE_SCALE as u128
            / self.size as u128) as i128;
        match self.side {
            PositionSide::Long => (self.entry_price as i128 - m_per_unit).max(0) as u64,
            PositionSide::Short => (self.entry_price as i128 + m_per_unit) as u64,
            PositionSide::Flat => 0,
        }
    }

    pub fn effective_leverage(&self, mark: u64) -> u64 {
        if self.margin_allocated == 0 {
            return 0;
        }
        self.notional(mark) / self.margin_allocated
    }
}

#[account]
pub struct PriceFeed {
    pub market_index: u8,  // 1

    pub mark_price: u64,  // 8

    pub index_price: u64,  // 8

    pub last_update_ts: i64,  // 8

    pub publisher: Pubkey,  // 32

    pub bump: u8,  // 1
}
impl PriceFeed {
    pub const LEN: usize = 8 + 1 + 8 + 8 + 8 + 32 + 1;
}

#[account]
pub struct FillLog {
    pub market_index: u8,  // 1

    pub fills: Vec<Fill>,  // 4 + 64*97 = 6212

    pub head: u16,  // 2

    pub count: u16,  // 2

    pub bump: u8,  // 1
}
impl FillLog {
    const FILLS_VEC_LEN: usize = 4 + MAX_FILLS * Fill::LEN;  // 4 + 64*97 = 6212

    pub const LEN: usize = 8 + 1 + Self::FILLS_VEC_LEN + 2 + 2 + 1;

    pub fn push(&mut self, fill: Fill) {
        if self.fills.len() < MAX_FILLS {
            self.fills.push(fill);
            self.count = self.fills.len() as u16;
            self.head = (self.fills.len() % MAX_FILLS) as u16;
        } else {
            let idx = (self.head as usize) % MAX_FILLS;
            self.fills[idx] = fill;
            self.head = ((idx + 1) % MAX_FILLS) as u16;
            self.count = MAX_FILLS as u16;
        }
    }
}

#[account]
pub struct TriggerOrders {
    pub user: Pubkey,  // 32

    pub market_index: u8,  // 1

    pub triggers: Vec<TriggerOrder>,  // 4 + 8*18 = 148

    pub bump: u8,  // 1
}
impl TriggerOrders {
    const TRIGGERS_VEC_LEN: usize = 4 + MAX_TRIGGERS * TriggerOrder::LEN;  // 4 + 8*18 = 148

    pub const LEN: usize = 8 + 32 + 1 + Self::TRIGGERS_VEC_LEN + 1;
}

#[account]
pub struct RiskEngine {
    pub market_index: u8,  // 1

    pub returns: Vec<i64>,  // 4 + 64*8 = 516  (oracle returns in bps, ring buffer)

    pub head: u16,  // 2

    pub count: u16,  // 2

    pub last_price: u64,

    pub leverage_cap: u8,

    pub price_band_bps: u16,  // 2

    pub circuit_breaker: bool,  // 1

    pub last_update_ts: i64,  // 8

    pub bump: u8,  // 1
}
impl RiskEngine {
    const RETURNS_VEC_LEN: usize = 4 + VOL_WINDOW * 8;  // 4 + 64*8 = 516

    pub const LEN: usize = 8 + 1 + Self::RETURNS_VEC_LEN + 2 + 2 + 8 + 1 + 2 + 1 + 8 + 1;

    pub fn push_return(&mut self, r: i64) {
        if self.returns.len() < VOL_WINDOW {
            self.returns.push(r);
            self.count = self.returns.len() as u16;
            self.head = (self.returns.len() % VOL_WINDOW) as u16;
        } else {
            let idx = (self.head as usize) % VOL_WINDOW;
            self.returns[idx] = r;
            self.head = ((idx + 1) % VOL_WINDOW) as u16;
            self.count = VOL_WINDOW as u16;
        }
    }

    pub fn realized_vol_bps(&self) -> u64 {
        let n = self.returns.len() as i128;
        if n < 2 {
            return 0;
        }
        let sum: i128 = self.returns.iter().map(|&r| r as i128).sum();
        let mean = sum / n;
        let var: i128 = self.returns.iter().map(|&r| {
            let d = r as i128 - mean;
            d * d
        }).sum::<i128>() / n;
        isqrt(var as u128) as u64
    }
}

pub fn isqrt(n: u128) -> u128 {
    if n < 2 {
        return n;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

pub fn vol_to_leverage(vol_bps: u64) -> u8 {
    if vol_bps < VOL_TIER_1_BPS {
        10
    } else if vol_bps < VOL_TIER_2_BPS {
        7
    } else if vol_bps < VOL_TIER_3_BPS {
        5
    } else {
        3
    }
}

#[account]
pub struct AdvancedOrders {
    pub user: Pubkey,  // 32

    pub market_index: u8,  // 1

    pub orders: Vec<AdvancedOrder>,  // 4 + 8*82 = 660

    pub next_adv_id: u64,  // 8

    pub bump: u8,  // 1
}
impl AdvancedOrders {
    const ORDERS_VEC_LEN: usize = 4 + MAX_ADV_ORDERS * AdvancedOrder::LEN;  // 4 + 8*82 = 660

    pub const LEN: usize = 8 + 32 + 1 + Self::ORDERS_VEC_LEN + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct MarginLeg {
    pub market_index: u8,  // 1

    pub side: PositionSide,  // 1

    pub notional: u64,  // 8  (size × mark, 1e6)

    pub margin: u64,
}
impl MarginLeg {
    pub const LEN: usize = 1 + 1 + 8 + 8;
}

#[account]
pub struct MarginProfile {
    pub user: Pubkey,  // 32

    pub legs: Vec<MarginLeg>,  // 4 + 2*18 = 40

    pub gross_notional: u64,

    pub net_notional: u64,

    pub margin_naive: u64,

    pub margin_required: u64,

    pub margin_saved: u64,

    pub net_side: PositionSide,

    pub last_update_ts: i64,  // 8

    pub bump: u8,  // 1
}
impl MarginProfile {
    const LEGS_VEC_LEN: usize = 4 + MAX_MARGIN_LEGS * MarginLeg::LEN;  // 4 + 2*18 = 40

    pub const LEN: usize = 8 + 32 + Self::LEGS_VEC_LEN + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 1;

    pub fn recompute(&mut self, now: i64) {
        let mut long_n: u128 = 0;
        let mut short_n: u128 = 0;
        let mut naive: u128 = 0;
        for leg in &self.legs {
            naive += leg.margin as u128;
            match leg.side {
                PositionSide::Long => long_n += leg.notional as u128,
                PositionSide::Short => short_n += leg.notional as u128,
                PositionSide::Flat => {}
            }
        }
        let gross = long_n + short_n;
        let offset = long_n.min(short_n);

        let saved = if gross > 0 {
            (OFFSET_CREDIT_BPS as u128 * 2 * offset * naive) / (gross * BPS_DENOMINATOR as u128)
        } else {
            0
        }
        .min(naive);

        self.gross_notional = gross as u64;
        self.net_notional = long_n.abs_diff(short_n) as u64;
        self.margin_naive = naive as u64;
        self.margin_saved = saved as u64;
        self.margin_required = (naive - saved) as u64;
        self.net_side = if long_n > short_n {
            PositionSide::Long
        } else if short_n > long_n {
            PositionSide::Short
        } else {
            PositionSide::Flat
        };
        self.last_update_ts = now;
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct LeaderEntry {
    pub trader: Pubkey,  // 32

    pub pnl_bps: i64,  // 8  (realized PnL as bps of deposited — the ranking key)

    pub realized_pnl: i64,  // 8

    pub volume: u64,  // 8
}
impl LeaderEntry {
    pub const LEN: usize = 32 + 8 + 8 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct WinnerRecord {
    pub epoch: u64,  // 8

    pub winner: Pubkey,  // 32

    pub prize: u64,  // 8

    pub vrf_result: [u8; 32],

    pub candidates: u32,

    pub ts: i64,  // 8
}
impl WinnerRecord {
    pub const LEN: usize = 8 + 32 + 8 + 32 + 4 + 8;
}

#[account]
pub struct Leaderboard {
    pub authority: Pubkey,  // 32

    pub epoch: u64,  // 8

    pub start_ts: i64,  // 8

    pub end_ts: i64,  // 8

    pub epoch_duration: i64,  // 8

    pub prize_pool: u64,

    pub entries: Vec<LeaderEntry>,  // 4 + 32*56 = 1796

    pub candidates: Vec<Pubkey>,  // 4 + 32*32 = 1028  (profitable set entered in the draw)

    pub vrf_pending: bool,

    pub winner: Pubkey,

    pub vrf_result: [u8; 32],

    pub history: Vec<WinnerRecord>,  // 4 + 8*92 = 740

    pub bump: u8,  // 1
}
impl Leaderboard {
    const ENTRIES_LEN: usize = 4 + MAX_LEADERS * LeaderEntry::LEN;  // 1796

    const CAND_LEN: usize = 4 + MAX_CANDIDATES * 32;  // 1028

    const HIST_LEN: usize = 4 + MAX_HISTORY * WinnerRecord::LEN;  // 740

    pub const LEN: usize = 8
        + 32 + 8 + 8 + 8 + 8 + 8
        + Self::ENTRIES_LEN
        + Self::CAND_LEN
        + 1 + 32 + 32
        + Self::HIST_LEN
        + 1;

    pub fn upsert(&mut self, e: LeaderEntry) {
        if let Some(slot) = self.entries.iter_mut().find(|x| x.trader == e.trader) {
            *slot = e;
        } else {
            self.entries.push(e);
        }
        self.entries.sort_by(|a, b| b.pnl_bps.cmp(&a.pnl_bps));
        self.entries.truncate(MAX_LEADERS);
    }
}

#[account]
pub struct InsuranceFund {
    pub balance: u64,  // 8

    pub bad_debt_absorbed: u64,  // 8

    pub bump: u8,  // 1
}
impl InsuranceFund {
    pub const LEN: usize = 8 + 8 + 8 + 1;
}

#[event]
pub struct FillEvent {
    pub market_index: u8,
    pub maker: Pubkey,
    pub taker: Pubkey,
    pub price: u64,
    pub size: u64,
    pub taker_side: Side,
    pub sequence: u64,
    pub ts: i64,
}

#[event]
pub struct TriggerFired {
    pub market_index: u8,
    pub user: Pubkey,
    pub kind: TriggerKind,
    pub trigger_price: u64,
    pub mark_price: u64,
    pub size: u64,
    pub ts: i64,
}

#[event]
pub struct LiquidationEvent {
    pub market_index: u8,
    pub trader: Pubkey,
    pub liquidator: Pubkey,
    pub closed_size: u64,
    pub closed_notional: u64,
    pub liquidation_fee: u64,
    pub liquidator_bounty: u64,
    pub insurance_share: u64,
    pub bad_debt: u64,
    pub ts: i64,
}

#[event]
pub struct FundingApplied {
    pub market_index: u8,
    pub funding_rate_bps: i64,
    pub mark_price: u64,
    pub index_price: u64,
    pub ts: i64,
}

#[event]
pub struct PartialLiquidationEvent {
    pub market_index: u8,
    pub trader: Pubkey,
    pub liquidator: Pubkey,
    pub closed_size: u64,
    pub closed_notional: u64,
    pub restored_health_bps: i64,
    pub liquidation_fee: u64,
    pub liquidator_bounty: u64,
    pub insurance_share: u64,
    pub bad_debt: u64,
    pub full_close: bool,
    pub ts: i64,
}

#[event]
pub struct ADLEvent {
    pub market_index: u8,
    pub counterparty: Pubkey,
    pub bankruptcy_price: u64,
    pub closed_size: u64,
    pub settled_pnl: i64,
    pub ts: i64,
}

#[event]
pub struct SocializedLossEvent {
    pub market_index: u8,
    pub bad_debt: u64,
    pub accounts_haircut: u32,
    pub ts: i64,
}

#[event]
pub struct AdvancedSlice {
    pub market_index: u8,
    pub user: Pubkey,
    pub adv_id: u64,
    pub kind: AdvOrderKind,
    pub slice_size: u64,
    pub filled: u64,
    pub total_size: u64,
    pub resting_order_id: u64,
    pub ts: i64,
}

#[event]
pub struct AdvancedReaped {
    pub market_index: u8,
    pub user: Pubkey,
    pub adv_id: u64,
    pub ts: i64,
}

#[event]
pub struct MarginProfileUpdated {
    pub user: Pubkey,
    pub gross_notional: u64,
    pub net_notional: u64,
    pub margin_naive: u64,
    pub margin_required: u64,
    pub margin_saved: u64,
    pub leg_count: u8,
    pub ts: i64,
}

#[event]
pub struct LeaderboardUpdated {
    pub epoch: u64,
    pub trader: Pubkey,
    pub pnl_bps: i64,
    pub rank: u8,
    pub prize_pool: u64,
    pub ts: i64,
}

#[event]
pub struct TournamentRequested {
    pub epoch: u64,
    pub candidates: u32,
    pub prize_pool: u64,
    pub ts: i64,
}

#[event]
pub struct TournamentSettled {
    pub epoch: u64,
    pub winner: Pubkey,
    pub prize: u64,
    pub candidates: u32,
    pub vrf_result: [u8; 32],
    pub ts: i64,
}

#[event]
pub struct RiskUpdated {
    pub market_index: u8,
    pub realized_vol_bps: u64,
    pub leverage_cap: u8,
    pub circuit_breaker: bool,
    pub ts: i64,
}
