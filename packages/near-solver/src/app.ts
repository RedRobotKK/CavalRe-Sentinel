/**
 * COMPOSITION ROOT (X13)
 *
 * assembleSolver() is the ONE call that turns the library into a product.
 */

import type { KeyObject } from 'node:crypto';
import type { JournalSink } from './journal.js';
import { DecisionJournal } from './journal.js';
import { MAINNET } from './mainnetConfig.js';
import {
  MedianPriceSource,
  OneClickPriceSource,
  PriceCache,
  type AsyncPriceFetcher,
} from './index.js';
import { IntentsBalanceFetcher } from './balanceFetcher.js';
import { NearRpcClient } from './nearRpc.js';
import { Reconciler } from './reconciler.js';
import type { TransportFactory } from './relay.js';
import { SolverRiskGuard } from './risk.js';
import { SolverRunner } from './runner.js';
import { LedgerInventory, type AssetRegistry } from './solver.js';
import { StalenessGuardedPriceSource } from './staleness.js';
import { formatStatusReport } from './status.js';
import { authorizationFromEnv, makeWebSocketTransportFactory } from './wsTransport.js';

const DEFAULT_MEDIAN_DEVIATION_BPS = 100;

export interface AssembleOptions {
  registry: AssetRegistry;
  dryRun: boolean;
  minPriceSources: number;
  virtualInventory?: Map<string, bigint>;
  accountId?: string;
  privateKey?: KeyObject;
  priceFetchers?: AsyncPriceFetcher[];
  transportFactory?: TransportFactory;
  journalSink?: JournalSink;
  now?: () => number;
  /** Override env; tests inject. */
  partnerAuthorization?: string;
}

export interface AssembledSolver {
  runner: SolverRunner;
  reconciler: Reconciler | null;
  inventory: SolverRunner['inventory'];
  journal: DecisionJournal;
  riskGuard: SolverRiskGuard;
  refreshPrices: () => Promise<void>;
  statusReport: () => string;
  statusSnapshot: () => import('./status.js').StatusReportInput;
  /** Whether PARTNER_JWT (or inject) is present — not proof of frames. */
  relayAuth: 'none' | 'bearer';
}

export function assembleSolver(options: AssembleOptions): AssembledSolver {
  const now = options.now ?? Date.now;
  const g3 = MAINNET.g3Defaults;

  if (!options.dryRun && options.minPriceSources < 2) {
    throw new Error('single-source pricing is dry-run only (X14): provide >= 2 price sources for live');
  }
  if (!options.dryRun && options.virtualInventory !== undefined) {
    throw new Error('virtual inventory is dry-run only: fund the real account for live');
  }

  const baseInventory = new LedgerInventory(options.registry);
  if (options.virtualInventory) {
    for (const [asset, amountRaw] of options.virtualInventory) {
      baseInventory.deposit(asset, amountRaw, 'virtual:genesis');
    }
  }

  const fetchers = options.priceFetchers ?? [new OneClickPriceSource({ now })];
  const assets = [...options.registry.keys()];
  const pairs: [string, string][] = [];
  for (const a of assets) for (const b of assets) if (a !== b) pairs.push([a, b]);
  const caches = fetchers.map((f) => new PriceCache(f, { assets, pairs }));
  const median = new MedianPriceSource({
    sources: caches,
    maxDeviationBps: DEFAULT_MEDIAN_DEVIATION_BPS,
    minSources: options.minPriceSources,
  });
  const priceSource = new StalenessGuardedPriceSource(median, {
    maxAgeMs: g3.priceMaxAgeMs,
    now,
  });

  const riskGuard = new SolverRiskGuard({
    maxQuoteNotionalUsd: g3.maxQuoteNotionalUsd,
    maxDailyLossUsd: g3.maxDailyLossUsd,
  });
  const journal = new DecisionJournal({ sink: options.journalSink ?? (() => {}), now });

  const authorization =
    options.partnerAuthorization ?? authorizationFromEnv();
  const relayAuth: 'none' | 'bearer' = authorization ? 'bearer' : 'none';
  const transportFactory =
    options.transportFactory ??
    makeWebSocketTransportFactory(authorization ? { authorization } : {});

  const runner = new SolverRunner({
    registry: options.registry,
    priceSource,
    baseInventory,
    riskGuard,
    solverConfig: {
      signerId: options.accountId ?? 'dry-run.invalid',
      halfSpreadBps: g3.halfSpreadBps,
      maxInventorySkewBps: g3.maxInventorySkewBps,
      quoteValidityMs: g3.quoteValidityMs,
      maxDeadlineMs: g3.maxDeadlineMs,
      minNotionalUsd: g3.minNotionalUsd,
    },
    relay: {
      url: MAINNET.solverRelayWsUrl,
      transportFactory,
      reconnectMinMs: 1_000,
      reconnectMaxMs: 30_000,
    },
    dryRun: options.dryRun,
    ...(options.privateKey ? { privateKey: options.privateKey } : {}),
    journal,
    now,
  });

  const reconciler =
    options.virtualInventory === undefined && options.accountId !== undefined
      ? new Reconciler({
          registry: options.registry,
          inventory: baseInventory,
          riskGuard,
          usdPrice: (asset) => priceSource.usdPrice(asset),
          maxDriftUsd: g3.maxDriftUsd,
          pendingQuotes: runner.pendingQuotes,
          reservations: runner.inventory,
        })
      : null;

  const startedAt = now();
  const statusSnapshot = () => ({
    dryRun: options.dryRun,
    uptimeMs: now() - startedAt,
    killSwitch: riskGuard.state.killSwitch,
    counters: runner.metrics.counters,
    inventoryLines: [...options.registry.entries()].map(([asset, info]) => ({
      symbol: info.symbol,
      availableRaw: runner.inventory.availableRaw(asset),
      decimals: info.decimals,
    })),
    activeReservations: runner.inventory.activeReservationCount,
    journalDropped: journal.droppedEntries,
    relay: {
      ...runner.relayStats,
      auth: relayAuth,
    },
    risk: riskGuard.state,
  });

  return {
    runner,
    reconciler,
    inventory: runner.inventory,
    journal,
    riskGuard,
    relayAuth,
    refreshPrices: async () => {
      await Promise.all(caches.map((c) => c.refresh()));
    },
    statusSnapshot,
    statusReport: () => formatStatusReport(statusSnapshot()),
  };
}

export function mainnetBalanceFetcher(accountId: string): IntentsBalanceFetcher {
  return new IntentsBalanceFetcher({
    rpc: new NearRpcClient({ url: MAINNET.rpcUrls[0]! }),
    accountId,
    contractId: MAINNET.intentsContract,
  });
}
