use std::io::Cursor;

use anchor_lang::prelude::*;

use crate::errors::FluxError;
use crate::state::*;

pub struct MakerParty<'info> {
    pub owner: Pubkey,
    pub position_ai: AccountInfo<'info>,
    pub collateral_ai: AccountInfo<'info>,
    pub position: PositionAccount,
    pub collateral: CollateralAccount,
}

pub struct MakerSet<'info> {
    pub parties: Vec<MakerParty<'info>>,
}

impl<'info> MakerSet<'info> {
    pub fn load(
        remaining: &[AccountInfo<'info>],
        program_id: &Pubkey,
        taker: &Pubkey,
    ) -> Result<Self> {
        require!(remaining.len() % 2 == 0, FluxError::MissingAccount);
        let mut parties = Vec::new();
        let mut i = 0;
        while i < remaining.len() {
            let position_ai = remaining[i].clone();
            let collateral_ai = remaining[i + 1].clone();
            i += 2;

            require!(position_ai.owner == program_id, FluxError::MakerAccountMismatch);
            require!(collateral_ai.owner == program_id, FluxError::MakerAccountMismatch);

            let position: PositionAccount = {
                let d = position_ai.try_borrow_data()?;
                PositionAccount::try_deserialize(&mut &d[..])?
            };
            let collateral: CollateralAccount = {
                let d = collateral_ai.try_borrow_data()?;
                CollateralAccount::try_deserialize(&mut &d[..])?
            };
            require!(
                position.user == collateral.user,
                FluxError::MakerAccountMismatch
            );
            if &position.user == taker {
                continue;
            }
            parties.push(MakerParty {
                owner: position.user,
                position_ai,
                collateral_ai,
                position,
                collateral,
            });
        }
        Ok(Self { parties })
    }

    pub fn find_mut(&mut self, owner: &Pubkey) -> Result<&mut MakerParty<'info>> {
        self.parties
            .iter_mut()
            .find(|p| &p.owner == owner)
            .ok_or_else(|| error!(FluxError::MakerAccountMismatch))
    }

    pub fn write_back(&self) -> Result<()> {
        for p in &self.parties {
            write_account(&p.position_ai, &p.position)?;
            write_account(&p.collateral_ai, &p.collateral)?;
        }
        Ok(())
    }
}

fn write_account<T: AccountSerialize>(ai: &AccountInfo, account: &T) -> Result<()> {
    let mut data = ai.try_borrow_mut_data()?;
    let mut cursor = Cursor::new(&mut data[..]);
    account.try_serialize(&mut cursor)?;
    Ok(())
}

pub fn notional(size: u64, price: u64) -> u64 {
    ((size as u128 * price as u128) / SIZE_SCALE as u128) as u64
}

pub fn apply_fill(
    pos: &mut PositionAccount,
    coll: &mut CollateralAccount,
    fill_side: Side,
    price: u64,
    size: u64,
    max_leverage: u8,
) -> Result<()> {
    let dir = fill_side.as_position();
    if pos.side == PositionSide::Flat || pos.side == dir {
        increase(pos, coll, dir, price, size, max_leverage)
    } else if size <= pos.size {
        reduce(pos, coll, price, size)
    } else {
        let close = pos.size;
        reduce(pos, coll, price, close)?;
        increase(pos, coll, dir, price, size - close, max_leverage)
    }
}

fn increase(
    pos: &mut PositionAccount,
    coll: &mut CollateralAccount,
    dir: PositionSide,
    price: u64,
    size: u64,
    max_leverage: u8,
) -> Result<()> {
    let add_notional = notional(size, price);
    let required = add_notional.div_ceil(max_leverage as u64);
    require!(coll.available_margin >= required, FluxError::InsufficientMargin);

    let new_size = pos.size.checked_add(size).ok_or(FluxError::MathOverflow)?;
    let new_entry = if pos.size == 0 {
        price
    } else {
        (((pos.entry_price as u128) * (pos.size as u128) + (price as u128) * (size as u128))
            / new_size as u128) as u64
    };

    pos.side = dir;
    pos.size = new_size;
    pos.entry_price = new_entry;
    pos.margin_allocated = pos
        .margin_allocated
        .checked_add(required)
        .ok_or(FluxError::MathOverflow)?;

    coll.available_margin -= required;
    coll.margin_used = coll
        .margin_used
        .checked_add(required)
        .ok_or(FluxError::MathOverflow)?;
    Ok(())
}

