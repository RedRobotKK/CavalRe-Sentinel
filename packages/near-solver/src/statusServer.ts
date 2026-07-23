/**
 * STATUS SERVER — read-only data spine.
 *
 * X18: 127.0.0.1 ONLY, GET ONLY.
 *  - /api/status
 *  - /api/journal/recent
 *  - /metrics          Prometheus text (Grafana/Prometheus scrape)
 *  - /
 */

import { createServer } from 'node:http';
import type { StatusReportInput } from './status.js';
import { DASHBOARD_HTML } from './dashboardHtml.js';
import { buildPrometheusText } from './metrics.js';

const HOST = '127.0.0.1';

export interface StatusServerOptions {
  port: number;
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
      availableRaw: l.availableRaw.toString(),
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
      case '/metrics':
        res
          .writeHead(200, {
            'content-type': 'text/plain; version=0.0.4; charset=utf-8',
          })
          .end(buildPrometheusText(opts.snapshot()));
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
