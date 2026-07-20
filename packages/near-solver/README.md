# @cavalre/near-solver

NEAR Intents solver built on the CavalRe stack: all money math through
`@cavalre/floatlib-ts` (arbitrary-precision), solver inventory tracked in
`@cavalre/ledger-ts` (double-entry, halts on overdraw), NEP-413 signing with
zero external crypto dependencies (`node:crypto` ed25519).

Built test-first. 64 tests cover every module including an end-to-end
wire-frame-in → verified-signed-quote-out flow.

## Modules

| Module | Responsibility |
|---|---|
| `codec` | Parse/build solver-bus JSON-RPC frames. Fail-closed: invalid → `malformed`, never throws, no float smuggling (amounts are strict decimal-string → bigint). |
| `nep413` | NEP-413 payload (borsh subset, tag `2^31+413`, sha256) + ed25519 signing. Tested against the spec's byte layout, including the transaction-collision guarantee. |
| `pricing` | Exact-in / exact-out pricing with spread in bps. Rounding is always solver-favorable: floor payouts, ceil charges. Handles tokens with >21 decimals (wNEAR = 24) via `rawToFloat`. |
| `risk` | `SolverRiskGuard`: per-quote notional cap, daily loss cap, kill switch. Kill switch survives `resetDay()` — a human clears it. |
| `solver` | `SolverPipeline`: pure decision engine (assets → price → skew → inventory → notional → risk), plus `LedgerInventory` (CavalRe ledger-backed, atomic fills). |
| `relay` | Connection manager with injectable transport, capped exponential backoff, malformed-frame accounting. |

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

- Live transport binding (`WebSocket` wrapper for `wss://solver-relay-v2.chaindefuser.com/ws`) and API-key auth — next PR, behind dry-run.
- Real `PriceSource` (oracle / ref.finance TWAP). The interface is in place; until wired, the pipeline fail-closes with `no_price`.
- On-chain balance reconciliation (`intents.near` → ledger divergence check) and settlement→PnL feedback into the risk guard.

See `docs/NEAR_INTEGRATION.md` for the roadmap.
