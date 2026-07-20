/**
 * MAINNET CONFIGURATION — every value verified against live sources on
 * 2026-07-20. Do not edit without re-verifying; mainnetConfig.test.ts pins
 * these so silent drift fails CI.
 *
 * Verification trail:
 *  - Asset ids + decimals: GET https://1click.chaindefuser.com/v0/tokens
 *    (fixture: test/fixtures/oneclick-tokens.json)
 *  - intents.near mt_batch_balance_of + rpc.fastnear.com:
 *    docs.near-intents.org / verifier-contract / balances
 *  - Solver relay endpoints: docs.near-intents.org / message-bus
 *  - Pyth contract (X11 — was wrongly 'pyth.near'):
 *    docs.pyth.network / contract-addresses / near -> `pyth-oracle.near`
 *    ⚠ X12: Pyth Core DROPS NEAR SUPPORT 2026-08-18. Do not build the oracle
 *    around Pyth; it is at most a short-lived median leg. Primary legs:
 *    OneClickPriceSource + a second independent source (open G1 item).
 */

import * as FloatLib from '@cavalre/floatlib-ts';
import type { AssetRegistry } from './solver.js';

// Verified defuse asset ids (NEAR-native legs)
export const USDC_NEAR =
  'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';
export const WNEAR = 'nep141:wrap.near';
export const USDT_NEAR = 'nep141:usdt.tether-token.near';

export const MAINNET_REGISTRY: AssetRegistry = new Map([
  [USDC_NEAR, { symbol: 'USDC', decimals: 6n }],
  [WNEAR, { symbol: 'wNEAR', decimals: 24n }],
  [USDT_NEAR, { symbol: 'USDT', decimals: 6n }],
]);

export const MAINNET = {
  intentsContract: 'intents.near',
  solverRelayWsUrl: 'wss://solver-relay-v2.chaindefuser.com/ws',
  solverRelayRpcUrl: 'https://solver-relay-v2.chaindefuser.com/rpc',
  oneClickTokensUrl: 'https://1click.chaindefuser.com/v0/tokens',
  /** First entry is the NEAR-Intents-documented default. */
  rpcUrls: ['https://rpc.fastnear.com', 'https://rpc.mainnet.near.org'],
  /** X11-corrected. X12: deprecated by Pyth after 2026-08-18. */
  pythContract: 'pyth-oracle.near',

  /** G3 pocket-money starting caps, mirroring PRODUCTION_READINESS.md. */
  g3Defaults: {
    halfSpreadBps: 50,
    maxInventorySkewBps: 100,
    quoteValidityMs: 60_000,
    maxDeadlineMs: 120_000,
    minNotionalUsd: FloatLib.toFloat(10n, 0n),
    maxQuoteNotionalUsd: FloatLib.toFloat(100n, 0n),
    maxDailyLossUsd: FloatLib.toFloat(20n, 0n), // 2% of a $1k inventory
    maxDriftUsd: FloatLib.ONE,
    priceMaxAgeMs: 5_000,
    reconcileIntervalMs: 60_000,
  },
} as const;
