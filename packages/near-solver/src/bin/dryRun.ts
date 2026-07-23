#!/usr/bin/env node
/**
 * DRY-RUN ENTRYPOINT — the thin shell over assembleSolver() (X13).
 * All logic lives in tested modules; this file only wires clocks and stdout.
 *
 *   npm run solver:dry-run          (from the repo root)
 *
 * Env (all optional):
 *   JOURNAL_DIR         daily JSONL directory          (default ./data/journal)
 *   STATUS_EVERY        status print interval seconds  (default 30)
 *   DASHBOARD_PORT      status UI port                 (default 8787)
 *   DASHBOARD_RECLAIM   kill prior LISTEN on that port (default 1; set 0 to skip)
 */

import { assembleSolver } from '../app.js';
import { MAINNET_REGISTRY, USDC_NEAR, WNEAR, USDT_NEAR, MAINNET } from '../mainnetConfig.js';
import { dailyFileSink, ringSink, teeSink } from '../sinks.js';
import { createStatusServer } from '../statusServer.js';
import { reclaimListenPort } from './reclaimPort.js';

const PRICE_REFRESH_MS = 2_000; // must stay well under g3Defaults.priceMaxAgeMs
const JOURNAL_RING_CAPACITY = 500;
const journalDir = process.env['JOURNAL_DIR'] ?? './data/journal';
const statusEveryMs = Number(process.env['STATUS_EVERY'] ?? '30') * 1000;
const dashboardPort = Number(process.env['DASHBOARD_PORT'] ?? '8787');

// Preflight: avoid EADDRINUSE from a previous dry-run left running.
reclaimListenPort(dashboardPort);

const ring = ringSink(JOURNAL_RING_CAPACITY);

const app = assembleSolver({
  registry: MAINNET_REGISTRY,
  dryRun: true,
  minPriceSources: 1, // X14: single-source is acceptable for observation only
  virtualInventory: new Map([
    [USDC_NEAR, 1_000_000000n], // $1,000 pretend USDC
    [WNEAR, 500n * 10n ** 24n], // 500 pretend wNEAR
    [USDT_NEAR, 1_000_000000n],
  ]),
  journalSink: teeSink(dailyFileSink({ directory: journalDir }), ring.sink),
});

const dashboard = await createStatusServer({
  port: dashboardPort,
  snapshot: () => app.statusSnapshot(),
  recentJournal: () => ring.entries(),
});

console.log(`CavalRe Near Solver — DRY-RUN against ${MAINNET.solverRelayWsUrl}`);
console.log(`journal:   ${journalDir}/decisions-YYYY-MM-DD.jsonl`);
console.log(`dashboard: http://127.0.0.1:${dashboard.port}  (read-only, localhost only)\n`);

app.runner.start();
const priceLoop = setInterval(() => void app.refreshPrices(), PRICE_REFRESH_MS);
const statusLoop = setInterval(() => console.log(app.statusReport() + '\n'), statusEveryMs);

process.on('SIGINT', () => {
  clearInterval(priceLoop);
  clearInterval(statusLoop);
  app.runner.stop();
  void dashboard.close();
  console.log('\nfinal status:\n' + app.statusReport());
  process.exit(0);
});
