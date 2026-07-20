# near-solver Architecture

**Audience:** engineers joining the project. **Status:** current as of 98 tests / 13 files.
**Package:** `packages/near-solver` (`@cavalre/near-solver`)

## What this system is

A market-making solver for the [NEAR Intents](https://docs.near-intents.org) network.
Takers broadcast swap intents; solvers compete by returning signed quotes; the
`intents.near` verifier contract settles the winner atomically. Our edge is the spread;
our job is to never quote a price we can't honor, at a size we don't hold, for longer
than we can bear.

## Data flow

```
                 wss://solver-relay-v2.chaindefuser.com/ws
                                  │
                          ┌───────▼───────┐
                          │  wsTransport   │  only module touching real I/O
                          └───────┬───────┘
                          ┌───────▼───────┐
                          │  RelayClient   │  reconnect/backoff, frame-size cap,
                          └───────┬───────┘  subscribe quote + quote_status
                          ┌───────▼───────┐
                          │     codec      │  fail-closed parse; bigint-only amounts
                          └───────┬───────┘
                     QuoteRequestEvent │ SettlementEvent
                          ┌───────▼────────────────────────────┐
                          │            SolverRunner             │  composition root
                          │  dryRun default TRUE; key-gated live │
                          └───┬────────────┬───────────┬────────┘
                    ┌─────────▼──┐  ┌──────▼──────┐  ┌─▼──────────────┐
                    │ SolverPipe  │  │ Reserving-  │  │ nep413 signing  │
                    │ line        │  │ Inventory   │  │ (live only)     │
                    └───┬───┬───┬─┘  └──────┬──────┘  └────────────────┘
              ┌─────────▼┐ ┌▼────────┐ ┌───▼────────────┐
              │ Staleness │ │ Solver  │ │ LedgerInventory │←── Reconciler ←── chain
              │ Guarded   │ │ Risk    │ │ (CavalRe ledger)│    (divergence halt,
              │ PriceSrc  │ │ Guard   │ └────────────────┘     PnL feedback)
              └───────────┘ └─────────┘
```

## Decision order (SolverPipeline.decide)

Every quote request passes these gates, in order, all fail-closed:

| # | Gate | Rejection reason |
|---|------|------------------|
| 1 | Both assets in the registry | `asset_not_listed` |
| 2 | Taker deadline ≤ `maxDeadlineMs` | `deadline_too_long` |
| 3 | Mid price available (and fresh, via staleness guard) | `no_price` |
| 4 | Priced amount ≤ unreserved inventory | `insufficient_inventory` |
| 5 | Notional ≥ `minNotionalUsd` | `below_min_notional` |
| 6 | Risk guard: notional cap, daily loss, kill switch | guard's reason verbatim |

Pricing applies `halfSpreadBps` plus an inventory skew (0 → `maxInventorySkewBps`,
linear in the fraction of unreserved inventory this quote would consume). Rounding is
always solver-favorable: **floor** what we pay, **ceil** what we charge.

## Invariants (the things that must never break)

1. **No JavaScript `Number` ever touches money.** All amounts are `bigint` raw token
   units at the boundary and CavalRe FloatLib `FloatFixed` internally. `rawToFloat` is
   the only sanctioned conversion in (handles >21-decimal tokens); `floorToRaw` /
   `ceilToRaw` the only conversions out.
2. **Quotes are commitments.** From `quote_response` until deadline or settlement, the
   payout is held in `ReservingInventory`. Two quotes can never book the same units.
3. **Wrong state halts.** Ledger overdraw throws before state changes. On-chain
   divergence beyond `maxDriftUsd` trips the kill switch. The kill switch survives
   `resetDay()` and only clears by explicit call.
4. **Unpriceable means unquotable.** Null price, stale price, future-dated price,
   unknown notional — every one resolves to a rejection, never a guess.
5. **Dry-run and live share one code path.** Reservations, pricing, and metrics behave
   identically; live mode adds only signing and sending.

## Module contracts

| Module | Exports | Contract |
|--------|---------|----------|
| `codec` | `parseRelayMessage`, `buildTokenDiffMessage`, `buildQuoteResponse` | Never throws on hostile input; amounts capped at 40 digits pre-parse |
| `nep413` | `signNep413`, `nep413Hash`, `privateKeyFromSeed`, borsh helpers | Byte-exact NEP-413: borsh(payload), tag 2³¹+413, sha256, ed25519 |
| `pricing` | `priceExactIn/Out`, `rawToFloat`, `floorToRaw`, `ceilToRaw`, `inventorySkewBps`, `bpsToFraction` | Pure; solver-favorable rounding proven by tests |
| `risk` | `SolverRiskGuard` | Fail-closed; kill switch requires explicit clear |
| `solver` | `SolverPipeline`, `LedgerInventory`, `ReservingInventory` | Pure decide(); double-entry inventory; all-or-nothing reservations |
| `relay` | `RelayClient` | Injectable transport; capped backoff; 256 KiB frame cap |
| `runner` | `SolverRunner`, `realizedEdgeUsd` | Safe-by-default composition; per-reason metrics |
| `reconciler` | `Reconciler` | Chain-truth reconciliation; divergence→halt; PnL between reconciles |
| `staleness` | `StalenessGuardedPriceSource` | Age-bounds any timestamped price source |
| `wsTransport` | `makeWebSocketTransportFactory` | The only real-I/O module |

## Why these design choices

**Why reconcile from the chain instead of matching bus settlement events?** The bus's
`quote_status` events carry a `quote_hash` we never learn (the ack to `quote_response`
is just `"OK"`). Rather than guess at matching, we treat on-chain balances as ground
truth on a cadence. This is also robust to missed events, bus outages, and fills we
didn't expect. Event matching can be added later as an optimization; reconciliation
stays as the safety net either way.

**Why in-memory reservations?** One runner process per inventory is an explicit
constraint (documented in SECURITY_REVIEW.md). A shared store adds a distributed-systems
problem we don't have yet. Scale by sharding assets across runners, not by sharing
inventory.

**Why CavalRe FloatLib/Ledger?** FloatLib is the TypeScript port of the audited
`FloatLib.sol` from cavalre-contracts; the ledger implements the same accounting-first,
halt-on-divergence philosophy off-chain that CavalRe's contracts implement on-chain.
One math library, one accounting model, on both sides of the boundary.

## Glossary

| Term | Meaning |
|------|---------|
| Intent | A signed swap request settled atomically by `intents.near` |
| Solver / market maker | Us: responds to quote requests with signed prices |
| Solver bus / relay | The message bus distributing quote requests to solvers |
| `token_diff` | Intent type: a set of signed balance deltas (+receive / −pay) |
| NEP-413 | NEAR's off-chain message-signing standard used for quotes |
| Raw units | Integer token amounts at native decimals (1 USDC = 1_000000) |
| Skew | Extra spread as a quote consumes more of available inventory |
| Reservation | Inventory hold for an in-flight quote until deadline/settlement |
| Reconcile | Compare ledger vs on-chain balances; halt on divergence |
