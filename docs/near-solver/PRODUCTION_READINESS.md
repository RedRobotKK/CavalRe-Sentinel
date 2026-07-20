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

## G1 — Concrete adapters ← WE ARE HERE (code done; verification pending)

*Lens: dev builds, quant reviews pricing, security reviews I/O.*

Built and tested against fixtures:

- [x] `NearRpcClient` — JSON-RPC view calls, abort timeout on every call (X7)
- [x] `IntentsBalanceFetcher` — `mt_batch_balance_of`, strict length/digit validation
- [x] `PythPriceSource` — expo scaling, publish_time seconds→ms (X6), confidence-
      interval rejection (quant: publisher disagreement is not a price)
- [x] `MedianPriceSource` — median across providers, cross-source deviation guard,
      minSources floor (an outage must not become single-source pricing),
      one poisoned source provably cannot move the median of three
- [x] `PriceCache` — async→sync bridge (X8); original timestamps preserved so the
      staleness guard sees the truth; failed refresh keeps last-known

Real-world verification (2026-07-20, network-checked):

- [x] Asset registry verified against the live 1Click API: native USDC =
      `nep141:17208628…133a1` (6 dec), wNEAR = `nep141:wrap.near` (24 dec),
      USDT = `nep141:usdt.tether-token.near` (6 dec) — pinned in
      `src/mainnetConfig.ts` + tests, fixture recorded verbatim
- [x] `mt_batch_balance_of` args/response shape confirmed against NEAR Intents
      docs; documented RPC = `https://rpc.fastnear.com`
- [x] Pyth contract verified: `pyth-oracle.near` (X11 — our default was wrong)
- [x] Second oracle leg BUILT and fixture-tested: `OneClickPriceSource`
      (live API serves USD prices with timestamps)
- [x] Recorded live fixture checked in (`test/fixtures/oneclick-tokens.json`)

Remaining G1 exit criteria:

- [ ] **X12 decision (quant):** Pyth Core drops NEAR support 2026-08-18 — pick
      the long-term second median leg (candidates: ref.finance TWAP, a CEX
      mid via authenticated feed). Until then: 1Click + Pyth short-term.
- [ ] Pyth feed identifiers per asset (only if Pyth is used pre-deprecation)
- [ ] Register at https://partners.near-intents.org for the bus API key
- [ ] NEAR RPC live smoke test from a network-open environment (sandbox here
      could not reach RPC hosts; docs-verified instead — run once from the
      deploy box)

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
- Only now consider the learned-markup model — the full plan, constraints, and
  M0→M3 progression live in [ML_ARCHITECTURE.md](./ML_ARCHITECTURE.md).
  Summary: journal-derived labels only, walk-forward only, shadow mode before
  touching prices, static config always one switch away. **No model work is on
  the critical path**; during G2 the AI team ships descriptive analytics (M0)
  over the journal, which doubles as the quant's review tooling.

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
| X4 | security × quant | Assets on-chain but not in the registry are invisible to reconciliation (dust/airdrops) | Accepted: unquoted assets risk nothing; revisit if inventory assets grow |
| X5 | quant × SRE | Double-count risk: both `realizedEdgeUsd` and reconciler PnL could feed the guard | Rule: **the Reconciler is the ONLY writer of PnL into the risk guard**. `realizedEdgeUsd` is for reporting/analysis only |
| X6 | dev × quant | Pyth publish_time (seconds) vs asOfMs (ms) — silent unit bug would make every price look 50 years stale | **Fixed** in adapter, conversion in exactly one place, regression-tested |
| X7 | SRE | RPC calls without timeouts can hang the reconcile loop | **Fixed**: AbortController timeout on every `NearRpcClient` call |
| X8 | dev × SRE | Async oracle vs sync pipeline reads — interface impedance | **Fixed**: `PriceCache` bridge, original timestamps preserved, staleness guard as backstop |
| X9 | quant × SRE × AI | G2 says "review the tape" but nothing recorded it; future models had no data source | **Fixed**: `DecisionJournal` — versioned JSONL, every decision/fill/reconcile, sink failures never reach the trading path |
| X10 | AI × quant | "Didn't fill" conflates lost-on-price with abandoned intent — naive win-rate models would over-tighten | Documented + mitigation plan in ML_ARCHITECTURE.md §3; on-chain settlement data provides true loss margins later |
| X11 | QA (live verification) | Pyth default contract was `pyth.near`; the real mainnet contract is `pyth-oracle.near` | **Fixed** + pinned by test. Structural tests could never catch this — real-world verification exists for exactly this class |
| X12 | QA (live verification) | Pyth Core drops NEAR support 2026-08-18 — one month out. An oracle built around Pyth dies in production | **Mitigated**: `OneClickPriceSource` built as a primary leg (verified live, fixture-tested); long-term second leg is an open quant decision |
