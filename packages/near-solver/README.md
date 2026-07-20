# @cavalre/near-solver

NEAR Intents solver built on the CavalRe stack: all money math through
`@cavalre/floatlib-ts` (arbitrary-precision), solver inventory tracked in
`@cavalre/ledger-ts` (double-entry, halts on overdraw), NEP-413 signing with
zero external crypto dependencies (`node:crypto` ed25519).

Built test-first. 98 tests cover every module including an end-to-end
wire-frame-in → verified-signed-quote-out flow.

**Docs:** [Architecture](../../docs/near-solver/ARCHITECTURE.md) ·
[Operations runbook](../../docs/near-solver/OPERATIONS.md) ·
[Security review](./SECURITY_REVIEW.md)

## Modules

| Module | Responsibility |
|---|---|
| `codec` | Parse/build solver-bus JSON-RPC frames. Fail-closed: invalid → `malformed`, never throws, no float smuggling (amounts are strict decimal-string → bigint). |
| `nep413` | NEP-413 payload (borsh subset, tag `2^31+413`, sha256) + ed25519 signing. Tested against the spec's byte layout, including the transaction-collision guarantee. |
| `pricing` | Exact-in / exact-out pricing with spread in bps. Rounding is always solver-favorable: floor payouts, ceil charges. Handles tokens with >21 decimals (wNEAR = 24) via `rawToFloat`. |
| `risk` | `SolverRiskGuard`: per-quote notional cap, daily loss cap, kill switch. Kill switch survives `resetDay()` — a human clears it. |
| `solver` | `SolverPipeline`: pure decision engine (assets → price → skew → inventory → notional → risk), plus `LedgerInventory` (CavalRe ledger-backed, atomic fills). |
| `relay` | Connection manager with injectable transport, capped exponential backoff, malformed-frame accounting, 256 KiB frame cap. |
| `runner` | Composition root. Dry-run by default, key-gated live mode, random per-quote nonces, per-reason decision metrics. |
| `reconciler` | Chain-truth reconciliation: divergence beyond tolerance trips the kill switch; value change between reconciles feeds the daily-loss breaker. |
| `staleness` | `StalenessGuardedPriceSource`: age-bounds any timestamped oracle; stale or future-dated prices become `no_price`. |
| `wsTransport` | The only real-I/O module: adapts global WebSocket to the relay's `Transport`. |

## Design rules

- **Pure core, injected edges.** Clock, transport, prices, keys — all injected. `decide()` is a pure function; every branch is unit-tested.
- **Fail-closed everywhere.** No price → no quote. Unknown asset → no quote. Unpriceable notional → no quote. Overdraw → throw before state changes.
- **Conservative rounding.** We never round in the taker's favor by even one raw unit.
- **No secrets in config.** Keys come from a keystore/env as raw seeds (`privateKeyFromSeed`); ephemeral keys only in tests.

## Running

```bash
npm test              # vitest, 64 tests
npm run typecheck     # strict TS, no emit
```

## Not yet implemented (deliberately)

- A concrete oracle adapter (ref.finance TWAP / Pyth). `StalenessGuardedPriceSource`
  defines the contract it must satisfy; until wired, the pipeline fail-closes with
  `no_price`.
- A concrete `OnChainBalanceFetcher` (NEAR RPC view calls against `intents.near`).
  The `Reconciler` is fully tested against the interface.
- Bus settlement→quote matching (optimization; reconciliation is the safety net).

See `docs/NEAR_INTEGRATION.md` for the roadmap.
