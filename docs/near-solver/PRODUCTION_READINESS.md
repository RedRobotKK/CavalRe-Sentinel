# Path to Production — Gated Milestones

**Rule:** gates are passed in order, each with explicit exit criteria and a named
reviewing lens. No gate is skipped because the previous one "basically works."
Capital only ever increases at gate boundaries, never mid-gate.

**Current position: G1 (adapters) — everything before it is done and tested.**

---

## G0 — Core correctness ✅ DONE

*Lens: dev + QA + security.*

- [x] All money math through FloatLib; bigint-only boundaries; >21-decimal support
- [x] NEP-413 signing byte-exact to spec, signature round-trip verified
- [x] Fail-closed pipeline (6 gates, every rejection reason tested)
- [x] Adversarial input hardening (S1 amount cap, S2 frame cap, S3 deadline cap)
- [x] Reservations close the in-flight race; kill switch semantics; dry-run default
- [x] Reconciler with fill inference (cross-check X1 — settled fills no longer
      false-halt); staleness guard; property tests (1,000 randomized pricing cases)
- [x] 237 tests repo-wide, CI on every push, docs cross-checked against code

## G1 — Concrete adapters ← WE ARE HERE

*Lens: dev builds, quant reviews pricing, security reviews I/O.*

Two small PRs against tested interfaces:

1. **Oracle adapter** implementing `TimestampedPriceSource` (ref.finance TWAP or
   Pyth-on-NEAR), sitting behind `StalenessGuardedPriceSource`.
   Exit: unit tests with recorded API fixtures; staleness cutoffs verified;
   quant signs off on which pools/feeds define "mid" for each listed pair.
2. **`OnChainBalanceFetcher`** doing NEAR RPC view calls (`mt_batch_balance_of`
   on `intents.near`).
   Exit: fixture tests; RPC failure paths verified (reconciler already treats
   fetch failure as no-op by test).

Also in G1: register at https://partners.near-intents.org for the solver-bus
API key (lead time unknown — start now).

## G2 — Live dry-run (no capital at risk)

*Lens: SRE owns; quant reads the tape.*

Connect to `wss://solver-relay-v2.chaindefuser.com/ws` with `dryRun: true`.
Run **≥ 5 consecutive trading days**. Exit criteria, all required:

- [ ] Zero crashes; reconnects behave per backoff design
- [ ] `would_quote_dry_run` decisions look economically sane against the tape
      (quant reviews a daily sample: would we have been picked off?)
- [ ] `no_price` rate < 1% of quote requests during oracle uptime
- [ ] `malformedFrames` near zero; any spike explained
- [ ] Reconciler runs every 60s against real balances with zero false halts
- [ ] Runbook exercised at least once for real (e.g. deliberate oracle stop)

## G3 — Live with pocket money

*Lens: risk officer (quant) owns the caps; SRE owns the pager.*

Fund the solver account with an amount you are indifferent to losing (suggest
$500–1,000 total inventory). Config: `maxQuoteNotionalUsd: $100`,
`maxDailyLossUsd: 2% of inventory`, `maxDriftUsd: $1`.
Run **≥ 10 trading days**. Exit criteria:

- [ ] ≥ 30 settled fills, every one matched by fill inference (zero manual
      reconciliations)
- [ ] Realized edge per fill ≥ 0 net of gas on average; distribution reviewed
- [ ] No kill-switch trips, or every trip fully explained + runbook followed
- [ ] Daily reconciler PnL ≈ sum of per-fill edges (accounting closes)

## G4 — Scale deliberately

*Lens: all of the above, monthly review.*

- Raise caps stepwise (×2–3 per step, never more), one step per clean week
- Add pairs one at a time; each new pair re-enters at G3-level caps
- Shard by asset across runner processes if flow demands it (never two runners
  on one inventory — see SECURITY_REVIEW)
- Only now consider the learned-markup model (train on accumulated settlement
  data from `fetch-near-intents.js` + own fills; walk-forward validation;
  shadow mode before it touches prices)

---

## Standing constraints (all gates)

| Constraint | Why |
|---|---|
| Kill switch never auto-clears | A human explains, then clears |
| Dry-run and live share one code path | What you rehearsed is what runs |
| `maxDriftUsd` ≥ ~$0.01 | FloatLib carries 21 significant digits; wNEAR raw amounts can round by sub-dust (cross-check X2). Tolerance below precision floor = false halts |
| One runner per inventory | In-memory reservations (documented) |
| Full-access key in keystore only | NEP-413 requires full-access; treat accordingly |
| Every new feature lands test-first | The mock-data era is over; see docs/archive for how it ends |

## Cross-check log

| ID | Found by | Finding | Status |
|----|----------|---------|--------|
| X1 | quant × SRE composition | Settled fills would false-halt the solver (reconciler saw them as divergence) | **Fixed**: PendingQuoteBook + exact-match fill inference, 7 tests |
| X2 | security × dev | FloatLib 21-sig-digit precision puts a floor under `maxDriftUsd` | Documented (this file + runbook) |
| X3 | QA | Pricing invariants only tested pointwise | **Fixed**: 4 property suites × 250 seeded random cases |
