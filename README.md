# FluxPerp

> **A fully onchain perpetuals DEX inside MagicBlock's Ephemeral Rollup.** Sub-100ms
> fills with gasless session trading. Onchain stop-losses, permissionless liquidations
> with bounties, funding settled atomically on L1 via Magic Actions. Zero trusted
> components.

**Program ID (devnet):** `9AT996FhU1n73PRDHLiQKZHBcwAPRiUVDSN71CgGso8S`

---

## Architecture

One Anchor program, two execution layers, bridged atomically by Magic Actions.

```
          ┌───────────────────────────────┐         ┌───────────────────────────────┐
          │   EPHEMERAL ROLLUP  (hot)     │         │        SOLANA L1  (cold)      │
          │   devnet-as.magicblock.app    │         │       api.devnet.solana.com   │
          │                               │         │                               │
 trader → │  Orderbook  · Positions       │         │  USDC Vault · Insurance Fund  │
 (session │  Price feed · Fill log        │         │  Market configs               │
   key)   │  Triggers   · Collateral      │         │  Deposits / Withdrawals       │
          │                               │         │                               │
          │  place_order matches inline,  │         │  settle_to_l1 (#[action])     │
          │  liquidate / funding / crank  │         │  credits the Insurance Fund   │
          │  all run here in ~tens of ms  │         │                               │
          └───────────────┬───────────────┘         └───────────────▲───────────────┘
                          │   commit_state (#[commit]) + Magic Action               │
                          └──────────  one atomic intent bundle  ───────────────────┘
```

- **Deposit** USDC on L1 → **delegate** the collateral/position PDAs to the ER →
  **trade** entirely on the ER → each fill **commits** state to L1 *and* fires a
  `settle_to_l1` Magic Action in one atomic bundle → **withdraw** undelegates back to L1.
- **Session keys:** a local ephemeral keypair owns the delegated accounts and signs all
  ER sends - zero wallet popups after one funding approval.

## Advanced layer (SPECS §A1–A8)

Beyond the core perp, FluxPerp implements the full MagicBlock product suite -
**ER + Pricing Oracle + Magic Actions + VRF** - plus a complete risk engine.

| Feature | What it does | Instructions |
|---|---|---|
| **Tiered liquidation + ADL + socialized loss** | Partial liquidation restores ~8% health instead of nuking the whole position; auto-deleverage closes the highest profit×leverage counterparty at bankruptcy price; residual bad debt is socialized | `liquidate_partial` · `auto_deleverage` · `socialize_loss` |
| **Dynamic risk engine** | A 64-sample realized-vol ring buffer drops the leverage cap (10→7→5→3×) and trips a circuit breaker + price band on a vol spike | `update_risk` |
| **Advanced order types** | Iceberg (only `display_size` visible), TWAP (slices on a schedule), GTT (reaped after expiry) - worked by a keeper crank | `place_advanced_order` · `crank_twap` · `reap_expired` |
| **Cross-market portfolio margin** | Opposing exposure across SOL/BTC nets out - a 20% offset credit on the hedged overlap lowers total margin vs the naive per-position sum | `update_margin_profile` |
| **Tournament + VRF** | Per-epoch PnL% leaderboard; at epoch end a real **MagicBlock VRF** draw picks a verifiably-random lucky trader among profitable participants and pays a bonus | `update_leaderboard` · `request_tournament_winner` · `settle_tournament` |
| **One-click UX** | Reverse (close + reopen opposite in one ER tx), scale in/out by %, flatten every market | `reverse_position` · `scale_in_out` · close_all (client-batched) |

### Risk waterfall (SPECS §A1–A3)

When a position's health crosses maintenance margin, losses cascade through five
escalating tiers - each only reached if the previous cannot fully absorb the shortfall:

```
   position health < maintenance margin (500 bps)
                 │
                 ▼
  ┌──────────────────────────────┐
  │ 1. DYNAMIC LEVERAGE CAP      │  vol spike → lower max leverage,
  │    (pre-emptive, update_risk)│  circuit breaker rejects new risk
  └──────────────┬───────────────┘
                 ▼
  ┌──────────────────────────────┐
  │ 2. PARTIAL LIQUIDATION       │  close only enough size to restore
  │    (liquidate_partial)       │  health to ~8%; keep the rest open
  └──────────────┬───────────────┘
                 ▼  still underwater
  ┌──────────────────────────────┐
  │ 3. FULL LIQUIDATION          │  close the whole position; pay the
  │    (liquidate)               │  liquidator bounty + insurance share
  └──────────────┬───────────────┘
                 ▼  position bankrupt (equity < 0)
  ┌──────────────────────────────┐
  │ 4. INSURANCE FUND            │  absorbs the negative-equity gap
  │    (settle_to_l1 #[action])  │  from the L1 fund balance
  └──────────────┬───────────────┘
                 ▼  fund exhausted
  ┌──────────────────────────────┐
  │ 5a. AUTO-DELEVERAGE (ADL)    │  close the highest profit×leverage
  │     (auto_deleverage)        │  opposite position at bankruptcy price
  └──────────────┬───────────────┘
                 ▼  bad debt remains
  ┌──────────────────────────────┐
  │ 5b. SOCIALIZED LOSS          │  haircut remaining profitable
  │     (socialize_loss)         │  accounts pro-rata - last resort
  └──────────────────────────────┘
```

