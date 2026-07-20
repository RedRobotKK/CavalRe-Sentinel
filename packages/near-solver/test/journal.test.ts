/**
 * X9 (cross-ref, quant × SRE × AI team): G2's exit criterion is "quant
 * reviews the tape" and the AI team's future models need training data —
 * but the runner only counted decisions, it never recorded them. The
 * DecisionJournal is the tape: append-only, versioned JSONL, every quote
 * decision (including rejections — those are data too), every inferred
 * fill, every reconcile.
 *
 * Design constraints:
 *  - bigint-safe: amounts serialize as decimal strings, round-trippable
 *  - injectable sink (tests: memory; prod: file/stream) — journal never
 *    throws into the trading path; a broken sink must not stop quoting
 *  - offline label derivation: filled = quote_decision joined to
 *    inferred_fill by quoteId; expired-unfilled = the absence, after
 *    deadline + grace. No runtime labeling needed.
 */
import { describe, it, expect } from 'vitest';
import { DecisionJournal, JOURNAL_SCHEMA_VERSION } from '../src/journal';
import type { QuoteRequestEvent } from '../src/codec';
import type { QuoteDecision } from '../src/solver';
import type { ReconcileReport } from '../src/reconciler';

const USDC = 'nep141:usdc.near';
const WNEAR = 'nep141:wrap.near';

const EVENT: QuoteRequestEvent = {
  quoteId: 'q-j1',
  assetIn: USDC,
  assetOut: WNEAR,
  exactAmountIn: 100_000000n,
  minDeadlineMs: 60_000,
};

const QUOTED: QuoteDecision = {
  shouldQuote: true,
  quoteId: 'q-j1',
  assetIn: USDC,
  assetOut: WNEAR,
  amountInRaw: 100_000000n,
  amountOutRaw: 198_900000000000000000000000n,
  totalSpreadBps: 55,
  deadlineIso: '2026-07-20T12:01:00.000Z',
};

const REJECTED: QuoteDecision = { shouldQuote: false, quoteId: 'q-j2', reason: 'no_price' };

function makeJournal() {
  const lines: string[] = [];
  const journal = new DecisionJournal({
    sink: (line) => lines.push(line),
    now: () => 1_753_012_800_000,
  });
  return { journal, lines };
}

describe('DecisionJournal', () => {
  it('records quoted decisions as versioned, parseable JSONL with string amounts', () => {
    const { journal, lines } = makeJournal();
    journal.recordDecision(EVENT, QUOTED);
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]!);
    expect(entry.v).toBe(JOURNAL_SCHEMA_VERSION);
    expect(entry.type).toBe('quote_decision');
    expect(entry.tMs).toBe(1_753_012_800_000);
    expect(entry.event.exactAmountIn).toBe('100000000'); // string, not number
    expect(entry.decision.amountOutRaw).toBe('198900000000000000000000000');
    expect(entry.decision.totalSpreadBps).toBe(55);
    expect(entry.decision.shouldQuote).toBe(true);
  });

  it('records rejections too — refused quotes are training data', () => {
    const { journal, lines } = makeJournal();
    journal.recordDecision(EVENT, REJECTED);
    const entry = JSON.parse(lines[0]!);
    expect(entry.decision.shouldQuote).toBe(false);
    expect(entry.decision.reason).toBe('no_price');
  });

  it('records reconcile reports with inferred fills (the label source)', () => {
    const { journal, lines } = makeJournal();
    const report: ReconcileReport = {
      status: 'ok',
      drifts: [],
      inferredFills: [{ quoteId: 'q-j1', txHash: 'inferred:q-j1' }],
      pnlUsd: null,
    };
    journal.recordReconcile(report);
    const entries = lines.map((l) => JSON.parse(l));
    // one reconcile entry + one inferred_fill entry per fill (join key: quoteId)
    expect(entries.map((e) => e.type)).toEqual(['inferred_fill', 'reconcile']);
    expect(entries[0].quoteId).toBe('q-j1');
    expect(entries[1].status).toBe('ok');
  });

  it('round-trips: journaled amounts reconstruct the original bigints exactly', () => {
    const { journal, lines } = makeJournal();
    journal.recordDecision(EVENT, QUOTED);
    const entry = JSON.parse(lines[0]!);
    expect(BigInt(entry.decision.amountOutRaw)).toBe(
      QUOTED.shouldQuote ? QUOTED.amountOutRaw : 0n
    );
    expect(BigInt(entry.event.exactAmountIn)).toBe(100_000000n);
  });

  it('a throwing sink NEVER propagates into the trading path', () => {
    const journal = new DecisionJournal({
      sink: () => {
        throw new Error('disk full');
      },
      now: () => 0,
    });
    expect(() => journal.recordDecision(EVENT, QUOTED)).not.toThrow();
    expect(journal.droppedEntries).toBe(1); // but the loss is observable
  });
});
