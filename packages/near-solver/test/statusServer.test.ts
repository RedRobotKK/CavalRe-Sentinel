/**
 * WEB PRESENTATION LAYER — data contract agreed across all teams.
 *
 *  X18 (security): v1 is READ-ONLY and binds 127.0.0.1 only. No mutating
 *      endpoint exists; POST/PUT/DELETE are rejected outright.
 *  Designer: the UI reads two endpoints — /api/status (summary) and
 *      /api/journal/recent (the decision stream). Amounts stay exact
 *      strings end-to-end; the UI formats, the API never rounds (quant).
 *  SRE: bus health with the X17 verdict is part of the status payload.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { ringSink, teeSink } from '../src/sinks';
import { buildStatusJson, createStatusServer, type StatusServerHandle } from '../src/statusServer';

// ---------------------------------------------------------------------------
// ring + tee sinks
// ---------------------------------------------------------------------------

describe('ringSink', () => {
  it('keeps only the most recent N entries, newest last', () => {
    const ring = ringSink(3);
    for (const n of [1, 2, 3, 4, 5]) ring.sink(`{"n":${n}}`);
    expect(ring.entries().map((e) => JSON.parse(e).n)).toEqual([3, 4, 5]);
  });

  it('starts empty', () => {
    expect(ringSink(10).entries()).toEqual([]);
  });
});

describe('teeSink', () => {
  it('forwards each line to every sink', () => {
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

  it('one failing sink does not starve the others', () => {
    const b: string[] = [];
    const tee = teeSink(
      () => {
        throw new Error('disk full');
      },
      (l) => b.push(l)
    );
    expect(() => tee('x')).not.toThrow();
    expect(b).toEqual(['x']);
  });
});

// ---------------------------------------------------------------------------
// status payload
// ---------------------------------------------------------------------------

const SNAPSHOT = {
  dryRun: true,
  uptimeMs: 61_000,
  killSwitch: null as string | null,
  counters: { 'quote_decision:no_price': 3 },
  inventoryLines: [{ symbol: 'USDC', availableRaw: 1_000_000000n, decimals: 6n }],
  activeReservations: 1,
  journalDropped: 0,
  relay: { framesReceived: 10, malformedFrames: 0, reconnects: 1 },
};

describe('buildStatusJson', () => {
  it('serializes the snapshot with amounts as EXACT strings (quant rule)', () => {
    const json = JSON.parse(buildStatusJson(SNAPSHOT));
    expect(json.mode).toBe('dry-run');
    expect(json.killSwitch).toBeNull();
    expect(json.inventory[0]).toEqual({
      symbol: 'USDC',
      availableRaw: '1000000000', // exact string, UI formats
      decimals: 6,
    });
    expect(json.relay.framesReceived).toBe(10);
    expect(json.counters['quote_decision:no_price']).toBe(3);
  });

  it('surfaces a tripped kill switch as the top-level alarm', () => {
    const json = JSON.parse(buildStatusJson({ ...SNAPSHOT, killSwitch: 'daily_loss' }));
    expect(json.killSwitch).toBe('daily_loss');
  });
});

// ---------------------------------------------------------------------------
// HTTP server (real socket, ephemeral port)
// ---------------------------------------------------------------------------

describe('createStatusServer', () => {
  let handle: StatusServerHandle | null = null;
  afterEach(async () => {
    await handle?.close();
    handle = null;
  });

  async function start() {
    const ring = ringSink(10);
    ring.sink('{"v":1,"type":"quote_decision"}');
    handle = await createStatusServer({
      port: 0, // ephemeral
      snapshot: () => SNAPSHOT,
      recentJournal: () => ring.entries(),
    });
    return `http://127.0.0.1:${handle.port}`;
  }

  it('serves /api/status as JSON', async () => {
    const base = await start();
    const res = await fetch(`${base}/api/status`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body.mode).toBe('dry-run');
  });

  it('serves /api/journal/recent as a JSON array of entries', async () => {
    const base = await start();
    const body = await (await fetch(`${base}/api/journal/recent`)).json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].type).toBe('quote_decision');
  });

  it('serves the dashboard at / as HTML', async () => {
    const base = await start();
    const res = await fetch(`${base}/`);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('Sentinel');
    expect(html).toContain('/api/status'); // the UI polls the real endpoints
  });

  it('X18: rejects every non-GET method — read-only by construction', async () => {
    const base = await start();
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const res = await fetch(`${base}/api/status`, { method });
      expect(res.status).toBe(405);
    }
  });

  it('unknown paths 404 without leaking anything', async () => {
    const base = await start();
    expect((await fetch(`${base}/etc/passwd`)).status).toBe(404);
  });
});
