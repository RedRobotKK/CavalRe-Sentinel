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

## Accepted risks / open items (tracked, not hidden)

- **Settlement→quote matching**: quote_status events carry `quote_hash`, which
  we don't yet learn from relay acks. Until that lands, `commit()` isn't called
  automatically; reservations self-expire and reconciliation is manual.
  Blocker for live mode with meaningful size.
- **PriceSource is still abstract**: pipeline fail-closes (`no_price`), so the
  system is safe but inert until an oracle adapter lands. Staleness bounds must
  be part of that adapter's contract (reject prices older than N ms).
- **Single-process concurrency only**: `ReservingInventory` is synchronous
  in-memory state. Fine for one runner process; a second process would need a
  shared store. Do not run two live runners against one inventory.
- **Key management**: `privateKeyFromSeed` expects the seed from env/keystore.
  Never commit seeds; CI has a basic secret scan as a tripwire, not a guarantee.
- **`npm audit`**: 10 known vulns in dev tooling (eslint 8, vitest 1.x chain).
  No runtime exposure; scheduled for the vitest 3 / eslint 9 upgrade PR.

## Test inventory (near-solver)

86 tests / 11 files: codec 12, nep413 13, pricing 11, risk 8, relay 7,
solver+inventory 11, reservations 8, runner 7, wsTransport 2, security 5,
integration 2.
