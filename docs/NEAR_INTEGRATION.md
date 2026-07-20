# NEAR Intents Integration Plan

## Why NEAR

Sentinel was originally built against CoW Protocol (Ethereum). The pivot target is the
**NEAR Intents solver network**: solvers (market makers) receive quote requests over a
message bus, respond with signed quotes, and settlement happens atomically on the
`intents.near` verifier contract. This gives us:

1. A real intent-auction venue to solve on (same mental model as CoW, lower gas).
2. **Real settlement data** for training — replacing the mock/synthetic data that made
   the previous models meaningless (see `docs/archive/` for that history).

## Protocol surface

| Thing | Value |
|---|---|
| Solver WebSocket | `wss://solver-relay-v2.chaindefuser.com/ws` |
| RPC (quotes/status) | `https://solver-relay-v2.chaindefuser.com/rpc` (JWT via `X-API-Key`) |
| Verifier contract | `intents.near` |
| Signature standards | NEP-413 (NEAR), ERC-191, raw ed25519 |
| API key registration | https://partners.near-intents.org |

Solver flow: `subscribe("quote")` → receive quote events → respond `quote_response` with
signed NEP-413 `token_diff` intent → subscribe `quote_status` for settlement.

## What exists now

- **`packages/near-solver` (@cavalre/near-solver)** — the tested solver implementation,
  built TDD-first (64 tests, strict TS). Codec, NEP-413 signing (spec-exact, zero crypto
  deps), FloatLib pricing with solver-favorable rounding, ledger-backed inventory
  (CavalRe double-entry, overdraw halts), fail-closed risk guard with kill switch,
  reconnecting relay client with injectable transport, and an end-to-end
  frame→signed-quote integration test. See its README for module map and open items.
- `scripts/fetch-near-intents.js` — pulls real `intents.near` settlements from NearBlocks
  into `data/near-intents.json`.
- `src/near/` — superseded scaffold, now a pointer stub (safe to `git rm`).

## Roadmap (in order, no skipping)

1. **Data first.** Run the fetcher, build a feature extractor over `execute()` /
   `token_diff` settlements: pair, size, realized spread, time-of-day, fill latency.
   Target thousands of real examples before any model talk.
2. **Pricing.** Wire a reference price source (ref.finance pools / oracle) into
   `estimateNotionalUsd()` and quote pricing. No model needed yet — start with
   reference-price ± spread.
3. **Signing.** Implement NEP-413 signing (`near-api-js` / `@near-js` packages,
   borsh-serialized payload) for `quote_response`.
4. **Testnet.** Register for an API key, run dry-run against live quote flow, then
   smallest-possible live quotes.
5. **Model.** Only after 1–4: train markup/selection model on real settlements with
   walk-forward validation. The old mock-trained models in `data/` are for reference
   only and must not be used for live decisions.

## Risk rules carried over (unchanged, absolute)

- Max position 5% of capital, max 2x leverage (not applicable to spot quoting, keep anyway)
- Max daily loss 10%, max drawdown 15% → quoting halts
- Fail-closed: unpriceable or unverifiable state ⇒ no quote
- Dry-run is the default mode; live mode requires explicit config + implemented signing
