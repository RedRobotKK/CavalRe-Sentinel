#!/usr/bin/env node
/**
 * DRY-RUN ENTRYPOINT — thin shell over assembleSolver() (X13).
 *
 *   npm run solver:dry-run
 *   npm run solver:dry-run -- --sim
 *
 * Env:
 *   JOURNAL_DIR, STATUS_EVERY, DASHBOARD_PORT, DASHBOARD_RECLAIM
 *   SIM_INTERVAL_MS  (default 3000) when --sim
 *   SIM_SEED         (default 42)
 */

import { assembleSolver } from '../app.js';
import { MAINNET_REGISTRY, USDC_NEAR, WNEAR, USDT_NEAR, MAINNET } from '../mainnetConfig.js';
import { dailyFileSink, ringSink, teeSink } from '../sinks.js';
import { createStatusServer } from '../statusServer.js';
import { reclaimListenPort } from './reclaimPort.js';
import { createIntentSimulator, DEFAULT_AVERAGES } from '../sim/intentSim.js';
import { MapPriceSource } from '../sim/mapPriceSource.js';
import { SolverPipeline } from '../solver.js';
import { SolverRiskGuard } from '../risk.js';
import * as FloatLib from '@cavalre/floatlib-ts';

const argv = process.argv.slice(2);
const simMode = argv.includes('--sim') || process.env['SIM_INTENTS'] === '1';

const PRICE_REFRESH_MS = 2_000;
const JOURNAL_RING_CAPACITY = 500;
const journalDir = process.env['JOURNAL_DIR'] ?? './data/journal';
const statusEveryMs = Number(process.env['STATUS_EVERY'] ?? '30') * 1000;
const dashboardPort = Number(process.env['DASHBOARD_PORT'] ?? '8787');
const simIntervalMs = Number(process.env['SIM_INTERVAL_MS'] ?? '3000');
const simSeed = Number(process.env['SIM_SEED'] ?? '42');

reclaimListenPort(dashboardPort);

const ring = ringSink(JOURNAL_RING_CAPACITY);

const app = assembleSolver({
  registry: MAINNET_REGISTRY,
  dryRun: true,
  minPriceSources: 1,
  virtualInventory: new Map([
    [USDC_NEAR, 1_000_000000n],
    [WNEAR, 500n * 10n ** 24n],
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
console.log(`dashboard: http://127.0.0.1:${dashboard.port}  (read-only, localhost only)`);
if (simMode) {
  console.log(`sim:       ON · seed=${simSeed} · every ${simIntervalMs}ms · Tier A (not live edge)\n`);
} else {
  console.log(`sim:       off · pass --sim to inject market-average intents\n`);
}

app.runner.start();
const priceLoop = setInterval(() => void app.refreshPrices(), PRICE_REFRESH_MS);
const statusLoop = setInterval(() => console.log(app.statusReport() + '\n'), statusEveryMs);

let simLoop: ReturnType<typeof setInterval> | undefined;

if (simMode) {
  // Dedicated MapPriceSource + pipeline path shares journal + inventory + risk
  // via injectQuoteRequest on the live runner. Mids come from sim averages+noise;
  // OneClick refresh still runs for observability but sim decides against Map mids
  // by temporarily using inject with prices set on a side pipeline that uses
  // the SAME inventory/risk/journal through runner.injectQuoteRequest.
  //
  // injectQuoteRequest uses the runner's assembled OneClick/stale stack — which
  // may no_price if oracle is cold. So we also warm Map prices into a parallel
  // pipeline only when we need guaranteed sim quotes. Prefer: inject after
  // setting prices if we can swap source — runner priceSource is fixed.
  //
  // Practical approach: call pipeline.decide with MapPriceSource and mirror
  // journal+reserve via public inject only works with runner's source.
  // Fix: build a local decide path that journals through app.journal and
  // reserves on app.runner.inventory — same objects.

  const mapPx = new MapPriceSource();
  mapPx.setMids(DEFAULT_AVERAGES.midsUsd);
  const g3 = MAINNET.g3Defaults;
  const simPipeline = new SolverPipeline({
    registry: MAINNET_REGISTRY,
    priceSource: mapPx,
    inventory: app.runner.inventory,
    riskGuard: app.riskGuard,
    config: {
      signerId: 'dry-run.sim',
      halfSpreadBps: g3.halfSpreadBps,
      maxInventorySkewBps: g3.maxInventorySkewBps,
      quoteValidityMs: g3.quoteValidityMs,
      maxDeadlineMs: g3.maxDeadlineMs,
      minNotionalUsd: g3.minNotionalUsd,
    },
    now: Date.now,
  });

  const sim = createIntentSimulator({
    seed: simSeed,
    averages: DEFAULT_AVERAGES,
    midNoiseSigma: 0.015,
    minNotionalUsd: 10,
    maxNotionalUsd: 80,
    minDeadlineMs: 60_000,
  });

  const tickSim = () => {
    const tick = sim.next();
    mapPx.setMids(tick.midsUsd);
    const decision = simPipeline.decide(tick.request);
    app.journal.recordDecision(tick.request, decision);
    if (!decision.shouldQuote) {
      app.runner.metrics.counters[`quote_decision:${decision.reason}`] =
        (app.runner.metrics.counters[`quote_decision:${decision.reason}`] ?? 0) + 1;
      return;
    }
    const reserved = app.runner.inventory.reserve(
      decision.quoteId,
      decision.assetOut,
      decision.amountOutRaw,
      Date.parse(decision.deadlineIso)
    );
    if (!reserved) {
      app.runner.metrics.counters['quote_decision:reservation_conflict'] =
        (app.runner.metrics.counters['quote_decision:reservation_conflict'] ?? 0) + 1;
      return;
    }
    app.runner.metrics.counters['quote_decision:would_quote_dry_run'] =
      (app.runner.metrics.counters['quote_decision:would_quote_dry_run'] ?? 0) + 1;
  };

  tickSim();
  simLoop = setInterval(tickSim, simIntervalMs);
}

process.on('SIGINT', () => {
  clearInterval(priceLoop);
  clearInterval(statusLoop);
  if (simLoop) clearInterval(simLoop);
  app.runner.stop();
  void dashboard.close();
  console.log('\nfinal status:\n' + app.statusReport());
  process.exit(0);
});