fn reduce(
    pos: &mut PositionAccount,
    coll: &mut CollateralAccount,
    price: u64,
    size: u64,
) -> Result<()> {
    let pnl: i128 = match pos.side {
        PositionSide::Long => {
            (price as i128 - pos.entry_price as i128) * size as i128 / SIZE_SCALE as i128
        }
        PositionSide::Short => {
            (pos.entry_price as i128 - price as i128) * size as i128 / SIZE_SCALE as i128
        }
        PositionSide::Flat => 0,
    };

    let released = ((pos.margin_allocated as u128 * size as u128) / pos.size as u128) as u64;

    pos.size -= size;
    pos.margin_allocated -= released;
    coll.margin_used = coll.margin_used.saturating_sub(released);

    let avail = coll.available_margin as i128 + released as i128 + pnl;
    coll.available_margin = if avail < 0 { 0 } else { avail as u64 };
    coll.realized_pnl = (coll.realized_pnl as i128 + pnl) as i64;

    if pos.size == 0 {
        pos.side = PositionSide::Flat;
        pos.entry_price = 0;
    }
    Ok(())
}

fn apply_taker_fee(coll: &mut CollateralAccount, fill_notional: u64) -> Result<()> {
    let fee = ((fill_notional as u128 * TAKER_FEE_BPS as u128) / BPS_DENOMINATOR as u128) as u64;
    coll.available_margin = coll.available_margin.saturating_sub(fee);
    coll.fees_paid = coll
        .fees_paid
        .checked_add(fee as i64)
        .ok_or(FluxError::MathOverflow)?;
    Ok(())
}

fn apply_maker_rebate(coll: &mut CollateralAccount, fill_notional: u64) -> Result<()> {
    let rebate =
        ((fill_notional as u128 * MAKER_REBATE_BPS as u128) / BPS_DENOMINATOR as u128) as u64;
    coll.available_margin = coll
        .available_margin
        .checked_add(rebate)
        .ok_or(FluxError::MathOverflow)?;
    coll.fees_paid = coll
        .fees_paid
        .checked_sub(rebate as i64)
        .ok_or(FluxError::MathOverflow)?;
    Ok(())
}

pub fn insert_sorted(book: &mut Vec<Order>, order: Order, side: Side) {
    let idx = book
        .iter()
        .position(|o| match side {
            Side::Long => o.price < order.price,

            Side::Short => o.price > order.price,
        })
        .unwrap_or(book.len());
    book.insert(idx, order);
}

#[allow(clippy::too_many_arguments)]
pub fn execute_taker_order<'info>(
    orderbook: &mut OrderbookState,
    fill_log: &mut FillLog,
    taker_key: Pubkey,
    taker_pos: &mut PositionAccount,
    taker_coll: &mut CollateralAccount,
    makers: &mut MakerSet<'info>,
    side: Side,
    limit_price: u64,
    size: u64,
    order_type: OrderType,
    max_leverage: u8,
    market_index: u8,
    now: i64,
) -> Result<u64> {
    let mut remaining = size;
    let mut total_filled: u64 = 0;
    let mut fills_done: usize = 0;

    loop {
        if remaining == 0 || fills_done >= MAX_FILLS_PER_PASS {
            break;
        }

        let best = {
            let book = if side == Side::Long {
                &orderbook.asks
            } else {
                &orderbook.bids
            };
            if book.is_empty() {
                break;
            }
            book[0]
        };

        if order_type == OrderType::Limit {
            let crosses = match side {
                Side::Long => best.price <= limit_price,
                Side::Short => best.price >= limit_price,
            };
            if !crosses {
                break;
            }
        }

        if best.owner == taker_key {
            let book = if side == Side::Long {
                &mut orderbook.asks
            } else {
                &mut orderbook.bids
            };
            book.remove(0);
            continue;
        }

        let fill_price = best.price;
        let fill_size = remaining.min(best.size);
        let fill_notional = notional(fill_size, fill_price);

        {
            let maker = makers.find_mut(&best.owner)?;
            apply_fill(
                &mut maker.position,
                &mut maker.collateral,
                side.opposite(),
                fill_price,
                fill_size,
                max_leverage,
            )?;
            apply_maker_rebate(&mut maker.collateral, fill_notional)?;
        }

        apply_fill(taker_pos, taker_coll, side, fill_price, fill_size, max_leverage)?;
        apply_taker_fee(taker_coll, fill_notional)?;

        {
            let book = if side == Side::Long {
                &mut orderbook.asks
            } else {
                &mut orderbook.bids
            };
            if fill_size == book[0].size {
                book.remove(0);
            } else {
                book[0].size -= fill_size;
            }
        }

        orderbook.sequence += 1;
        orderbook.last_trade_price = fill_price;
        fill_log.push(Fill {
            maker: best.owner,
            taker: taker_key,
            price: fill_price,
            size: fill_size,
            taker_side: side,
            ts: now,
            sequence: orderbook.sequence,
        });
        emit!(FillEvent {
            market_index,
            maker: best.owner,
            taker: taker_key,
            price: fill_price,
            size: fill_size,
            taker_side: side,
            sequence: orderbook.sequence,
            ts: now,
        });

        remaining -= fill_size;
        total_filled += fill_size;
        fills_done += 1;
    }

    Ok(total_filled)
}
