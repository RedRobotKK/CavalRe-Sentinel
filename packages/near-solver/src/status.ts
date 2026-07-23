/**
 * OPERATOR STATUS REPORT (X15)
 */

import * as FloatLib from '@cavalre/floatlib-ts';
import { rawToFloat } from './pricing.js';
import type { IntentState } from './intentRegister.js';

export interface StatusReportInput {
  dryRun: boolean;
  uptimeMs: number;
  killSwitch: string | null;
  counters: Record<string, number>;
  inventoryLines: { symbol: string; availableRaw: bigint; decimals: bigint }[];
  activeReservations: number;
  journalDropped: number;
  relay?: {
    framesReceived: number;
    malformedFrames: number;
    reconnects: number;
    auth?: 'none' | 'bearer';
  };
  risk?: { killSwitch: string | null; dailyPnlUsd: number };
  /** IntentRegister lifecycle histogram (optional). */
  register?: {
    counts: Partial<Record<IntentState, number>>;
    outboxPending: number;
  };
}

export function formatStatusReport(input: StatusReportInput): string {
  const lines: string[] = [];

  if (input.killSwitch !== null) {
    lines.push(`⛔ KILL SWITCH: ${input.killSwitch} — quoting halted, see runbook`);
  }

  const mode = input.dryRun ? 'DRY-RUN (nothing is sent)' : 'LIVE';
  lines.push(
    `mode: ${mode} | uptime ${formatDuration(input.uptimeMs)} | reservations: ${input.activeReservations}`
  );

  const inventory = input.inventoryLines
    .map((l) => `${l.symbol} ${formatAmount(l.availableRaw, l.decimals)}`)
    .join(' | ');
  lines.push(`inventory: ${inventory || '(empty)'}`);

  if (input.relay) {
    const r = input.relay;
    const auth = r.auth ?? 'none';
    let health: string;
    if (auth === 'none') {
      health = 'WAITING ON PARTNER_JWT — portal/KYC external gate; cover ≠ bus';
    } else if (r.framesReceived === 0) {
      health =
        r.reconnects > 0
          ? '⚠ auth set but NO FRAMES — check JWT validity / network'
          : 'auth set · waiting for first quote frame';
    } else {
      health = 'receiving residual';
    }
    lines.push(
      `bus: ${r.framesReceived} frames | auth=${auth} | ${r.reconnects} reconnects | ${r.malformedFrames} malformed — ${health}`
    );
  }

  if (input.register) {
    const c = input.register.counts;
    lines.push(
      `register: reserved=${c.reserved ?? 0} sent=${c.sent ?? 0} settled=${c.settled ?? 0} reject=${c.decided_reject ?? 0} expired=${c.expired ?? 0} | outbox_pending=${input.register.outboxPending}`
    );
  }

  if (input.risk) {
    lines.push(`pnl_day_usd: ${input.risk.dailyPnlUsd.toFixed(4)} (settlement-attributed only)`);
  }

  const counterKeys = Object.keys(input.counters).sort();
  if (counterKeys.length > 0) {
    lines.push('decisions:');
    for (const key of counterKeys) {
      const reason = key.replace(/^quote_decision:/, '');
      lines.push(`  ${reason.padEnd(28)} ${input.counters[key]}`);
    }
  } else {
    lines.push('decisions: none yet');
  }

  if (input.journalDropped > 0) {
    lines.push(
      `⚠ JOURNAL: ${input.journalDropped} entries dropped — the tape is bleeding, fix the sink`
    );
  }

  return lines.join('\n');
}

function formatAmount(raw: bigint, decimals: bigint): string {
  if (raw === 0n) return '0';
  return FloatLib.toNumber(rawToFloat(raw, decimals)).toFixed(2);
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}
