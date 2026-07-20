/**
 * SECURITY REVIEW FINDINGS — each test encodes one finding.
 *
 * S1: BigInt DoS — a hostile relay frame with a multi-megabyte digit string
 *     must be rejected by LENGTH before BigInt() ever parses it. u128 max
 *     supply is 39 digits; anything longer is garbage by definition.
 * S2: Frame-size DoS — the relay must drop oversized frames before JSON.parse.
 * S3: Deadline abuse — min_deadline_ms is TAKER-controlled. Without a cap,
 *     a taker can demand an hours-long price commitment: a free option
 *     against the solver. The pipeline must reject deadlines above its cap.
 */
import { describe, it, expect } from 'vitest';
import * as FloatLib from '@cavalre/floatlib-ts';
import { parseRelayMessage } from '../src/codec';
import { RelayClient, type Transport, type TransportHandlers } from '../src/relay';
import { SolverPipeline } from '../src/solver';
import { SolverRiskGuard } from '../src/risk';

const USDC = 'nep141:usdc.near';
const WNEAR = 'nep141:wrap.near';

function quoteFrame(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    method: 'subscribe',
    params: {
      subscription: 's',
      quote_id: 'q-sec',
      defuse_asset_identifier_in: USDC,
      defuse_asset_identifier_out: WNEAR,
      exact_amount_in: '100000000',
      min_deadline_ms: 60000,
      ...overrides,
    },
  });
}

describe('S1: amount length cap', () => {
  it('rejects amounts longer than 40 digits without parsing them', () => {
    const start = performance.now();
    const msg = parseRelayMessage(quoteFrame({ exact_amount_in: '9'.repeat(5_000_000) }));
    const elapsed = performance.now() - start;
    expect(msg.kind).toBe('malformed');
    expect(elapsed).toBeLessThan(200); // must not have fed 5MB into BigInt
  });

  it('accepts a full u128-scale amount (39 digits)', () => {
    const msg = parseRelayMessage(quoteFrame({ exact_amount_in: '9'.repeat(39) }));
    expect(msg.kind).toBe('quote_request');
  });
});

describe('S2: frame size cap', () => {
  it('drops oversized frames as malformed without dispatching', () => {
    let dispatched = 0;
    let transport!: { handlers: TransportHandlers };
    const client = new RelayClient({
      url: 'wss://fake',
      transportFactory: (_u, handlers) => {
        transport = { handlers };
        return { send: () => {}, close: () => {} } as Transport;
      },
      onQuoteRequest: () => dispatched++,
      onSettlement: () => dispatched++,
      reconnectMinMs: 1000,
      reconnectMaxMs: 8000,
    });
    client.start();
    const huge = quoteFrame({ padding: 'x'.repeat(1_000_000) });
    transport.handlers.onMessage(huge);
    expect(dispatched).toBe(0);
    expect(client.stats.malformedFrames).toBe(1);
  });
});

describe('S3: deadline cap', () => {
  function makePipeline(maxDeadlineMs: number) {
    return new SolverPipeline({
      registry: new Map([
        [USDC, { symbol: 'USDC', decimals: 6n }],
        [WNEAR, { symbol: 'wNEAR', decimals: 24n }],
      ]),
      priceSource: {
        mid: () => FloatLib.toFloat(2n, 0n),
        usdPrice: () => FloatLib.ONE,
      },
      inventory: { availableRaw: () => 10_000n * 10n ** 24n },
      riskGuard: new SolverRiskGuard({
        maxQuoteNotionalUsd: FloatLib.toFloat(10_000n, 0n),
        maxDailyLossUsd: FloatLib.toFloat(500n, 0n),
      }),
      config: {
        signerId: 's.near',
        halfSpreadBps: 50,
        maxInventorySkewBps: 100,
        quoteValidityMs: 60_000,
        maxDeadlineMs,
        minNotionalUsd: FloatLib.toFloat(10n, 0n),
      },
      now: () => 0,
    });
  }

  const event = {
    quoteId: 'q-dl',
    assetIn: USDC,
    assetOut: WNEAR,
    exactAmountIn: 100_000000n,
    minDeadlineMs: 3_600_000, // taker demands a ONE HOUR price commitment
  };

  it('rejects taker deadlines above the cap (free-option defense)', () => {
    const d = makePipeline(120_000).decide(event);
    expect(d.shouldQuote).toBe(false);
    if (d.shouldQuote) throw new Error('unreachable');
    expect(d.reason).toBe('deadline_too_long');
  });

  it('quotes normally when the demanded deadline fits under the cap', () => {
    const d = makePipeline(7_200_000).decide(event);
    expect(d.shouldQuote).toBe(true);
    if (!d.shouldQuote) throw new Error('unreachable');
    expect(Date.parse(d.deadlineIso)).toBe(3_600_000); // honors the min demanded
  });
});
