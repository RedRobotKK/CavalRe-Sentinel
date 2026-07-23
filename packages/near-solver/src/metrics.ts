/**
 * Prometheus text exposition for the status snapshot.
 */

import type { StatusReportInput } from './status.js';

function sanitizeLabel(value: string): string {
  return value.replace(/[^a-zA-Z0-9_:]/g, '_').slice(0, 120);
}

function escLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

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

  // Intent register lifecycle (gauges)
  if (s.register) {
    help(
      'cavalre_solver_register_intents',
      'IntentRegister rows by lifecycle state'
    );
    for (const [state, n] of Object.entries(s.register.counts)) {
      if (n === undefined) continue;
      lines.push(
        `cavalre_solver_register_intents{state="${escLabel(sanitizeLabel(state))}"} ${n}`
      );
    }
    help('cavalre_solver_outbox_pending', 'Transactional outbox rows pending publish');
    lines.push(`cavalre_solver_outbox_pending ${s.register.outboxPending}`);
  }

  const relay = s.relay ?? { framesReceived: 0, malformedFrames: 0, reconnects: 0 };
  const auth = relay.auth ?? 'none';
  help('cavalre_solver_relay_auth_bearer', '1 if PARTNER_JWT configured (not proof of frames)');
  lines.push(`cavalre_solver_relay_auth_bearer ${auth === 'bearer' ? 1 : 0}`);

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
