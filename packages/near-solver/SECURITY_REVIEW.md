# Security & Quality Review — near-solver (2026-07-20)

Panel pass: security, quant, SRE, QA. Every accepted finding was encoded as a
failing test before the fix landed (`test/security.test.ts`,
`test/reservations.test.ts`, `test/runner.test.ts`).

## Findings — fixed this pass

| ID | Lens | Finding | Fix |
|----|------|---------|-----|
| S1 | Security | Hostile relay frame with multi-MB digit string reaches `BigInt()` → CPU DoS | Length cap (40 digits, u128 max is 39) checked before parse |
| S2 | Security | No frame size limit before `JSON.parse` | 256 KiB cap in relay; oversized counted as malformed, never parsed |
| S3 | Security/Quant | `min_deadline_ms` is taker-controlled and was honored unbounded — a free option written against the solver | `maxDeadlineMs` config cap; `deadline_too_long` rejection |
| Q1 | Quant | In-flight quote race: two concurrent quotes both pass the inventory check, second settlement overdraws | `ReservingInventory`: all-or-nothing holds per quote, lazy expiry, commit-on-fill |
| O1 | SRE | No safe composition root; nothing prevented accidental live quoting | `SolverRunner`: dryRun defaults true; live requires explicit flag AND key or refuses to start |
| O2 | SRE | Dry-run and live paths could diverge | Reservations run in dry-run too — identical inventory behavior in both modes |
| O3 | SRE | No decision observability | Per-reason counters on every quote decision |
| C1 | Security | Test nonce fixture must never reach production | Runner nonces are `randomBytes(32)` per quote; test asserts uniqueness across quotes |

## Resolved since first pass (2026-07-20, second pass)

- **Reconciliation** (was the live-mode blocker): `Reconciler` compares on-chain
  `intents.near` balances against the ledger on a cadence. Divergence beyond
  `maxDriftUsd` trips the kill switch (baseline deliberately not moved on halt);
  value change between clean reconciles is recorded as PnL into the daily-loss
  breaker. Unpriceable assets: any raw drift halts, PnL is skipped, never faked.
- **Oracle staleness bounds**: `StalenessGuardedPriceSource` rejects prices older
  than `maxAgeMs` AND future-dated prices (clock skew = fault). Stale resolves to
  the existing `no_price` fail-closed path.

## Accepted risks / open items (tracked, not hidden)

- **Concrete adapters pending**: oracle (`TimestampedPriceSource` impl) and
  `OnChainBalanceFetcher` (NEAR RPC) are interfaces with tested consumers but no
  production implementation yet. The system is safe-but-inert without them.
- **Bus settlement→quote matching**: still unimplemented; now an optimization
  rather than a blocker, since reconciliation provides ground truth.
- **Single-process concurrency only**: `ReservingInventory` is synchronous
  in-memory state. Fine for one runner process; a second process would need a
  shared store. Do not run two live runners against one inventory.
- **Key management**: `privateKeyFromSeed` expects the seed from env/keystore.
  Never commit seeds; CI has a basic secret scan as a tripwire, not a guarantee.
- **`npm audit`**: 10 known vulns in dev tooling (eslint 8, vitest 1.x chain).
  No runtime exposure; scheduled for the vitest 3 / eslint 9 upgrade PR.

## Cross-check pass (2026-07-20, third pass)

Each lens audited the others' work. Findings and status live in
[PRODUCTION_READINESS.md](../../docs/near-solver/PRODUCTION_READINESS.md#cross-check-log):
X1 (settled fills false-halting the reconciler — **fixed** via PendingQuoteBook +
exact-match fill inference), X2 (FloatLib precision floor under `maxDriftUsd` —
documented), X3 (pointwise-only pricing tests — **fixed** via seeded property suites).

## G1 adapter pass (2026-07-20, fourth pass)

Cross-referenced findings X4–X8 logged in
[PRODUCTION_READINESS.md](../../docs/near-solver/PRODUCTION_READINESS.md#cross-check-log).
New I/O surface reviewed: RPC timeouts mandatory (X7), balance responses
strictly validated (length, digit strings, 40-char cap), Pyth prices rejected
on wide confidence intervals / non-positive values / absurd exponents, median
oracle refuses single-source pricing and cross-source disagreement.

## Test inventory (near-solver)

131 tests / 19 files: codec 12, nep413 13, pricing 11, pricing-properties 4
(×250 seeded cases each), risk 8, relay 7, solver+inventory 11, reservations 8,
runner 7, wsTransport 2, security 5, integration 2, reconciler 6, staleness 6,
fill-inference 7, nearRpc 5, balanceFetcher 4, oracle 10, priceCache 3.
