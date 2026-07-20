/**
 * OPERATOR STATUS REPORT (X15)
 *
 * The operator is the user; this text block is the product's face.
 * Design rules (product designer, ratified by SRE):
 *  - A tripped kill switch is the FIRST line. Nothing matters more.
 *  - The mode (DRY-RUN vs LIVE) is unmissable and precedes all numbers.
 *  - Amounts are human units, decisions are grouped by reason, and a
 *    bleeding journal is a loud warning, not a footnote.
 */

import * as FloatLib from '@cavalre/floatlib-ts';
import { rawToFloat } from './pricing.js';

export interface StatusReportInput {
  dryRun: boolean;
  uptimeMs: number;
  killSwitch: string | null;
  counters: Record<string, number>;
  inventoryLines: { symbol: string; availableRaw: bigint; decimals: bigint }[];
  activeReservations: number;
  journalDropped: number;
  /** X17: distinguishes "connected but quiet" from "not connected at all". */
  relay?: { framesReceived: number; malformedFrames: number; reconnects: number };
}

export function formatStatusReport(input: StatusReportInput): string {
  const lines: string[] = [];

  if (input.killSwitch !== null) {
    lines.push(`⛔ KILL SWITCH: ${input.killSwitch} — quoting halted, see runbook`);
  }

  const mode = input.dryRun ? 'DRY-RUN (nothing is sent)' : 'LIVE';
  lines.push(`mode: ${mode} | uptime ${formatDuration(input.uptimeMs)} | reservations: ${input.activeReservations}`);

  const inventory = input.inventoryLines
    .map((l) => `${l.symbol} ${formatAmount(l.availableRaw, l.decimals)}`)
    .join(' | ');
  lines.push(`inventory: ${inventory || '(empty)'}`);

  if (input.relay) {
    const r = input.relay;
    const health =
      r.framesReceived === 0
        ? r.reconnects > 0
          ? '⚠ NO FRAMES EVER — connection failing (check API key / network)'
          : '⚠ NO FRAMES YET — connected but nothing received (bus may require API key)'
        : 'receiving';
    lines.push(
      `bus: ${r.framesReceived} frames | ${r.reconnects} reconnects | ${r.malformedFrames} malformed — ${health}`
    );
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
    lines.push(`⚠ JOURNAL: ${input.journalDropped} entries dropped — the tape is bleeding, fix the sink`);
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
