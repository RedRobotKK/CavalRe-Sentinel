# ML Architecture — Learning Layer for the NEAR Solver

**Authors:** AI/ML engineering team, after observing the full build.
**Status:** design only. No model code exists, deliberately — see "Sequencing."
**Prime directive:** the learning layer OPTIMIZES inside the box the foundation
built. It never gets to redraw the box.

## 1. What we observed (the primitives we have to work with)

The solver is a fail-closed decision pipeline with exactly three numeric knobs
a model could legitimately drive, all already parameterized:

| Knob | Today | Where it lives |
|------|-------|----------------|
| `halfSpreadBps` | static config | `SolverConfig` → `SolverPipeline.decide` step 3 |
| inventory skew curve | linear, `maxInventorySkewBps` cap | `inventorySkewBps()` in `pricing.ts` |
| quote/no-quote (within limits) | quote whenever all six gates pass | implicit in `decide()` |

Everything else in the decision path is a **constraint, not a knob**: asset
allowlist, deadline cap, staleness guard, inventory reservations, notional
caps, daily-loss breaker, kill switch, reconciler. These exist because of
adversarial and operational realities that do not change when a model shows up.

## 2. Hard constraints (non-negotiable, enforced by architecture)

1. **The model proposes; the pipeline disposes.** Any learned policy plugs in
   as a *parameter provider* to `SolverPipeline` — it can suggest a spread in
   `[minSpreadBps, maxSpreadBps]` or suggest declining. It cannot bypass a
   gate, touch signing, move inventory, or see the private key. Concretely: a
   `SpreadPolicy` interface returning bps, clamped by config bounds, called at
   step 3. A policy returning garbage degrades to the static default.
2. **Risk guard supremacy.** `SolverRiskGuard` and the Reconciler's kill
   switch sit AFTER any model output. A model cannot raise its own caps.
3. **PnL single-writer rule (X5) extends to models**: models read the journal;
   they never write PnL, ledger entries, or reservations.
4. **Fail-closed inference.** Model timeout/error/NaN → static config values.
   Inference gets a hard latency budget (quote requests are competitive;
   target: policy call ≤ 5ms in-process, no network hops in the quote path).
5. **No training in the trading process.** Training is offline, on journal
   exports. The runner never imports a training framework.

## 3. Data: the journal is the only source of truth

`DecisionJournal` (X9) emits versioned JSONL:

| Entry | Contents | Role |
|-------|----------|------|
| `quote_decision` | full request + decision (amounts as exact strings, spread bps, reason if rejected) | features + actions |
| `inferred_fill` | quoteId, txHash | **labels** (join key: quoteId) |
| `reconcile` | status, drift count, PnL | ground-truth marks + data-quality signal |

**Label derivation (offline):** `quote_decision ⋈ inferred_fill` on quoteId.
Joined ⇒ our quote won and settled. Unjoined past `deadline + grace` ⇒ we
quoted and didn't fill (lost the auction, or the taker walked). Rejections are
retained as counterfactual context. Effective price = amountOut/amountIn;
mid is recoverable from effective price + recorded spread bps — no schema
change needed.

**X10 — known label limitation (logged in the cross-check table):** "didn't
fill" conflates *lost on price* with *intent abandoned*. This biases naive
win-rate models toward over-tightening. Mitigations, in order: (a) model
fill-probability as a function of spread and treat abandonment as noise,
(b) enrich later with observed on-chain settlements of the same intents
(`scripts/fetch-near-intents.js` data identifies the winning solver's price),
giving true "we lost by X bps" labels. (b) is the reason that fetcher keeps
running from day one.

## 4. Model progression (strictly in this order)

**M0 — Descriptive analytics (during G2 dry-run).** No learning. Daily job
over the journal: fill-rate by pair/size/hour, spread distribution, rejection
histogram, would-have-been PnL. This is the quant's G2 review tooling AND the
feature-engineering sandbox. Ships as a script, not a service.

**M1 — Fill-probability curve (during G3).** Logistic model / isotonic fit:
P(fill | pair, size bucket, spread bps, hour). Small, inspectable,
walk-forward validated (train weeks 1..k, test week k+1 — never shuffled).
Output: a table, reviewed by the quant, NOT wired to anything yet.

**M2 — Spread policy in shadow mode (late G3).** `SpreadPolicy` chooses spread
to maximize `P(fill|spread) × edge(spread)` within config bounds. Runs in
shadow: journal records both the policy's suggestion and the static spread
actually used. Promotion criterion: shadow policy beats static on ≥ 2 weeks
of walk-forward replay AND its suggestions never violated bounds.

**M3 — Live policy behind its own breaker (G4).** Promoted policy drives
spread inside clamps. New runner metric: `policy_fallbacks` (timeouts/errors).
A `policyKillSwitch` reverts to static config instantly; the quant can trip it
without redeploying. Retraining cadence: weekly, offline, with the same
promotion gate every time. Model artifacts are versioned in the journal
(`policy_version` added to `quote_decision` at M2 — the only schema change).

**Explicitly rejected for the foreseeable future:** RL with live exploration
(exploration = paying to be picked off), any LLM in the quote path (latency
and determinism), model-driven inventory/risk limits (the box stays human).

## 5. Why the old approach died (and how this one can't repeat it)

The pre-pivot models (see `docs/archive/`) trained on synthetic data whose
labels were functions of the generator: 100% precision, 0 information. The
structural safeguards now: labels come only from settled on-chain outcomes via
the journal; evaluation is walk-forward only; every model passes shadow mode
against the static baseline before touching a price; and the static baseline
is always one switch away. A model that is worse than a constant gets caught
by construction, not by post-mortem.

## 6. Sequencing (protecting the foundation)

Nothing in M0–M1 touches `src/`. The only foundation change ever needed is
the `SpreadPolicy` seam at M2 (~20 lines + tests, TDD like everything else),
and `policy_version` in the journal schema (additive, versioned). Until G2
produces real journal data, the AI team's job is M0 tooling and label-quality
analysis on `fetch-near-intents.js` output. **No model work is on the critical
path to production — the path in PRODUCTION_READINESS.md is unchanged.**
