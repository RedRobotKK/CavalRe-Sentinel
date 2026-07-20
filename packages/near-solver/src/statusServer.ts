/**
 * STATUS SERVER — the read-only data spine of the web presentation layer.
 *
 * X18 (security): binds 127.0.0.1 ONLY and answers GET ONLY. There is no
 * mutating endpoint; there is no auth because there is nothing to protect
 * beyond read access on localhost. Exposing this beyond localhost requires
 * a reverse proxy with auth and a fresh security review.
 *
 * Data contract (agreed across teams):
 *  - /api/status          summary snapshot; amounts as EXACT raw strings
 *                         (quant rule: the API never rounds, the UI formats)
 *  - /api/journal/recent  last N journal lines, parsed client-side
 *  - /                    the dashboard (single embedded file, no build step)
 */

import { createServer } from 'node:http';
import type { StatusReportInput } from './status.js';
import { DASHBOARD_HTML } from './dashboardHtml.js';

const HOST = '127.0.0.1'; // X18: localhost only, not configurable by design

export interface StatusServerOptions {
  port: number; // 0 = ephemeral (tests)
  snapshot: () => StatusReportInput;
  recentJournal: () => string[];
}

export interface StatusServerHandle {
  port: number;
  close: () => Promise<void>;
}

export function buildStatusJson(s: StatusReportInput): string {
  return JSON.stringify({
    mode: s.dryRun ? 'dry-run' : 'live',
    uptimeMs: s.uptimeMs,
    killSwitch: s.killSwitch,
    counters: s.counters,
    inventory: s.inventoryLines.map((l) => ({
      symbol: l.symbol,
      availableRaw: l.availableRaw.toString(), // exact — never rounded here
      decimals: Number(l.decimals),
    })),
    activeReservations: s.activeReservations,
    journalDropped: s.journalDropped,
    relay: s.relay ?? null,
  });
}

export function createStatusServer(opts: StatusServerOptions): Promise<StatusServerHandle> {
  const server = createServer((req, res) => {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'content-type': 'text/plain' }).end('read-only');
      return;
    }
    switch (req.url) {
      case '/':
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(DASHBOARD_HTML);
        return;
      case '/api/status':
        res
          .writeHead(200, { 'content-type': 'application/json' })
          .end(buildStatusJson(opts.snapshot()));
        return;
      case '/api/journal/recent':
        res
          .writeHead(200, { 'content-type': 'application/json' })
          .end(`[${opts.recentJournal().join(',')}]`);
        return;
      default:
        res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port, HOST, () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : opts.port;
      resolve({
        port,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}
