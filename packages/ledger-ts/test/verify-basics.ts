/**
 * Quick Ledger verification (smoke test)
 * Run: npx tsx test/verify-basics.ts
 */

import { Ledger } from '../src/ledger';
import * as FloatLib from '../../floatlib-ts/src/floatlib';

console.log('=== Ledger Basic Verification ===\n');

// Test 1: Initialize empty ledger
console.log('Test 1: Empty ledger');
const ledger = new Ledger();
console.log(`Accounts: ${ledger.getAccountCount()} (expect 0)`);
console.log(`Version: ${ledger.getStateVersion()} (expect 0)`);
console.log();

// Test 2: Initialize with state
console.log('Test 2: Ledger with initial state');
const ledger2 = new Ledger({
  version: 1n,
  accounts: {
    '0xAlice': {
      balances: {
        'USDC': FloatLib.toFloat(1000000n, 6n),
      },
      nonce: 0n,
      timestamp: 1000000n,
    },
  },
  blockNumber: 12345n,
  blockTimestamp: 1000000n,
  divergenceDetected: false,
});
console.log(`Accounts: ${ledger2.getAccountCount()} (expect 1)`);
console.log(`Alice USDC: ${FloatLib.toNumber(ledger2.getBalance('0xAlice', 'USDC'))} (expect 1000000)`);
console.log();

// Test 3: Deposit
console.log('Test 3: Deposit');
ledger2.applyBalanceChange({
  account: '0xAlice',
  token: 'USDC',
  amount: FloatLib.toFloat(500000n, 6n),
  type: 'deposit',
  txHash: '0xabc',
  blockNumber: 12346n,
});
console.log(`Alice USDC after deposit: ${FloatLib.toNumber(ledger2.getBalance('0xAlice', 'USDC'))} (expect 1500000)`);
console.log(`Version: ${ledger2.getStateVersion()} (expect 2)`);
console.log();

// Test 4: Settlement
console.log('Test 4: Settlement (transfer)');
ledger2.applySettlement({
  type: 'transfer',
  from: '0xAlice',
  to: '0xBob',
  token: 'USDC',
  amount: FloatLib.toFloat(500000n, 6n),
  txHash: '0xdef',
  blockNumber: 12347n,
});
console.log(`Alice USDC after transfer: ${FloatLib.toNumber(ledger2.getBalance('0xAlice', 'USDC'))} (expect 1000000)`);
console.log(`Bob USDC after transfer: ${FloatLib.toNumber(ledger2.getBalance('0xBob', 'USDC'))} (expect 500000)`);
console.log();

// Test 5: Divergence detection
console.log('Test 5: Divergence detection');
const rpcBalance = FloatLib.toFloat(800000n, 6n); // Less than cache
const isDiverged = ledger2.checkDivergence('0xAlice', 'USDC', rpcBalance);
console.log(`Divergence detected: ${isDiverged} (expect true)`);
console.log(`Is diverged: ${ledger2.isDiverged()} (expect true)`);
console.log();

// Test 6: Snapshot/restore
console.log('Test 6: Snapshot/restore');
const ledger3 = new Ledger({
  version: 1n,
  accounts: {
    '0xCharlie': {
      balances: { 'ETH': FloatLib.toFloat(1000000000000000000n, 18n) },
      nonce: 0n,
      timestamp: 1000000n,
    },
  },
  blockNumber: 12345n,
  blockTimestamp: 1000000n,
  divergenceDetected: false,
});

const snapshot = ledger3.snapshot();
ledger3.applyBalanceChange({
  account: '0xCharlie',
  token: 'ETH',
  amount: FloatLib.toFloat(500000000000000000n, 18n),
  type: 'withdrawal',
  txHash: '0xghi',
  blockNumber: 12346n,
});
console.log(`Charlie ETH after withdrawal: ${FloatLib.toNumber(ledger3.getBalance('0xCharlie', 'ETH'))} (expect 0.5)`);

ledger3.restore(snapshot);
console.log(`Charlie ETH after restore: ${FloatLib.toNumber(ledger3.getBalance('0xCharlie', 'ETH'))} (expect 1)`);
console.log();

console.log('=== All basic tests completed ===');
