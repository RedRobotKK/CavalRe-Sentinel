/**
 * SRE REVIEW: the composition root must be safe by default and observable.
 *  - dryRun defaults to TRUE; live mode requires an explicit key AND flag.
 *  - every quote decision increments a counter with its reason.
 *  - quotes reserve inventory for their deadline window even in dry-run
 *    (so dry-run behavior matches live behavior).
 *
 * QUANT REVIEW: realized edge must be computable per fill and fed to the
 * risk guard so the daily-loss breaker works off real numbers.
 */
import { describe, it, expect } from 'vitest';
import * as FloatLib from '@cavalre/floatlib-ts';
import { SolverRunner, realizedEdgeUsd } from '../src/runner';
import { DecisionJournal } from '../src/journal';
import { LedgerInventory } from '../src/solver';
import { SolverRiskGuard } from '../src/risk';
import { generateSolverKeypair } from '../src/nep413';
import type { Transport, TransportHandlers } from '../src/relay';

const USDC = 'nep141:usdc.near';
const WNEAR = 'nep141:wrap.near';
const REGISTRY = new Map([
  [USDC, { symbol: 'USDC', decimals: 6n }],
  [WNEAR, { symbol: 'wNEAR', decimals: 24n }],
]);

const priceSource = {
  mid: (a: string, b: string) =>
    a === USDC && b === WNEAR ? FloatLib.toFloat(2n, 0n) : null,
  usdPrice: (a: string) =>
    a === USDC ? FloatLib.ONE : a === WNEAR ? FloatLib.toFloat(5n, 1n) : null,
};

function quoteFrame(id = 'q-run'): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    method: 'subscribe',
    params: {
      subscription: 's',
      quote_id: id,
      defuse_asset_identifier_in: USDC,
      defuse_asset_identifier_out: WNEAR,
      exact_amount_in: '100000000',
      min_deadline_ms: 60000,
    },
  });
}

function makeRunner(opts: { dryRun?: boolean; withKey?: boolean } = {}) {
  const sent: string[] = [];
  let handlers!: TransportHandlers;
  const inventory = new LedgerInventory(REGISTRY);
  inventory.deposit(WNEAR, 1_000n * 10n ** 24n, 'genesis');
  inventory.deposit(USDC, 10_000_000000n, 'genesis');

  const runner = new SolverRunner({
    registry: REGISTRY,
    priceSource,
    baseInventory: inventory,
    riskGuard: new SolverRiskGuard({
      maxQuoteNotionalUsd: FloatLib.toFloat(10_000n, 0n),
      maxDailyLossUsd: FloatLib.toFloat(500n, 0n),
    }),
    solverConfig: {
      signerId: 'sentinel-solver.near',
      halfSpreadBps: 50,
      maxInventorySkewBps: 100,
      quoteValidityMs: 60_000,
      maxDeadlineMs: 120_000,
      minNotionalUsd: FloatLib.toFloat(10n, 0n),
    },
    relay: {
      url: 'wss://fake',
      transportFactory: (_u: string, h: TransportHandlers): Transport => {
        handlers = h;
        return { send: (d: string) => sent.push(d), close: () => {} };
      },
      reconnectMinMs: 1000,
      reconnectMaxMs: 8000,
    },
    ...(opts.dryRun === undefined ? {} : { dryRun: opts.dryRun }),
    ...(opts.withKey ? { privateKey: generateSolverKeypair().privateKey } : {}),
    now: () => Date.parse('2026-07-20T12:00:00.000Z'),
  });

  return { runner, sent, getHandlers: () => handlers };
}

