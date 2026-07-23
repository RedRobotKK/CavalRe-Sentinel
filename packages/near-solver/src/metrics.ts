/**
 * Prometheus text exposition for the status snapshot.
 *
 * Systematic ops export so Grafana/Prometheus can judge benefit from real
 * series — not a second source of truth for trading decisions.
 *
 * Rules:
 *  - Counters are monotonic (runner counters).
 *  - Gauges are instantaneous (uptime, reservations, kill, relay).
 *  - Inventory is exported as gauge of *human* units for charts only;
 *    exact raw remains on /api/status. Label by symbol.
 *  - Decision reasons become counter labels (sanitized).
 */

import type { StatusReportInput } from './status.js';

function sanitizeLabel(value: string): string {
  return value.replace(/[^a-zA-Z0-9_:]/g, '_').slice(0, 120);
}

function escLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

/**
 * Build Prometheus 0.0.4 text format body.
 */
export function buildPrometheusText(s: StatusReportInput): string {
  const lines: string[] = [];
  const help = (name: string, text: string) => {
    lines.push(`# HELP ${name} ${text}`);
    lines.push(`# TYPE ${name} gauge`);
  };
  const helpCounter = (name: string, text: string) => {
    lines.push(`# HELP ${name} ${text}`);
    lines.push(`# TYPE ${name} counter`);
  };

  help('cavalre_solver_up', '1 if status endpoint is serving');
  lines.push('cavalre_solver_up 1');

  help('cavalre_solver_dry_run', '1 if dry-run mode');
  lines.push(`cavalre_solver_dry_run ${s.dryRun ? 1 : 0}`);

  help('cavalre_solver_uptime_seconds', 'Process uptime seconds');
  lines.push(`cavalre_solver_uptime_seconds ${(s.uptimeMs / 1000).toFixed(3)}`);

  help('cavalre_solver_kill_switch', '1 if kill switch engaged');
  lines.push(`cavalre_solver_kill_switch ${s.killSwitch ? 1 : 0}`);
  if (s.killSwitch) {
    lines.push(
      `cavalre_solver_kill_switch_info{reason="${escLabel(sanitizeLabel(s.killSwitch))}"} 1`
    );
  }

  help('cavalre_solver_active_reservations', 'Open inventory reservations');
  lines.push(`cavalre_solver_active_reservations ${s.activeReservations}`);

  help('cavalre_solver_journal_dropped', 'Journal lines dropped by sink failure');
  lines.push(`cavalre_solver_journal_dropped ${s.journalDropped}`);

  const relay = s.relay ?? { framesReceived: 0, malformedFrames: 0, reconnects: 0 };
  helpCounter('cavalre_solver_relay_frames_total', 'Relay frames received');
  lines.push(`cavalre_solver_relay_frames_total ${relay.framesReceived}`);
  helpCounter('cavalre_solver_relay_malformed_total', 'Malformed relay frames');
  lines.push(`cavalre_solver_relay_malformed_total ${relay.malformedFrames}`);
  helpCounter('cavalre_solver_relay_reconnects_total', 'Relay reconnects');
  lines.push(`cavalre_solver_relay_reconnects_total ${relay.reconnects}`);

  helpCounter('cavalre_solver_decisions_total', 'Quote decisions by outcome key');
  for (const [key, value] of Object.entries(s.counters)) {
    const reason = key.startsWith('quote_decision:')
      ? key.slice('quote_decision:'.length)
      : key;
    lines.push(
      `cavalre_solver_decisions_total{reason="${escLabel(sanitizeLabel(reason))}"} ${value}`
    );
  }

  help(
    'cavalre_solver_inventory_available',
    'Available inventory in whole-token units (UI only; exact raw on /api/status)'
  );
  for (const line of s.inventoryLines) {
    const dec = Number(line.decimals);
    const whole =
      dec >= 0 ? Number(line.availableRaw) / 10 ** dec : Number(line.availableRaw);
    if (!Number.isFinite(whole)) continue;
    lines.push(
      `cavalre_solver_inventory_available{symbol="${escLabel(line.symbol)}"} ${whole}`
    );
  }

  lines.push('');
  return lines.join('\n');
}
