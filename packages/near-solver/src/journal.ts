/**
 * DECISION JOURNAL — the tape (X9)
 *
 * Append-only record of everything the solver decides and observes:
 * quote decisions (including rejections), inferred fills, reconciles.
 * G2's human review reads it; the AI team's future models train on it.
 *
 * Rules:
 *  - The journal never throws into the trading path. A broken sink drops
 *    the entry and increments droppedEntries — observable, never fatal.
 *  - Amounts serialize as decimal strings (bigint-exact round-trip).
 *  - Labels are derived OFFLINE by joining quote_decision to inferred_fill
 *    on quoteId: joined = filled (won the auction); unjoined past
 *    deadline + grace = not filled. No runtime labeling.
 */

import type { QuoteRequestEvent } from './codec';
import type { QuoteDecision } from './solver';
import type { ReconcileReport } from './reconciler';

export const JOURNAL_SCHEMA_VERSION = 1;

export type JournalSink = (line: string) => void;

export interface DecisionJournalOptions {
  sink: JournalSink;
  now?: () => number;
}

export class DecisionJournal {
  /** Entries lost to sink failures. Nonzero = fix your sink, data is bleeding. */
  droppedEntries = 0;

  private readonly now: () => number;

  constructor(private readonly opts: DecisionJournalOptions) {
    this.now = opts.now ?? Date.now;
  }

  recordDecision(event: QuoteRequestEvent, decision: QuoteDecision): void {
    this.write({
      v: JOURNAL_SCHEMA_VERSION,
      type: 'quote_decision',
      tMs: this.now(),
      event: {
        quoteId: event.quoteId,
        assetIn: event.assetIn,
        assetOut: event.assetOut,
        exactAmountIn: event.exactAmountIn?.toString(),
        exactAmountOut: event.exactAmountOut?.toString(),
        minDeadlineMs: event.minDeadlineMs,
      },
      decision: decision.shouldQuote
        ? {
            shouldQuote: true,
            quoteId: decision.quoteId,
            assetIn: decision.assetIn,
            assetOut: decision.assetOut,
            amountInRaw: decision.amountInRaw.toString(),
            amountOutRaw: decision.amountOutRaw.toString(),
            totalSpreadBps: decision.totalSpreadBps,
            deadlineIso: decision.deadlineIso,
          }
        : {
            shouldQuote: false,
            quoteId: decision.quoteId,
            reason: decision.reason,
          },
    });
  }

  recordReconcile(report: ReconcileReport): void {
    // Fills first: they are the labels, and each gets its own joinable row.
    for (const fill of report.inferredFills) {
      this.write({
        v: JOURNAL_SCHEMA_VERSION,
        type: 'inferred_fill',
        tMs: this.now(),
        quoteId: fill.quoteId,
        txHash: fill.txHash,
      });
    }
    this.write({
      v: JOURNAL_SCHEMA_VERSION,
      type: 'reconcile',
      tMs: this.now(),
      status: report.status,
      driftCount: report.drifts.filter((d) => d.driftRaw !== 0n).length,
      pnlUsd: report.pnlUsd === null ? null : String(report.pnlUsd.mantissa) + 'e' + String(report.pnlUsd.exponent),
      inferredFillCount: report.inferredFills.length,
    });
  }

  private write(entry: Record<string, unknown>): void {
    try {
      this.opts.sink(JSON.stringify(entry));
    } catch {
      this.droppedEntries += 1; // never throw into the trading path
    }
  }
}
