#!/usr/bin/env node

/**
 * FETCH REAL NEAR INTENTS SETTLEMENT DATA
 *
 * Pulls settled transactions on the intents.near verifier contract via the
 * NearBlocks API. This replaces intents-mock.json as the training data source:
 * real fills, real amounts, real timing — real labels.
 *
 * Usage:
 *   node scripts/fetch-near-intents.js [--pages 5] [--out data/near-intents.json]
 *
 * Notes:
 * - NearBlocks free tier is rate-limited; we throttle between pages.
 * - Get an API key at https://nearblocks.io/apis and set NEARBLOCKS_API_KEY
 *   to raise limits. Works keyless at low volume.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VERIFIER_CONTRACT = 'intents.near';
const NEARBLOCKS_API_BASE = 'https://api.nearblocks.io/v1';
const PAGE_SIZE = 25;
const THROTTLE_MS = 1500; // stay under free-tier rate limits
const DEFAULT_PAGES = 5;
const DEFAULT_OUT = path.join(__dirname, '../data/near-intents.json');

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  };
  return {
    pages: parseInt(get('--pages', String(DEFAULT_PAGES)), 10),
    out: get('--out', DEFAULT_OUT),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(page) {
  const url = `${NEARBLOCKS_API_BASE}/account/${VERIFIER_CONTRACT}/txns?page=${page}&per_page=${PAGE_SIZE}&order=desc`;
  const headers = { accept: 'application/json' };
  if (process.env.NEARBLOCKS_API_KEY) {
    headers.Authorization = `Bearer ${process.env.NEARBLOCKS_API_KEY}`;
  }

  const res = await fetch(url, { headers });
  if (res.status === 429) {
    console.warn(`⚠️  Rate limited on page ${page}, backing off 10s...`);
    await sleep(10_000);
    return fetchPage(page);
  }
  if (!res.ok) {
    throw new Error(`NearBlocks API error ${res.status} on page ${page}`);
  }
  const body = await res.json();
  return body.txns ?? [];
}

async function main() {
  const { pages, out } = parseArgs();
  console.log(`Fetching ${pages} pages of ${VERIFIER_CONTRACT} transactions...`);

  const all = [];
  for (let page = 1; page <= pages; page++) {
    try {
      const txns = await fetchPage(page);
      if (txns.length === 0) break;
      all.push(...txns);
      console.log(`  page ${page}: ${txns.length} txns (total ${all.length})`);
    } catch (err) {
      console.error(`❌ Failed on page ${page}: ${err.message}`);
      break; // keep what we have — partial real data beats none
    }
    await sleep(THROTTLE_MS);
  }

  if (all.length === 0) {
    console.error('❌ No data fetched. Check network/API key.');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    JSON.stringify({ fetchedAt: Date.now(), source: 'nearblocks', contract: VERIFIER_CONTRACT, count: all.length, txns: all }, null, 2)
  );
  console.log(`✅ Wrote ${all.length} transactions to ${out}`);
  console.log('Next: build a feature extractor over execute() calls (token_diff intents) to derive real labels.');
}

main();
