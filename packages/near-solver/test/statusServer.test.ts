/**
 * Status server + dashboard + journal sinks contract tests.
 */

import { describe, it, expect } from 'vitest';
import { createStatusServer, buildStatusJson } from '../src/statusServer.js';
import type { StatusReportInput } from '../src/status.js';
import { ringSink, teeSink } from '../src/sinks.js';

function sampleSnapshot(): StatusReportInput {
  return {
    dryRun: true,
    uptimeMs: 12_000,
    killSwitch: null,
    counters: { 'quote_decision:would_quote_dry_run': 1 },
    inventoryLines: [{ symbol: 'USDC', availableRaw: 1_000_000n, decimals: 6n }],
    activeReservations: 0,
    journalDropped: 0,
    relay: { framesReceived: 0, malformedFrames: 0, reconnects: 0 },
  };
}

describe('ringSink', () => {
  it('keeps last N lines', () => {
    const ring = ringSink(2);
    ring.sink('a');
    ring.sink('b');
    ring.sink('c');
    expect(ring.entries()).toEqual(['b', 'c']);
  });

  it('empty recent is empty array', () => {
    expect(ringSink(3).entries()).toEqual([]);
  });
});

describe('teeSink', () => {
  it('fans out to both sinks', () => {
    const a: string[] = [];
    const b: string[] = [];
    const tee = teeSink(
      (l) => a.push(l),
      (l) => b.push(l)
    );
    tee('x');
    expect(a).toEqual(['x']);
    expect(b).toEqual(['x']);
  });

  it('continues if one sink throws', () => {
    const ok: string[] = [];
    const tee = teeSink(
      () => {
        throw new Error('boom');
      },
      (l) => ok.push(l)
    );
    expect(() => tee('y')).not.toThrow();
    expect(ok).toEqual(['y']);
  });
});

describe('buildStatusJson', () => {
  it('exposes mode dry-run and exact raw inventory strings', () => {
    const json = JSON.parse(buildStatusJson(sampleSnapshot()));
    expect(json.mode).toBe('dry-run');
    expect(json.inventory[0].availableRaw).toBe('1000000');
  });

  it('exposes live mode when dryRun false', () => {
    const s = sampleSnapshot();
    s.dryRun = false;
    expect(JSON.parse(buildStatusJson(s)).mode).toBe('live');
  });
});

describe('createStatusServer', () => {
  it('serves /api/status as JSON', async () => {
    const server = await createStatusServer({
      port: 0,
      snapshot: sampleSnapshot,
      recentJournal: () => [],
    });
    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/api/status`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.mode).toBe('dry-run');
    } finally {
      await server.close();
    }
  });

  it('serves /api/journal/recent as a JSON array of entries', async () => {
    const server = await createStatusServer({
      port: 0,
      snapshot: sampleSnapshot,
      recentJournal: () => ['{"type":"x"}'],
    });
    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/api/journal/recent`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body[0].type).toBe('x');
    } finally {
      await server.close();
    }
  });

  it('serves the dashboard at / as HTML', async () => {
    const server = await createStatusServer({
      port: 0,
      snapshot: sampleSnapshot,
      recentJournal: () => [],
    });
    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const html = await res.text();
      expect(html).toContain('NEAR SOLVER DESK');
      expect(html).toContain('/api/status');
      expect(html).toContain('three');
    } finally {
      await server.close();
    }
  });

  it('X18: rejects every non-GET method — read-only by construction', async () => {
    const server = await createStatusServer({
      port: 0,
      snapshot: sampleSnapshot,
      recentJournal: () => [],
    });
    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/api/status`, { method: 'POST' });
      expect(res.status).toBe(405);
    } finally {
      await server.close();
    }
  });

  it('unknown paths 404 without leaking anything', async () => {
    const server = await createStatusServer({
      port: 0,
      snapshot: sampleSnapshot,
      recentJournal: () => [],
    });
    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/secret`);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('not found');
    } finally {
      await server.close();
    }
  });
});
