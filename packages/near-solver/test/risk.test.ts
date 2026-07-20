import { describe, it, expect } from 'vitest';
import * as FloatLib from '@cavalre/floatlib-ts';
import { SolverRiskGuard } from '../src/risk';

const usd = (n: bigint) => FloatLib.toFloat(n, 0n);

function makeGuard(overrides: Partial<ConstructorParameters<typeof SolverRiskGuard>[0]> = {}) {
  return new SolverRiskGuard({
    maxQuoteNotionalUsd: usd(10_000n),
    maxDailyLossUsd: usd(500n),
    ...overrides,
  });
}

describe('SolverRiskGuard', () => {
  it('allows a quote within limits', () => {
    const guard = makeGuard();
    const verdict = guard.checkQuote({ notionalUsd: usd(1_000n) });
    expect(verdict.allowed).toBe(true);
  });

  it('rejects a quote above max notional', () => {
    const guard = makeGuard();
    const verdict = guard.checkQuote({ notionalUsd: usd(10_001n) });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe('notional_exceeds_max');
  });

  it('allows exactly at max notional (limit is inclusive)', () => {
    const guard = makeGuard();
    expect(guard.checkQuote({ notionalUsd: usd(10_000n) }).allowed).toBe(true);
  });

  it('fail-closed: rejects when notional is unknown', () => {
    const guard = makeGuard();
    const verdict = guard.checkQuote({ notionalUsd: null });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe('unpriceable_notional');
  });

  it('kill switch blocks everything until cleared', () => {
    const guard = makeGuard();
    guard.tripKillSwitch('manual_halt');
    expect(guard.checkQuote({ notionalUsd: usd(1n) }).allowed).toBe(false);
    expect(guard.checkQuote({ notionalUsd: usd(1n) }).reason).toBe('kill_switch:manual_halt');
    guard.clearKillSwitch();
    expect(guard.checkQuote({ notionalUsd: usd(1n) }).allowed).toBe(true);
  });

  it('accumulated daily loss trips the guard', () => {
    const guard = makeGuard();
    guard.recordRealizedPnlUsd(FloatLib.minus(usd(300n))); // -300
    expect(guard.checkQuote({ notionalUsd: usd(100n) }).allowed).toBe(true);
    guard.recordRealizedPnlUsd(FloatLib.minus(usd(300n))); // -600 total
    const verdict = guard.checkQuote({ notionalUsd: usd(100n) });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe('daily_loss_exceeded');
  });

  it('profits offset losses in the daily tally', () => {
    const guard = makeGuard();
    guard.recordRealizedPnlUsd(FloatLib.minus(usd(600n))); // -600: tripped
    guard.recordRealizedPnlUsd(usd(200n)); // net -400: back under
    expect(guard.checkQuote({ notionalUsd: usd(100n) }).allowed).toBe(true);
  });

  it('resetDay clears the loss tally but NOT the kill switch', () => {
    const guard = makeGuard();
    guard.recordRealizedPnlUsd(FloatLib.minus(usd(999n)));
    guard.tripKillSwitch('drawdown');
    guard.resetDay();
    const verdict = guard.checkQuote({ notionalUsd: usd(1n) });
    expect(verdict.allowed).toBe(false); // kill switch requires explicit human clear
    expect(verdict.reason).toBe('kill_switch:drawdown');
  });
});