describe('SolverRunner safety defaults', () => {
  it('dry-run is the DEFAULT: decisions happen, nothing is sent', () => {
    const { runner, sent, getHandlers } = makeRunner({ withKey: true });
    runner.start();
    getHandlers().onOpen();
    getHandlers().onMessage(quoteFrame());
    expect(sent).toHaveLength(2); // subscribes only
    expect(runner.metrics.counters['quote_decision:would_quote_dry_run']).toBe(1);
  });

  it('live mode without a private key refuses to start', () => {
    const { runner } = makeRunner({ dryRun: false, withKey: false });
    expect(() => runner.start()).toThrow(/private key/i);
  });

  it('live mode with a key sends a signed quote_response', () => {
    const { runner, sent, getHandlers } = makeRunner({ dryRun: false, withKey: true });
    runner.start();
    getHandlers().onOpen();
    getHandlers().onMessage(quoteFrame());
    expect(sent).toHaveLength(3);
    const frame = JSON.parse(sent[2]!);
    expect(frame.method).toBe('quote_response');
    expect(frame.params[0].signed_data.standard).toBe('nep413');
    // nonce is unique per quote, not a fixture
    const nonce1 = frame.params[0].signed_data.payload.nonce;
    getHandlers().onMessage(quoteFrame('q-run-2'));
    const nonce2 = JSON.parse(sent[3]!).params[0].signed_data.payload.nonce;
    expect(nonce1).not.toBe(nonce2);
  });

  it('reserves inventory per quote even in dry-run (parity with live)', () => {
    const { runner, getHandlers } = makeRunner({ withKey: true });
    runner.start();
    getHandlers().onOpen();
    getHandlers().onMessage(quoteFrame('q-a'));
    const afterOne = runner.inventory.availableRaw(WNEAR);
    expect(afterOne).toBeLessThan(1_000n * 10n ** 24n); // ~199 wNEAR held
    getHandlers().onMessage(quoteFrame('q-b'));
    expect(runner.inventory.availableRaw(WNEAR)).toBeLessThan(afterOne);
  });

  it('counts rejected quotes by reason', () => {
    const { runner, getHandlers } = makeRunner({ withKey: true });
    runner.start();
    getHandlers().onOpen();
    getHandlers().onMessage(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'subscribe',
        params: {
          subscription: 's',
          quote_id: 'q-bad',
          defuse_asset_identifier_in: 'nep141:unknown.near',
          defuse_asset_identifier_out: WNEAR,
          exact_amount_in: '100000000',
          min_deadline_ms: 60000,
        },
      })
    );
    expect(runner.metrics.counters['quote_decision:asset_not_listed']).toBe(1);
  });
});

describe('SolverRunner journal wiring (X9)', () => {
  it('journals every decision — quotes AND rejections — when a journal is attached', () => {
    const lines: string[] = [];
    const journal = new DecisionJournal({ sink: (l) => lines.push(l), now: () => 0 });
    const sent: string[] = [];
    let handlers!: TransportHandlers;
    const inventory = new LedgerInventory(REGISTRY);
    inventory.deposit(WNEAR, 1_000n * 10n ** 24n, 'genesis');
    inventory.deposit(USDC, 10_000_000000n, 'genesis');
    const runner = new SolverRunner({
      registry: REGISTRY,
      priceSource,
      baseInventory: inventory,
      riskGuard: new SolverRiskGuard({
        maxQuoteNotionalUsd: FloatLib.toFloat(10_000n, 0n),
        maxDailyLossUsd: FloatLib.toFloat(500n, 0n),
      }),
      solverConfig: {
        signerId: 'sentinel-solver.near',
        halfSpreadBps: 50,
        maxInventorySkewBps: 100,
        quoteValidityMs: 60_000,
        maxDeadlineMs: 120_000,
        minNotionalUsd: FloatLib.toFloat(10n, 0n),
      },
      relay: {
        url: 'wss://fake',
        transportFactory: (_u: string, h: TransportHandlers): Transport => {
          handlers = h;
          return { send: (d: string) => sent.push(d), close: () => {} };
        },
        reconnectMinMs: 1000,
        reconnectMaxMs: 8000,
      },
      journal,
      now: () => Date.parse('2026-07-20T12:00:00.000Z'),
    });
    runner.start();
    handlers.onOpen();
    handlers.onMessage(quoteFrame('q-tape-1')); // will quote (dry-run)
    handlers.onMessage(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'subscribe',
        params: {
          subscription: 's',
          quote_id: 'q-tape-2',
          defuse_asset_identifier_in: 'nep141:unlisted.near',
          defuse_asset_identifier_out: WNEAR,
          exact_amount_in: '100000000',
          min_deadline_ms: 60000,
        },
      })
    ); // will reject
    const entries = lines.map((l) => JSON.parse(l));
    expect(entries).toHaveLength(2);
    expect(entries[0].decision.shouldQuote).toBe(true);
    expect(entries[1].decision.shouldQuote).toBe(false);
    expect(entries[1].decision.reason).toBe('asset_not_listed');
  });
});

describe('realizedEdgeUsd', () => {
  it('computes the USD edge captured on a fill', () => {
    // received 100 USDC ($100), paid 199 wNEAR ($99.50) -> edge $0.50
    const edge = realizedEdgeUsd({
      assetIn: USDC,
      amountInRaw: 100_000000n,
      decimalsIn: 6n,
      assetOut: WNEAR,
      amountOutRaw: 199n * 10n ** 24n,
      decimalsOut: 24n,
      usdPrice: priceSource.usdPrice,
    });
    expect(edge).not.toBeNull();
    expect(FloatLib.toNumber(edge!)).toBeCloseTo(0.5, 6);
  });

  it('returns null (fail-closed) when either leg is unpriceable', () => {
    const edge = realizedEdgeUsd({
      assetIn: 'nep141:unknown.near',
      amountInRaw: 1n,
      decimalsIn: 6n,
      assetOut: WNEAR,
      amountOutRaw: 1n,
      decimalsOut: 24n,
      usdPrice: priceSource.usdPrice,
    });
    expect(edge).toBeNull();
  });
});
