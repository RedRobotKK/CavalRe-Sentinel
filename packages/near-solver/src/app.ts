/**
 * COMPOSITION ROOT (X13)
 *
 * assembleSolver() is the ONE call that turns the library into a product:
 * config -> oracle legs -> caches -> median -> staleness guard -> risk guard
 * -> runner (+ journal) -> optional reconciler. The bin script is a thin
 * shell over this; tests exercise this, not the shell.
 *
 * Deliverability rules encoded here (PM × quant × security, X14):
 *  - minPriceSources < 2 is DRY-RUN ONLY. Live single-source pricing is
 *    refused at construction, not discovered in production.
 *  - Virtual inventory is DRY-RUN ONLY. Pretend money cannot go live.
 *  - Virtual inventory disables the reconciler (nothing on-chain to
 *    reconcile against); a real account id + real deposits enable it.
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
import { makeWebSocketTransportFactory } from './wsTransport.js';

const DEFAULT_MEDIAN_DEVIATION_BPS = 100;

export interface AssembleOptions {
  registry: AssetRegistry;
  dryRun: boolean;
  /** X14: values below 2 are refused unless dryRun. */
  minPriceSources: number;
  /** Dry-run only: seed pretend inventory (asset -> raw amount). */
  virtualInventory?: Map<string, bigint>;
  /** Real solver account on intents.near; enables the reconciler. */
  accountId?: string;
  privateKey?: KeyObject;
  priceFetchers?: AsyncPriceFetcher[];
  transportFactory?: TransportFactory;
  journalSink?: JournalSink;
  now?: () => number;
}

export interface AssembledSolver {
  runner: SolverRunner;
  reconciler: Reconciler | null;
  inventory: SolverRunner['inventory'];
  journal: DecisionJournal;
  riskGuard: SolverRiskGuard;
  /** Call on a loop well under priceMaxAgeMs or every quote is no_price. */
  refreshPrices: () => Promise<void>;
  statusReport: () => string;
}

export function assembleSolver(options: AssembleOptions): AssembledSolver {
  const now = options.now ?? Date.now;
  const g3 = MAINNET.g3Defaults;

  // --- deliverability guards: fail at construction, not in production ---
  if (!options.dryRun && options.minPriceSources < 2) {
    throw new Error('single-source pricing is dry-run only (X14): provide >= 2 price sources for live');
  }
  if (!options.dryRun && options.virtualInventory !== undefined) {
    throw new Error('virtual inventory is dry-run only: fund the real account for live');
  }

  // --- inventory ---
  const baseInventory = new LedgerInventory(options.registry);
  if (options.virtualInventory) {
    for (const [asset, amountRaw] of options.virtualInventory) {
      baseInventory.deposit(asset, amountRaw, 'virtual:genesis');
    }
  }

  // --- oracle stack ---
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

  // --- risk + journal + runner ---
  const riskGuard = new SolverRiskGuard({
    maxQuoteNotionalUsd: g3.maxQuoteNotionalUsd,
    maxDailyLossUsd: g3.maxDailyLossUsd,
  });
  const journal = new DecisionJournal({ sink: options.journalSink ?? (() => {}), now });
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
      transportFactory: options.transportFactory ?? makeWebSocketTransportFactory(),
      reconnectMinMs: 1_000,
      reconnectMaxMs: 30_000,
    },
    dryRun: options.dryRun,
    ...(options.privateKey ? { privateKey: options.privateKey } : {}),
    journal,
    now,
  });

  // --- reconciler: real accounts only ---
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
  return {
    runner,
    reconciler,
    inventory: runner.inventory,
    journal,
    riskGuard,
    refreshPrices: async () => {
      await Promise.all(caches.map((c) => c.refresh()));
    },
    statusReport: () =>
      formatStatusReport({
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
      }),
  };
}

/** Convenience for the bin script: real balance fetcher over mainnet RPC. */
export function mainnetBalanceFetcher(accountId: string): IntentsBalanceFetcher {
  return new IntentsBalanceFetcher({
    rpc: new NearRpcClient({ url: MAINNET.rpcUrls[0]! }),
    accountId,
    contractId: MAINNET.intentsContract,
  });
}
