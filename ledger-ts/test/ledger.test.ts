/**
 * Ledger.ts Test Suite
 *
 * Event-driven state replica that mirrors on-chain Ledger.sol
 * Tests verify:
 * - State synchronization from RPC events
 * - Account balance tracking (multi-token)
 * - Settlement atomicity
 * - Divergence detection (actual vs cached state)
 *
 * Reference: https://github.com/CavalRe/cavalre-contracts/blob/main/modules/ledger/Ledger.sol
 *
 * TDD Workflow:
 * 1. Write failing tests (RED)
 * 2. Implement to pass tests (GREEN)
 * 3. Verify against RPC (VERIFY)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Ledger, LedgerState, BalanceChange, Settlement } from '../src/ledger';
import * as FloatLib from '../../floatlib-ts/src/floatlib';

describe('Ledger - Event-Driven State Replica', () => {

  // ============================================================================
  // BASIC TYPE & INITIALIZATION
  // ============================================================================

  describe('Initialization', () => {
    it('should initialize empty ledger', () => {
      const ledger = new Ledger();
      expect(ledger.getAccountCount()).toBe(0);
      expect(ledger.getStateVersion()).toBe(0n);
    });

    it('should create ledger with initial state', () => {
      const initialState: LedgerState = {
        version: 1n,
        accounts: {
          '0xAlice': {
            balances: {
              'USDC': FloatLib.toFloat(1000000n, 6n), // $1M
              'ETH': FloatLib.toFloat(100000000000000000n, 18n), // 0.1 ETH
            },
            nonce: 0n,
            timestamp: 1000000n,
          },
        },
        blockNumber: 12345n,
        blockTimestamp: 1000000n,
        divergenceDetected: false,
      };

      const ledger = new Ledger(initialState);
      expect(ledger.getStateVersion()).toBe(1n);
      expect(ledger.getAccountCount()).toBe(1);
    });
  });

  // ============================================================================
  // BALANCE QUERIES
  // ============================================================================

  describe('Balance Queries', () => {
    let ledger: Ledger;

    beforeEach(() => {
      const initialState: LedgerState = {
        version: 1n,
        accounts: {
          '0xAlice': {
            balances: {
              'USDC': FloatLib.toFloat(1000000n, 6n),
              'ETH': FloatLib.from(1n, 17n),
            },
            nonce: 0n,
            timestamp: 1000000n,
          },
          '0xBob': {
            balances: {
              'USDC': FloatLib.toFloat(500000n, 6n),
            },
            nonce: 5n,
            timestamp: 1000000n,
          },
        },
        blockNumber: 12345n,
        blockTimestamp: 1000000n,
        divergenceDetected: false,
      };

      ledger = new Ledger(initialState);
    });

    it('should get account balance', () => {
      const balance = ledger.getBalance('0xAlice', 'USDC');
      expect(balance).toBeDefined();
      expect(FloatLib.toNumber(balance!)).toBeCloseTo(1000000, 2);
    });

    it('should return zero for non-existent token', () => {
      const balance = ledger.getBalance('0xAlice', 'DAI');
      expect(FloatLib.isZero(balance!)).toBe(true);
    });

    it('should get all balances for account', () => {
      const balances = ledger.getAccountBalances('0xAlice');
      expect(Object.keys(balances)).toContain('USDC');
      expect(Object.keys(balances)).toContain('ETH');
    });

    it('should get total balance across all accounts for token', () => {
      const total = ledger.getTotalBalance('USDC');
      const expected = FloatLib.toFloat(1500000n, 6n); // 1M + 500k
      expect(FloatLib.isEQ(total, expected)).toBe(true);
    });

    it('should return zero for non-existent account', () => {
      const balance = ledger.getBalance('0xNobody', 'USDC');
      expect(FloatLib.isZero(balance!)).toBe(true);
    });
  });

  // ============================================================================
  // BALANCE UPDATES (CACHE CHANGES)
  // ============================================================================

  describe('Balance Updates', () => {
    let ledger: Ledger;

    beforeEach(() => {
      ledger = new Ledger({
        version: 1n,
        accounts: {
          '0xAlice': {
            balances: { 'USDC': FloatLib.toFloat(1000000n, 6n) },
            nonce: 0n,
            timestamp: 1000000n,
          },
        },
        blockNumber: 12345n,
        blockTimestamp: 1000000n,
        divergenceDetected: false,
      });
    });

    it('should update balance on deposit', () => {
      const change: BalanceChange = {
        account: '0xAlice',
        token: 'USDC',
        amount: FloatLib.toFloat(100000n, 6n), // +$100k
        type: 'deposit',
        txHash: '0xabc123',
        blockNumber: 12346n,
      };

      ledger.applyBalanceChange(change);

      const newBalance = ledger.getBalance('0xAlice', 'USDC');
      const expected = FloatLib.toFloat(1100000n, 6n); // $1.1M
      expect(FloatLib.isEQ(newBalance!, expected)).toBe(true);
    });

    it('should update balance on withdrawal', () => {
      const change: BalanceChange = {
        account: '0xAlice',
        token: 'USDC',
        amount: FloatLib.toFloat(300000n, 6n), // -$300k
        type: 'withdrawal',
        txHash: '0xdef456',
        blockNumber: 12346n,
      };

      ledger.applyBalanceChange(change);

      const newBalance = ledger.getBalance('0xAlice', 'USDC');
      const expected = FloatLib.toFloat(700000n, 6n); // $700k
      expect(FloatLib.isEQ(newBalance!, expected)).toBe(true);
    });

    it('should create new account on first deposit', () => {
      const change: BalanceChange = {
        account: '0xCharlie',
        token: 'ETH',
        amount: FloatLib.toFloat(1000000000000000000n, 18n), // 1 ETH
        type: 'deposit',
        txHash: '0xghi789',
        blockNumber: 12346n,
      };

      ledger.applyBalanceChange(change);

      const balance = ledger.getBalance('0xCharlie', 'ETH');
      expect(FloatLib.toNumber(balance!)).toBeCloseTo(1.0, 5);
    });

    it('should increment version on change', () => {
      const v1 = ledger.getStateVersion();

      ledger.applyBalanceChange({
        account: '0xAlice',
        token: 'USDC',
        amount: FloatLib.toFloat(100000n, 6n),
        type: 'deposit',
        txHash: '0xabc123',
        blockNumber: 12346n,
      });

      const v2 = ledger.getStateVersion();
      expect(v2).toBe(v1 + 1n);
    });
  });

  // ============================================================================
  // SETTLEMENT OPERATIONS
  // ============================================================================

  describe('Settlement', () => {
    let ledger: Ledger;

    beforeEach(() => {
      ledger = new Ledger({
        version: 1n,
        accounts: {
          '0xAlice': {
            balances: { 'USDC': FloatLib.toFloat(1000000n, 6n) },
            nonce: 0n,
            timestamp: 1000000n,
          },
          '0xBob': {
            balances: { 'USDC': FloatLib.toFloat(500000n, 6n) },
            nonce: 0n,
            timestamp: 1000000n,
          },
        },
        blockNumber: 12345n,
        blockTimestamp: 1000000n,
        divergenceDetected: false,
      });
    });

    it('should settle transfer: Alice sends $100k to Bob', () => {
      const settlement: Settlement = {
        type: 'transfer',
        from: '0xAlice',
        to: '0xBob',
        token: 'USDC',
        amount: FloatLib.toFloat(100000n, 6n),
        txHash: '0xabc123',
        blockNumber: 12346n,
      };

      ledger.applySettlement(settlement);

      const aliceBalance = ledger.getBalance('0xAlice', 'USDC');
      const bobBalance = ledger.getBalance('0xBob', 'USDC');

      expect(FloatLib.toNumber(aliceBalance!)).toBeCloseTo(900000, 2);
      expect(FloatLib.toNumber(bobBalance!)).toBeCloseTo(600000, 2);
    });

    it('should revert settlement on insufficient balance', () => {
      const settlement: Settlement = {
        type: 'transfer',
        from: '0xAlice',
        to: '0xBob',
        token: 'USDC',
        amount: FloatLib.toFloat(2000000n, 6n), // More than Alice has
        txHash: '0xabc123',
        blockNumber: 12346n,
      };

      expect(() => ledger.applySettlement(settlement)).toThrow('Insufficient balance');
    });

    it('should handle multi-leg settlement', () => {
      const settlements: Settlement[] = [
        {
          type: 'transfer',
          from: '0xAlice',
          to: '0xBob',
          token: 'USDC',
          amount: FloatLib.toFloat(300000n, 6n),
          txHash: '0xabc123',
          blockNumber: 12346n,
        },
        {
          type: 'transfer',
          from: '0xBob',
          to: '0xAlice',
          token: 'USDC',
          amount: FloatLib.toFloat(100000n, 6n),
          txHash: '0xdef456',
          blockNumber: 12346n,
        },
      ];

      settlements.forEach(s => ledger.applySettlement(s));

      const aliceBalance = ledger.getBalance('0xAlice', 'USDC');
      const bobBalance = ledger.getBalance('0xBob', 'USDC');

      expect(FloatLib.toNumber(aliceBalance!)).toBeCloseTo(800000, 2);
      expect(FloatLib.toNumber(bobBalance!)).toBeCloseTo(700000, 2);
    });

    it('should be atomic: all-or-nothing', () => {
      const settlements: Settlement[] = [
        {
          type: 'transfer',
          from: '0xAlice',
          to: '0xBob',
          token: 'USDC',
          amount: FloatLib.toFloat(600000n, 6n),
          txHash: '0xabc123',
          blockNumber: 12346n,
        },
        {
          type: 'transfer',
          from: '0xBob',
          to: '0xAlice',
          token: 'USDC',
          amount: FloatLib.toFloat(600000n, 6n), // This will fail
          txHash: '0xdef456',
          blockNumber: 12346n,
        },
      ];

      const v1 = ledger.getStateVersion();
      expect(() => {
        settlements.forEach(s => ledger.applySettlement(s));
      }).toThrow();
      const v2 = ledger.getStateVersion();

      // Version should not change if settlement fails
      expect(v2).toBe(v1 + 1n); // First succeeded, second failed
    });
  });

  // ============================================================================
  // DIVERGENCE DETECTION
  // ============================================================================

  describe('Divergence Detection', () => {
    let ledger: Ledger;

    beforeEach(() => {
      ledger = new Ledger({
        version: 1n,
        accounts: {
          '0xAlice': {
            balances: { 'USDC': FloatLib.toFloat(1000000n, 6n) },
            nonce: 0n,
            timestamp: 1000000n,
          },
        },
        blockNumber: 12345n,
        blockTimestamp: 1000000n,
        divergenceDetected: false,
      });
    });

    it('should detect balance divergence', () => {
      // Cache: $1M
      const cachedBalance = ledger.getBalance('0xAlice', 'USDC');
      expect(FloatLib.toNumber(cachedBalance!)).toBeCloseTo(1000000, 2);

      // RPC says: $800k (someone withdrew)
      const rpcBalance = FloatLib.toFloat(800000n, 6n);

      const diverged = ledger.checkDivergence('0xAlice', 'USDC', rpcBalance);
      expect(diverged).toBe(true);
      expect(ledger.isDiverged()).toBe(true);
    });

    it('should not flag divergence within tolerance', () => {
      // Cache: $1M
      // RPC: $1M + dust (rounding error)
      const rpcBalance = FloatLib.plus(
        ledger.getBalance('0xAlice', 'USDC')!,
        FloatLib.from(1n, -8n) // +$0.00000001
      );

      const diverged = ledger.checkDivergence('0xAlice', 'USDC', rpcBalance);
      expect(diverged).toBe(false);
    });

    it('should halt on divergence detection', () => {
      // Simulate divergence
      ledger.checkDivergence(
        '0xAlice',
        'USDC',
        FloatLib.toFloat(500000n, 6n)
      );

      expect(ledger.isDiverged()).toBe(true);

      // Should not allow further settlements
      const settlement: Settlement = {
        type: 'transfer',
        from: '0xAlice',
        to: '0xBob',
        token: 'USDC',
        amount: FloatLib.toFloat(100000n, 6n),
        txHash: '0xabc123',
        blockNumber: 12346n,
      };

      expect(() => ledger.applySettlement(settlement)).toThrow('State diverged');
    });
  });

  // ============================================================================
  // STATE SNAPSHOT & RESTORE
  // ============================================================================

  describe('State Snapshots', () => {
    let ledger: Ledger;

    beforeEach(() => {
      ledger = new Ledger({
        version: 1n,
        accounts: {
          '0xAlice': {
            balances: { 'USDC': FloatLib.toFloat(1000000n, 6n) },
            nonce: 0n,
            timestamp: 1000000n,
          },
        },
        blockNumber: 12345n,
        blockTimestamp: 1000000n,
        divergenceDetected: false,
      });
    });

    it('should save and restore state', () => {
      const snapshot = ledger.snapshot();

      // Modify state
      ledger.applyBalanceChange({
        account: '0xAlice',
        token: 'USDC',
        amount: FloatLib.toFloat(500000n, 6n),
        type: 'deposit',
        txHash: '0xabc123',
        blockNumber: 12346n,
      });

      expect(FloatLib.toNumber(ledger.getBalance('0xAlice', 'USDC')!)).toBeCloseTo(1500000, 2);

      // Restore
      ledger.restore(snapshot);

      expect(FloatLib.toNumber(ledger.getBalance('0xAlice', 'USDC')!)).toBeCloseTo(1000000, 2);
    });

    it('should maintain version history', () => {
      const v1 = ledger.getStateVersion();

      ledger.applyBalanceChange({
        account: '0xAlice',
        token: 'USDC',
        amount: FloatLib.toFloat(100000n, 6n),
        type: 'deposit',
        txHash: '0xabc123',
        blockNumber: 12346n,
      });

      const v2 = ledger.getStateVersion();
      expect(v2).toBe(v1 + 1n);

      const history = ledger.getVersionHistory();
      expect(history.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    let ledger: Ledger;

    beforeEach(() => {
      ledger = new Ledger({
        version: 1n,
        accounts: {
          '0xAlice': {
            balances: { 'USDC': FloatLib.toFloat(1000000n, 6n) },
            nonce: 0n,
            timestamp: 1000000n,
          },
        },
        blockNumber: 12345n,
        blockTimestamp: 1000000n,
        divergenceDetected: false,
      });
    });

    it('should handle zero transfer', () => {
      const settlement: Settlement = {
        type: 'transfer',
        from: '0xAlice',
        to: '0xAlice',
        token: 'USDC',
        amount: FloatLib.ZERO,
        txHash: '0xabc123',
        blockNumber: 12346n,
      };

      ledger.applySettlement(settlement);
      expect(FloatLib.toNumber(ledger.getBalance('0xAlice', 'USDC')!)).toBeCloseTo(1000000, 2);
    });

    it('should handle self-transfer', () => {
      const settlement: Settlement = {
        type: 'transfer',
        from: '0xAlice',
        to: '0xAlice',
        token: 'USDC',
        amount: FloatLib.toFloat(100000n, 6n),
        txHash: '0xabc123',
        blockNumber: 12346n,
      };

      ledger.applySettlement(settlement);
      expect(FloatLib.toNumber(ledger.getBalance('0xAlice', 'USDC')!)).toBeCloseTo(1000000, 2);
    });

    it('should track nonce increments', () => {
      const nonce1 = ledger.getAccountNonce('0xAlice');

      ledger.applyBalanceChange({
        account: '0xAlice',
        token: 'USDC',
        amount: FloatLib.toFloat(100000n, 6n),
        type: 'deposit',
        txHash: '0xabc123',
        blockNumber: 12346n,
      });

      const nonce2 = ledger.getAccountNonce('0xAlice');
      expect(nonce2).toBe(nonce1 + 1n);
    });
  });

  // ============================================================================
  // STATE CONSISTENCY
  // ============================================================================

  describe('State Consistency', () => {
    let ledger: Ledger;

    beforeEach(() => {
      ledger = new Ledger({
        version: 1n,
        accounts: {
          '0xAlice': {
            balances: { 'USDC': FloatLib.toFloat(1000000n, 6n), 'ETH': FloatLib.toFloat(1000000000000000000n, 18n) },
            nonce: 0n,
            timestamp: 1000000n,
          },
          '0xBob': {
            balances: { 'USDC': FloatLib.toFloat(500000n, 6n) },
            nonce: 0n,
            timestamp: 1000000n,
          },
        },
        blockNumber: 12345n,
        blockTimestamp: 1000000n,
        divergenceDetected: false,
      });
    });

    it('should maintain balance conservation', () => {
      const totalBefore = ledger.getTotalBalance('USDC');

      ledger.applySettlement({
        type: 'transfer',
        from: '0xAlice',
        to: '0xBob',
        token: 'USDC',
        amount: FloatLib.toFloat(300000n, 6n),
        txHash: '0xabc123',
        blockNumber: 12346n,
      });

      const totalAfter = ledger.getTotalBalance('USDC');
      expect(FloatLib.isEQ(totalBefore, totalAfter)).toBe(true);
    });

    it('should handle multiple tokens independently', () => {
      ledger.applySettlement({
        type: 'transfer',
        from: '0xAlice',
        to: '0xBob',
        token: 'USDC',
        amount: FloatLib.toFloat(300000n, 6n),
        txHash: '0xabc123',
        blockNumber: 12346n,
      });

      const ethBalance = ledger.getBalance('0xAlice', 'ETH');
      expect(FloatLib.toNumber(ethBalance!)).toBeCloseTo(1.0, 5);
    });
  });
});
