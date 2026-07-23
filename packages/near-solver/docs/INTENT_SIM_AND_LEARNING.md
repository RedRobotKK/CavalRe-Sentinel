# Intent simulator + AI learning map

**CANON:** Tier A unless fed live bus journals. NEVER TRUST synthetic PnL as edge.

## Design (simulator)

Goal: stress `decide()` with **protocol-valid** quote requests and **coherent** mids, not random garbage.

| Input | Rule |
|-------|------|
| Assets | Only `MAINNET_REGISTRY` ids |
| Side | Exactly one of `exactAmountIn` \| `exactAmountOut` |
| Size | Log-uniform USD notional in `[minNotionalUsd, maxNotionalUsd]` |
| Mid | Per-asset USD mid from **market averages** + multiplicative noise |
| Pairs | USDC↔wNEAR, USDT↔wNEAR, USDC↔USDT |
| Seed | PRNG deterministic for tests / replay |

Market averages (defaults, overridable):

- USDC = 1.0, USDT = 1.0  
- wNEAR = configurable (e.g. last `oracle:verify` ~1.86)  

Noise: `mid * exp(σ * Z)` with Z ~ approx normal via Box-Muller on seeded PRNG — keeps positives.

Output per tick: `{ request: QuoteRequestEvent, midsUsd: Record<asset, number>, notionalUsd }`  
Runner can inject mids into a `MapPriceSource` and call `SolverPipeline.decide`.

## Pass / fail contract (tests)

| Case | Expect |
|------|--------|
| Deterministic seed | Same sequence |
| Protocol shape | Exactly one amount side |
| Amounts | Positive bigint |
| Assets listed | Both legs in registry |
| Notional bounds | Within configured USD range |
| Mids | Finite, > 0 |

## AI / learning — where the pipeline teaches

```text
quote_request (bus or sim)
  → features_pre: pair, side, log_notional, hour, mid, spread_config
  → decide() verdict + reason + quoted amounts
  → features_post: edge_bps, inventory_skew, reservation
  → [time] settlement / markout
  → label: toxic?, realized_edge_usd, markout_bps
```

| Stage | Learnable? | Notes |
|-------|------------|-------|
| Sim only | **Behavior** of decide/risk | No economic edge claim |
| Dry-run bus + oracle | Would-quote rates, reject mix | Tier C |
| Settlement + chain PnL | **Only** place for supervised “edge” | Tier D |

**Do not** train a live gate on sim labels alone (same rule as soft-prior on Base).

Feature candidates (stable, no leakage):

- `log_notional_usd`, `side_exact_in`, `pair_bucket`, `hour_sin/cos`  
- `mid_age_ms`, `inv_skew_bps`, `half_spread_bps`  
- Reject reason one-hots for calibration diagnostics (not as cheating labels)

Labels (after the fact only):

- `markout_bps` at +60s / +300s vs mid path  
- `toxic` if markout < −spread  
- `realized_edge_usd` from reconciler fills  

Training policy: walk-forward on **settlement-ordered** time; freeze model out of hot path until AUC + calibration gates pass on **live** labels.
