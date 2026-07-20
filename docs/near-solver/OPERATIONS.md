# near-solver Operations Runbook

**Audience:** whoever is on call. **Rule zero:** when in doubt, trip the kill switch.
Quoting stops instantly; nothing else is affected; un-tripping is one call after a human
has looked.

## Configuration reference

| Key | Type | Meaning | Sane starting value |
|-----|------|---------|---------------------|
| `signerId` | string | NEAR account quotes are signed as | your solver account |
| `halfSpreadBps` | int | Base spread charged to takers | 30–80 |
| `maxInventorySkewBps` | int | Max extra spread at full inventory utilization | 50–200 |
| `quoteValidityMs` | int | Our preferred quote lifetime | 60_000 |
| `maxDeadlineMs` | int | Hard cap on taker-demanded deadlines (free-option defense) | 120_000 |
| `minNotionalUsd` | FloatFixed | Dust floor per quote | $10 |
| `maxQuoteNotionalUsd` | FloatFixed | Risk guard: single-quote cap | start tiny: $100 |
| `maxDailyLossUsd` | FloatFixed | Risk guard: daily loss breaker | 1–2% of inventory value |
| `maxDriftUsd` | FloatFixed | Reconciler: per-asset divergence tolerance. Floor ~$0.01: FloatLib carries 21 significant digits, so 24-decimal tokens can round by sub-dust (X2) | $1 |
| `maxAgeMs` (staleness) | int | Oldest acceptable price | 2_000–5_000 |
| `dryRun` | bool | **Defaults TRUE.** Live requires explicit `false` + key | true until proven |

Keys: the ed25519 seed comes from your keystore/env via `privateKeyFromSeed(seed)`.
Never in config files, never in git (CI has a tripwire scan; treat it as a seatbelt,
not a parachute).

## Starting up

Dry-run first, always:

1. Start the runner with `dryRun` unset (defaults true). It will connect, subscribe,
   decide on real quote traffic, reserve inventory — and send nothing.
2. Watch `metrics.counters` for a few hours. You want a healthy mix of
   `would_quote_dry_run` and rejections that make sense for your config.
3. Only after dry-run decisions look right: set `dryRun: false`, provide the key,
   restart. The runner refuses to start live without a key — that's intentional.

## Metrics reference

All counters live on `runner.metrics.counters`:

| Counter | Meaning | Worry when |
|---------|---------|-----------|
| `quote_decision:would_quote_dry_run` | Dry-run would have quoted | zero for hours (config too strict? no traffic?) |
| `quote_decision:quoted_live` | Signed quote sent | sudden spike (are limits right?) |
| `quote_decision:asset_not_listed` | Pair outside registry | n/a — expected noise |
| `quote_decision:deadline_too_long` | Taker demanded too-long commitment | high ratio (raise cap only with eyes open) |
| `quote_decision:no_price` | Price missing or stale | ANY sustained run — oracle problem |
| `quote_decision:insufficient_inventory` | Payout exceeds unreserved balance | persistent — rebalance inventory |
| `quote_decision:below_min_notional` | Dust request | n/a |
| `quote_decision:notional_exceeds_max` | Above per-quote cap | frequent — consider raising deliberately |
| `quote_decision:daily_loss_exceeded` | Loss breaker holding quoting shut | ALWAYS investigate before any reset |
| `quote_decision:kill_switch:*` | Kill switch active, reason in suffix | you should already know why |
| `quote_decision:reservation_conflict` | Lost race to a concurrent quote | frequent — inventory too small for flow |
| `settlement:observed` | Bus reported a settlement | diverges from reconciler fills |
| relay `stats.malformedFrames` | Hostile/broken frames dropped | sudden spike — investigate source |
| relay `stats.reconnects` | Transport reconnections | steady climb — network/bus health |

## Reconciliation

Run `Reconciler.reconcile(fetcher)` on a cadence (start: every 60s) and after any
restart. Outcomes:

- **`ok`, `pnlUsd` null** — first run since boot; baseline set. Expected after restart.
- **`ok`, `pnlUsd` present** — value change was recorded into the daily-loss breaker.
  Negative numbers are information, not incidents — until the breaker trips.
- **`halted`** — ledger and chain disagree beyond tolerance. Kill switch is now ON.
  See incident playbook. The PnL baseline is intentionally NOT moved on a halt.

## Incident playbook

**Kill switch: `reconciliation_divergence`**
1. Do not clear the switch. Quoting is stopped; you have time.
2. Pull the `ReconcileReport.drifts` — which asset, how much, which direction.
   Note: settled fills matching pending quotes are auto-applied (`inferredFills`
   in the report) and do NOT halt; if you're here, the drift matched nothing.
3. Explain every drifted unit: a fill with off-by-something amounts? a deposit
   you forgot? theft?
4. Correct the ledger via explicit deposit/fill entries until a manual reconcile
   returns `ok`.
5. Only then `clearKillSwitch()`. If you cannot explain the drift, the switch stays on.

**Kill switch: `daily_loss_exceeded` (via breaker, not switch — quoting auto-blocked)**
1. This is the system working. Review the day's fills and spreads before anything else.
2. If the losses are real and understood (bad pricing, adverse selection), fix the
   config (wider spread, lower caps) before the next `resetDay()`.
3. `resetDay()` is for the actual day boundary, not for "turning it back on."

**Sustained `no_price`**
1. Check the oracle adapter and its timestamps — the staleness guard rejects old AND
   future-dated prices, so clock skew on the oracle host looks identical to staleness.
2. The system is safe (not quoting) but earning nothing. Fix the feed, not the guard.

**Relay flapping (climbing `reconnects`)**
1. Backoff is capped at `reconnectMaxMs`; the client will keep trying.
2. Reservations from before a disconnect still expire on schedule — no cleanup needed.
3. If the bus is down hard: nothing to do; the system idles safely.

**Suspected key compromise**
1. Trip the kill switch, stop the runner.
2. Rotate the NEAR account's full-access key on-chain immediately (the NEP-413
   signature is only as good as the key).
3. Audit recent settlements on `intents.near` for quotes you didn't make.

## Constraints you must not violate

- **One runner process per inventory.** Reservations are in-memory. Two live runners
  against one balance = the double-book race returns. Shard by asset instead.
- **Never share or commit the seed.** `privateKeyFromSeed` exists so the seed lives in
  a keystore. The account key must be full-access (NEP-413 requirement) — treat it
  accordingly.
- **Don't widen `maxDriftUsd` to make halts go away.** The halts are the product.
