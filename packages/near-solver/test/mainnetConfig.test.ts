/**
 * Mainnet configuration — every value here was VERIFIED against live
 * sources on 2026-07-20 (1Click API for asset ids/decimals, NEAR Intents
 * docs for contracts/endpoints, Pyth docs for the oracle contract).
 * These tests pin the verified values so a silent edit can't drift them.
 */
import { describe, it, expect } from 'vitest';
import * as FloatLib from '@cavalre/floatlib-ts';
import {
  MAINNET,
  MAINNET_REGISTRY,
  USDC_NEAR,
  WNEAR,
  USDT_NEAR,
} from '../src/mainnetConfig';

describe('MAINNET endpoints (doc-verified 2026-07-20)', () => {
  it('pins the verified contract and endpoint set', () => {
    expect(MAINNET.intentsContract).toBe('intents.near');
    expect(MAINNET.solverRelayWsUrl).toBe('wss://solver-relay-v2.chaindefuser.com/ws');
    expect(MAINNET.solverRelayRpcUrl).toBe('https://solver-relay-v2.chaindefuser.com/rpc');
    expect(MAINNET.oneClickTokensUrl).toBe('https://1click.chaindefuser.com/v0/tokens');
    expect(MAINNET.rpcUrls[0]).toBe('https://rpc.fastnear.com'); // documented by NEAR Intents
    // X11: pyth.near was WRONG; verified against Pyth docs
    expect(MAINNET.pythContract).toBe('pyth-oracle.near');
  });
});

describe('MAINNET_REGISTRY (1Click-API-verified 2026-07-20)', () => {
  it('native USDC on NEAR is the hash-account with 6 decimals', () => {
    expect(USDC_NEAR).toBe(
      'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1'
    );
    expect(MAINNET_REGISTRY.get(USDC_NEAR)?.decimals).toBe(6n);
  });

  it('wNEAR is nep141:wrap.near with 24 decimals (the >21-digit FloatLib case)', () => {
    expect(WNEAR).toBe('nep141:wrap.near');
    expect(MAINNET_REGISTRY.get(WNEAR)?.decimals).toBe(24n);
  });

  it('native USDT is usdt.tether-token.near with 6 decimals', () => {
    expect(USDT_NEAR).toBe('nep141:usdt.tether-token.near');
    expect(MAINNET_REGISTRY.get(USDT_NEAR)?.decimals).toBe(6n);
  });

  it('every registry entry has a nepXXX: prefix and positive decimals', () => {
    for (const [assetId, info] of MAINNET_REGISTRY) {
      expect(assetId).toMatch(/^nep\d+:.+/);
      expect(info.decimals).toBeGreaterThan(0n);
      expect(info.symbol.length).toBeGreaterThan(0);
    }
  });
});

describe('G3 starting risk config (pocket-money caps per PRODUCTION_READINESS)', () => {
  it('caps match the gated plan and are FloatLib values', () => {
    // NB: toNumber is a DISPLAY helper (Number(mantissa)·10^exp) and may show
    // float dust at the 15th digit; the FloatFixed itself is exact. Compare
    // exactly via FloatLib, closely via toNumber — never the other way round.
    expect(FloatLib.isEQ(MAINNET.g3Defaults.maxQuoteNotionalUsd, FloatLib.toFloat(100n, 0n))).toBe(true);
    expect(FloatLib.toNumber(MAINNET.g3Defaults.maxQuoteNotionalUsd)).toBeCloseTo(100, 9);
    expect(FloatLib.toNumber(MAINNET.g3Defaults.minNotionalUsd)).toBeCloseTo(10, 9);
    expect(MAINNET.g3Defaults.halfSpreadBps).toBeGreaterThanOrEqual(30);
    expect(MAINNET.g3Defaults.maxDeadlineMs).toBeLessThanOrEqual(120_000);
    expect(MAINNET.g3Defaults.priceMaxAgeMs).toBeLessThanOrEqual(5_000);
  });
});
