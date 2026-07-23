#!/usr/bin/env node
/**
 * DRY-RUN ENTRYPOINT
 *
 *   npm run solver:dry-run
 *   npm run solver:dry-run -- --sim
 *   npm run solver:dry-run -- --sim --cover
 *
 * Env: PARTNER_JWT (Bearer for bus), JOURNAL_DIR, STATUS_EVERY, DASHBOARD_PORT,
 *      SIM_INTERVAL_MS, SIM_SEED
 */

import { assembleSolver } from '../app.js';
import { MAINNET_REGISTRY, USDC_NEAR, WNEAR, USDT_NEAR, MAINNET } from '../mainnetConfig.js';
import { dailyFileSink, ringSink, teeSink } from '../sinks.js';
import { createStatusServer } from '../statusServer.js';
import { reclaimListenPort } from './reclaimPort.js';
import { createIntentSimulator, DEFAULT_AVERAGES } from '../sim/intentSim.js';
import { MapPriceSource } from '../sim/mapPriceSource.js';
import { createCoverageRotator } from '../sim/coverage.js';
import { SolverPipeline } from '../solver.js';
import { authorizationFromEnv } from '../wsTransport.js';

const argv = process.argv.slice(2);
const simMode = argv.includes('--sim') || process.env['SIM_INTENTS'] === '1';
const coverMode = argv.includes('--cover') || process.env['SIM_COVER'] === '1';

const PRICE_REFRESH_MS = 2_000;
const JOURNAL_RING_CAPACITY = 500;
const journalDir = process.env['JOURNAL_DIR'] ?? './data/journal';
const statusEveryMs = Number(process.env['STATUS_EVERY'] ?? '30') * 1000;
const dashboardPort = Number(process.env['DASHBOARD_PORT'] ?? '8787');
const simIntervalMs = Number(process.env['SIM_INTERVAL_MS'] ?? '2500');
const simSeed = Number(process.env['SIM_SEED'] ?? '42');

reclaimListenPort(dashboardPort);

const ring = ringSink(JOURNAL_RING_CAPACITY);
const auth = authorizationFromEnv();

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
console.log(
  `bus auth:  ${auth ? 'PARTNER_JWT present (Bearer handshake)' : 'NONE — waiting on portal/KYC; frames will stay 0'}`
);
if (simMode && coverMode) {
  console.log(`sim:       COVERAGE · every ${simIntervalMs}ms (not residual)`);
} else if (simMode) {
  console.log(`sim:       random · seed=${simSeed} · ${simIntervalMs}ms (not residual)`);
} else {
  console.log(`sim:       off · residual only (requires PARTNER_JWT for frames)`);
}
console.log('');

app.runner.start();
const priceLoop = setInterval(() => void app.refreshPrices(), PRICE_REFRESH_MS);
const statusLoop = setInterval(() => console.log(app.statusReport() + '\n'), statusEveryMs);

let simLoop: ReturnType<typeof setInterval> | undefined;

if (simMode) {
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

  const bump = (key: string) => {
    app.runner.metrics.counters[key] = (app.runner.metrics.counters[key] ?? 0) + 1;
  };

  const applyDecision = (
    request: import('../codec.js').QuoteRequestEvent,
    decision: import('../solver.js').QuoteDecision
  ) => {
    app.journal.recordDecision(request, decision);
    if (!decision.shouldQuote) {
      bump(`quote_decision:${decision.reason}`);
      return;
    }
    const ok = app.runner.inventory.reserve(
      decision.quoteId,
      decision.assetOut,
      decision.amountOutRaw,
      Date.parse(decision.deadlineIso)
    );
    bump(ok ? 'quote_decision:would_quote_dry_run' : 'quote_decision:reservation_conflict');
  };

  if (coverMode) {
    const rot = createCoverageRotator();
    const tickCover = () => {
      const c = rot.next();
      mapPx.setMids(c.midsUsd);
      const decision = simPipeline.decide(c.request);
      applyDecision(c.request, decision);
      console.log(`[cover] ${c.target} → ${decision.shouldQuote ? 'WOULD_QUOTE' : decision.reason}`);
    };
    tickCover();
    simLoop = setInterval(tickCover, simIntervalMs);
  } else {
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
      applyDecision(tick.request, simPipeline.decide(tick.request));
    };
    tickSim();
    simLoop = setInterval(tickSim, simIntervalMs);
  }
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
