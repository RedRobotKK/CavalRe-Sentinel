import { describe, it, expect } from 'vitest';
import { buildPrometheusText } from '../src/metrics.js';
import { createStatusServer } from '../src/statusServer.js';
import type { StatusReportInput } from '../src/status.js';

function sample(): StatusReportInput {
  return {
    dryRun: true,
    uptimeMs: 12_500,
    killSwitch: null,
    counters: {
      'quote_decision:would_quote_dry_run': 3,
      'quote_decision:no_price': 1,
    },
    inventoryLines: [{ symbol: 'USDC', availableRaw: 1_000_000000n, decimals: 6n }],
    activeReservations: 2,
    journalDropped: 0,
    relay: { framesReceived: 10, malformedFrames: 1, reconnects: 0, auth: 'bearer' },
    register: {
      counts: { reserved: 2, sent: 0, settled: 5, decided_reject: 1, expired: 0 },
      outboxPending: 0,
    },
  };
}

describe('buildPrometheusText', () => {
  it('PASS exposes core gauges and decision counters', () => {
    const body = buildPrometheusText(sample());
    expect(body).toContain('cavalre_solver_up 1');
    expect(body).toContain('cavalre_solver_dry_run 1');
    expect(body).toContain('cavalre_solver_uptime_seconds 12.500');
    expect(body).toContain('cavalre_solver_active_reservations 2');
    expect(body).toContain('cavalre_solver_relay_frames_total 10');
    expect(body).toContain('cavalre_solver_relay_auth_bearer 1');
    expect(body).toContain(
      'cavalre_solver_decisions_total{reason="would_quote_dry_run"} 3'
    );
    expect(body).toContain('cavalre_solver_decisions_total{reason="no_price"} 1');
    expect(body).toContain('cavalre_solver_inventory_available{symbol="USDC"}');
    expect(body).toContain('cavalre_solver_register_intents{state="reserved"} 2');
    expect(body).toContain('cavalre_solver_register_intents{state="settled"} 5');
    expect(body).toContain('cavalre_solver_outbox_pending 0');
  });

  it('PASS kill switch gauge and reason label', () => {
    const s = sample();
    s.killSwitch = 'daily_loss';
    const body = buildPrometheusText(s);
    expect(body).toContain('cavalre_solver_kill_switch 1');
    expect(body).toContain('reason="daily_loss"');
  });
});

describe('GET /metrics', () => {
  it('PASS serves prometheus content-type', async () => {
    const server = await createStatusServer({
      port: 0,
      snapshot: sample,
      recentJournal: () => [],
    });
    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/metrics`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/plain');
      const text = await res.text();
      expect(text).toContain('cavalre_solver_up 1');
      expect(text).toContain('cavalre_solver_register_intents');
    } finally {
      await server.close();
    }
  });
});