The per-position **ADL light** in the UI shows each winner's queue rank (profit×leverage
score, 1–5 bars) - how close it is to being auto-deleveraged if the other side blows out.

## Repository layout

```
programs/fluxperp/src/
  lib.rs            #[ephemeral] program module - wires 37 instructions
  state.rs          accounts, enums, events, constants (LEN hand-computed)
  errors.rs
  matching.rs       price-time-priority engine (shared by order/trigger/liquidate)
  instructions/     initialize · collateral(+delegate) · oracle · order · triggers
                    · liquidate · funding · settle (commit + #[action])
                    · risk (partial liq · ADL · socialized loss · dynamic risk)
                    · advanced (iceberg/TWAP/GTT) · margin (portfolio margin)
                    · tournament (leaderboard + MagicBlock VRF)
app/                Next.js 14 App Router + Tailwind
  app/{page,trade,portfolio,leaderboard,debug}  lib/{program,er,session,deserialize,
  components/                          types,trade-actions,trading-context,portfolio,format}
scripts/            price-publisher · keeper · market-maker · setup-demo
tests/              happy_path · liquidation · funding · triggers · advanced
                    · advanced_orders · portfolio_margin · tournament · oneclick
```

## Toolchain (SPECS §0)

| Tool | Spec | Used |
|---|---|---|
| Anchor | 0.32.1 | **0.32.1** (`avm use 0.32.1`) |
| Solana CLI | 2.3.13 | 3.1.10 |
| Rust | 1.85.0 | 1.89.0 (`rust-toolchain.toml`) |
| Node | 24.10.0 | 22 (Win) / 18 (WSL) |

> **SDK feature note:** SPECS §0 names the `ephemeral-rollups-sdk` **"anchor"** feature,
> but in SDK 0.15.3 that feature pins `anchor-lang = 1.0` (incompatible with 0.32.1). We
> use **"anchor-compat"**, built for Anchor 0.28–0.32, which resolves `anchor-lang` to our
> pinned 0.32.1 and generates matching types for `#[ephemeral]`/`#[delegate]`/`#[commit]`/`#[action]`.

## Build & deploy (program)

```bash
# rust / anchor / solana run in WSL
anchor build
anchor deploy --provider.cluster devnet
```

## Run the stack (devnet)

```bash
# 1. one-time market setup (market 0 = SOL-PERP): MarketConfig, vault, orderbook, etc.
ANCHOR_WALLET=$HOME/.config/solana/id.json ts-node scripts/setup-demo.ts

# 2. price publisher - pushes live SOL/BTC marks to the ER every ~400ms (run during demo)
ANCHOR_WALLET=$HOME/.config/solana/id.json ts-node scripts/price-publisher.ts

# 3. market-maker - quotes a live two-sided book around mark so /trade is alive
ANCHOR_WALLET=$HOME/.config/solana/id.json ts-node scripts/market-maker.ts

# 4. keeper - cranks triggers, liquidates health<5% (earns bounties), applies funding
ANCHOR_WALLET=$HOME/.config/solana/id.json ts-node scripts/keeper.ts
```

## Frontend

```bash
cd app
npm install
npm run dev          # http://localhost:3000
```

- **`/`** - landing with live program-state stats.
- **`/trade`** - the terminal: orderbook · candlestick chart · order form (Long/Short,
  Limit/Market, 1–10× leverage) · positions/orders/triggers · live trade feed · stats bar
  with ER latency · **fill toast ("Filled in Xms")** · **Proof-of-Speed** race · **PnL share card**.
- **`/portfolio`** - balances, margin, PnL, fees/rebates, funding, fill history,
  **deposit / withdraw** (withdraw walks the undelegate path with status steps).
- **`/debug`** - raw connection-layer view (live orderbook + price from ER ws).

Env (`app/.env.local`, optional - defaults to the SPECS §0 endpoints):

```
NEXT_PUBLIC_SOLANA_L1_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_ER_RPC=https://devnet-as.magicblock.app
NEXT_PUBLIC_ER_WS=wss://devnet-as.magicblock.app
NEXT_PUBLIC_MAGIC_ROUTER_RPC=https://devnet-router.magicblock.app
```

## Tests (devnet ER)

```bash
ANCHOR_PROVIDER_URL=<rpc> ANCHOR_WALLET=$HOME/.config/solana/id.json ts-node tests/happy_path.ts
# core:     tests/liquidation.ts · tests/funding.ts · tests/triggers.ts
# advanced: tests/advanced.ts (partial-liq · ADL · vol-spike)
#           tests/advanced_orders.ts (iceberg · TWAP · GTT)
#           tests/portfolio_margin.ts · tests/tournament.ts (VRF) · tests/oneclick.ts
```

`happy_path` covers deposit → delegate → price publish → limit/market fill →
auto-commit → `settle_to_l1` (insurance credited). `liquidation`/`funding`/`triggers`
cover the permissionless cranks. The advanced suite covers SPECS §A10 acceptance
criteria 13–20 (tiered liquidation, dynamic risk, advanced orders, portfolio margin,
tournament VRF, one-click primitives). All green against the live Asia ER.

---

*FluxPerp - perp trading at ER speed. Settled on Solana.*
