/**
 * PM + PRODUCT DESIGNER CROSS-CHECK — deliverability findings as tests.
 */
import { describe, it, expect } from 'vitest';
import { dailyFileSink } from '../src/sinks';
import { formatStatusReport } from '../src/status';
import { assembleSolver } from '../src/app';
import { MAINNET_REGISTRY, USDC_NEAR, WNEAR } from '../src/mainnetConfig';
import type { TransportHandlers, Transport } from '../src/relay';

describe('dailyFileSink', () => {
  function makeSink(startMs: number) {
    const writes: { path: string; line: string }[] = [];
    const clock = { nowMs: startMs };
    const sink = dailyFileSink({
      directory: '/var/journal',
      appendLine: (path, line) => writes.push({ path, line }),
      now: () => clock.nowMs,
    });
    return { sink, writes, clock };
  }

  it('writes JSONL lines into a date-stamped file', () => {
    const { sink, writes } = makeSink(Date.parse('2026-07-20T12:00:00Z'));
    sink('{"a":1}');
    expect(writes[0]).toEqual({
      path: '/var/journal/decisions-2026-07-20.jsonl',
      line: '{"a":1}',
    });
  });

  it('rotates to a new file when the UTC date changes', () => {
    const { sink, writes, clock } = makeSink(Date.parse('2026-07-20T23:59:59Z'));
    sink('{"a":1}');
    clock.nowMs = Date.parse('2026-07-21T00:00:01Z');
    sink('{"a":2}');
    expect(writes[0]!.path).toContain('2026-07-20');
    expect(writes[1]!.path).toContain('2026-07-21');
  });
});

describe('formatStatusReport', () => {
  const baseInput = {
    dryRun: true,
    uptimeMs: 3_723_000,
    killSwitch: null as string | null,
    counters: {
      'quote_decision:would_quote_dry_run': 42,
      'quote_decision:no_price': 3,
      'quote_decision:asset_not_listed': 17,
    },
    inventoryLines: [
      { symbol: 'USDC', availableRaw: 1_000_000000n, decimals: 6n },
      { symbol: 'wNEAR', availableRaw: 500n * 10n ** 24n, decimals: 24n },
    ],
    activeReservations: 2,
    journalDropped: 0,
  };

  it('shows the DRY-RUN banner unmissably when dry-run', () => {
    const report = formatStatusReport(baseInput);
    expect(report).toContain('DRY-RUN');
    expect(report.indexOf('DRY-RUN')).toBeLessThan(report.indexOf('uptime'));
  });

  it('shows LIVE when not dry-run', () => {
    const report = formatStatusReport({ ...baseInput, dryRun: false });
    expect(report).toContain('LIVE');
    expect(report).not.toContain('DRY-RUN');
  });

  it('puts a tripped kill switch on the first line — nothing matters more', () => {
    const report = formatStatusReport({ ...baseInput, killSwitch: 'reconciliation_divergence' });
    const firstLine = report.split('\n')[0]!;
    expect(firstLine).toContain('KILL SWITCH');
    expect(firstLine).toContain('reconciliation_divergence');
  });

  it('renders counters by reason and human inventory amounts', () => {
    const report = formatStatusReport(baseInput);
    expect(report).toContain('would_quote_dry_run');
    expect(report).toContain('42');
    expect(report).toContain('USDC');
    expect(report).toContain('1000');
    expect(report).toContain('reservations: 2');
  });

  it('warns loudly when journal entries are being dropped', () => {
    const report = formatStatusReport({ ...baseInput, journalDropped: 7 });
    expect(report).toMatch(/JOURNAL.*7.*dropped/i);
  });

  it('X17: auth=none zero frames is external JWT gate (not connection theater)', () => {
    const report = formatStatusReport({
      ...baseInput,
      relay: { framesReceived: 0, malformedFrames: 0, reconnects: 5, auth: 'none' },
    });
    expect(report).toMatch(/auth=none/i);
    expect(report).toMatch(/PARTNER_JWT/i);
  });

  it('X17: auth=none zero frames without reconnects still waits on JWT', () => {
    const report = formatStatusReport({
      ...baseInput,
      relay: { framesReceived: 0, malformedFrames: 0, reconnects: 0, auth: 'none' },
    });
    expect(report).toMatch(/WAITING ON PARTNER_JWT/i);
  });

  it('X17: auth=bearer + frames reads as residual', () => {
    const report = formatStatusReport({
      ...baseInput,
      relay: { framesReceived: 1234, malformedFrames: 1, reconnects: 2, auth: 'bearer' },
    });
    expect(report).toContain('1234 frames');
    expect(report).toMatch(/auth=bearer/i);
    expect(report).toMatch(/receiving residual/i);
  });

  it('X17: auth=bearer zero frames after reconnects is JWT/network check', () => {
    const report = formatStatusReport({
      ...baseInput,
      relay: { framesReceived: 0, malformedFrames: 0, reconnects: 3, auth: 'bearer' },
    });
    expect(report).toMatch(/auth set but NO FRAMES/i);
  });
});

function fakeRelayFactory() {
  const transports: { handlers: TransportHandlers; sent: string[] }[] = [];
  const factory = (_url: string, handlers: TransportHandlers): Transport => {
    const t = { handlers, sent: [] as string[] };
    transports.push(t);
    return { send: (d: string) => t.sent.push(d), close: () => {} };
  };
  return { factory, transports };
}

describe('assembleSolver (X13: the one-call composition root)', () => {
  const baseOptions = () => ({
    registry: MAINNET_REGISTRY,
    dryRun: true as boolean,
    minPriceSources: 1,
    virtualInventory: new Map([
      [USDC_NEAR, 1_000_000000n],
      [WNEAR, 500n * 10n ** 24n],
    ]),
    transportFactory: fakeRelayFactory().factory,
    journalSink: () => {},
  });

  it('assembles a dry-run solver with virtual inventory in one call', () => {
    const app = assembleSolver(baseOptions());
    expect(app.runner).toBeDefined();
    expect(app.reconciler).toBeNull();
    expect(app.inventory.availableRaw(USDC_NEAR)).toBe(1_000_000000n);
  });

  it('X14: refuses to assemble LIVE with fewer than 2 price sources', () => {
    expect(() =>
      assembleSolver({ ...baseOptions(), dryRun: false, minPriceSources: 1 })
    ).toThrow(/single-source pricing is dry-run only/i);
  });

  it('refuses LIVE assembly with virtual inventory — pretend money cannot go live', () => {
    expect(() =>
      assembleSolver({ ...baseOptions(), dryRun: false, minPriceSources: 2 })
    ).toThrow(/virtual inventory is dry-run only/i);
  });

  it('statusReport() reflects the assembled state', () => {
    const app = assembleSolver(baseOptions());
    const report = app.statusReport();
    expect(report).toContain('DRY-RUN');
    expect(report).toContain('USDC');
  });
});
