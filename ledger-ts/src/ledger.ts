/**
 * Ledger.ts - Event-Driven State Replica
 *
 * Maintains synchronized cache of on-chain ledger state
 * - Tracks account balances across multiple tokens
 * - Processes settlement transactions atomically
 * - Detects divergence between cache and RPC state
 * - Provides fast queries without RPC calls
 *
 * Reference: https://github.com/CavalRe/cavalre-contracts/blob/main/modules/ledger/Ledger.sol
 *
 * Architecture:
 * - Single source of truth: Ledger.sol on-chain
 * - Cache replica: LedgerState in memory
 * - Verification: Periodic RPC calls to detect divergence
 * - Recovery: Can rollback to snapshot on divergence
 *
 * Non-negotiable rules (from DEVELOPMENT_RULES.md):
 * 1. FloatLib for ALL math - ENFORCED
 * 2. NEVER TRUST ALWAYS VERIFY - RPC verification required
 * 3. CITE REFERENCES - Every function links to Ledger.sol
 * 4. CHECK FACTS - State verified against blockchain
 * 5. TDD - Write tests first
 */

import * as FloatLib from '../../floatlib-ts/src/floatlib';

/**
 * Account representation in ledger
 */
export interface Account {
  balances: Record<string, FloatLib.FloatFixed>; // token → balance
  nonce: bigint; // Transaction count
  timestamp: bigint; // Last update timestamp
}

/**
 * Complete ledger state at a point in time
 */
export interface LedgerState {
  version: bigint; // State version (incremented on each change)
  accounts: Record<string, Account>; // address → account
  blockNumber: bigint; // Block height of current state
  blockTimestamp: bigint; // Block timestamp
  divergenceDetected: boolean; // Set to true if cache differs from RPC
}

/**
 * Balance change event
 */
export interface BalanceChange {
  account: string; // 0x... address
  token: string; // Token symbol (USDC, ETH, etc)
  amount: FloatLib.FloatFixed; // Amount changed (positive = deposit, negative = withdrawal)
  type: 'deposit' | 'withdrawal'; // Type of change
  txHash: string; // Transaction hash on-chain
  blockNumber: bigint; // Block number of change
}

/**
 * Settlement transaction
 */
export interface Settlement {
  type: 'transfer' | 'liquidation' | 'fee';
  from: string; // Source account
  to: string; // Destination account
  token: string; // Token being transferred
  amount: FloatLib.FloatFixed; // Amount
  txHash: string; // Transaction hash
  blockNumber: bigint; // Block number
}

/**
 * Ledger - Event-Driven State Replica
 *
 * Manages account balances and settlements with divergence detection
 *
 * Reference: FloatLib.sol (for all math operations)
 */
export class Ledger {
  private state: LedgerState;
  private history: LedgerState[] = []; // Version history for rollback
  private divergenceTolerance: FloatLib.FloatFixed = FloatLib.from(1n, -8n); // 0.00000001

  /**
   * Initialize Ledger
   *
   * Can start empty or with initial state
   */
  constructor(initialState?: LedgerState) {
    if (initialState) {
      this.state = this._deepCopyState(initialState);
    } else {
      this.state = {
        version: 0n,
        accounts: {},
        blockNumber: 0n,
        blockTimestamp: 0n,
        divergenceDetected: false,
      };
    }
    this.history.push(this.state);
  }

  // ============================================================================
  // STATE QUERIES
  // ============================================================================

  /**
   * Get current state version
   */
  getStateVersion(): bigint {
    return this.state.version;
  }

  /**
   * Get number of accounts
   */
  getAccountCount(): number {
    return Object.keys(this.state.accounts).length;
  }

  /**
   * Check if divergence detected
   */
  isDiverged(): boolean {
    return this.state.divergenceDetected;
  }

  /**
   * Get balance for account + token
   *
   * Returns zero if account or token doesn't exist
   */
  getBalance(account: string, token: string): FloatLib.FloatFixed {
    if (!this.state.accounts[account]) {
      return FloatLib.ZERO;
    }

    const balance = this.state.accounts[account].balances[token];
    return balance || FloatLib.ZERO;
  }

  /**
   * Get all balances for an account
   */
  getAccountBalances(account: string): Record<string, FloatLib.FloatFixed> {
    if (!this.state.accounts[account]) {
      return {};
    }

    return this.state.accounts[account].balances;
  }

  /**
   * Get total balance across all accounts for a token
   */
  getTotalBalance(token: string): FloatLib.FloatFixed {
    let total = FloatLib.ZERO;

    for (const account of Object.values(this.state.accounts)) {
      const balance = account.balances[token];
      if (balance) {
        total = FloatLib.plus(total, balance);
      }
    }

    return total;
  }

  /**
   * Get account nonce (transaction count)
   */
  getAccountNonce(account: string): bigint {
    return this.state.accounts[account]?.nonce || 0n;
  }

  /**
   * Get version history for rollback
   */
  getVersionHistory(): LedgerState[] {
    return [...this.history];
  }

  // ============================================================================
  // BALANCE UPDATES
  // ============================================================================

  /**
   * Apply balance change event
   *
   * Modifies cache based on deposit/withdrawal
   */
  applyBalanceChange(change: BalanceChange): void {
    if (this.state.divergenceDetected) {
      throw new Error('State diverged - cannot apply changes');
    }

    // Create account if needed
    if (!this.state.accounts[change.account]) {
      this.state.accounts[change.account] = {
        balances: {},
        nonce: 0n,
        timestamp: change.blockNumber,
      };
    }

    const account = this.state.accounts[change.account];
    const currentBalance = account.balances[change.token] || FloatLib.ZERO;

    // Update balance
    if (change.type === 'deposit') {
      account.balances[change.token] = FloatLib.plus(currentBalance, change.amount);
    } else {
      // Withdrawal - check sufficient balance
      if (FloatLib.isLT(currentBalance, change.amount)) {
        throw new Error('Insufficient balance for withdrawal');
      }
      account.balances[change.token] = FloatLib.minus(currentBalance, change.amount);
    }

    // Increment nonce
    account.nonce += 1n;
    account.timestamp = change.blockNumber;

    // Increment version
    this._incrementVersion();
  }

  // ============================================================================
  // SETTLEMENTS
  // ============================================================================

  /**
   * Apply settlement transaction (atomic transfer)
   *
   * Processes: transfer, liquidation, fee
   */
  applySettlement(settlement: Settlement): void {
    if (this.state.divergenceDetected) {
      throw new Error('State diverged - cannot apply changes');
    }

    // Handle self-transfer (no-op)
    if (settlement.from === settlement.to && FloatLib.isZero(settlement.amount)) {
      return;
    }

    // Create accounts if needed
    if (!this.state.accounts[settlement.from]) {
      this.state.accounts[settlement.from] = {
        balances: {},
        nonce: 0n,
        timestamp: settlement.blockNumber,
      };
    }
    if (!this.state.accounts[settlement.to]) {
      this.state.accounts[settlement.to] = {
        balances: {},
        nonce: 0n,
        timestamp: settlement.blockNumber,
      };
    }

    const fromAccount = this.state.accounts[settlement.from];
    const toAccount = this.state.accounts[settlement.to];

    // Check sufficient balance
    const fromBalance = fromAccount.balances[settlement.token] || FloatLib.ZERO;
    if (FloatLib.isLT(fromBalance, settlement.amount)) {
      throw new Error('Insufficient balance');
    }

    // Transfer (atomic)
    fromAccount.balances[settlement.token] = FloatLib.minus(fromBalance, settlement.amount);
    const toBalance = toAccount.balances[settlement.token] || FloatLib.ZERO;
    toAccount.balances[settlement.token] = FloatLib.plus(toBalance, settlement.amount);

    // Increment nonces
    fromAccount.nonce += 1n;
    toAccount.nonce += 1n;
    fromAccount.timestamp = settlement.blockNumber;
    toAccount.timestamp = settlement.blockNumber;

    // Increment version
    this._incrementVersion();
  }

  // ============================================================================
  // DIVERGENCE DETECTION
  // ============================================================================

  /**
   * Check for divergence between cache and RPC state
   *
   * Reference: REFOCUSED_ARCHITECTURE.md - Three Sources of Truth
   * If divergence detected, halts all operations
   */
  checkDivergence(account: string, token: string, rpcBalance: FloatLib.FloatFixed): boolean {
    const cachedBalance = this.getBalance(account, token);

    // Calculate absolute difference
    const diff = FloatLib.abs(FloatLib.minus(cachedBalance, rpcBalance));

    // If difference exceeds tolerance, flag divergence
    if (FloatLib.isGT(diff, this.divergenceTolerance)) {
      console.error(`[DIVERGENCE] ${account} ${token}: cached=${FloatLib.toNumber(cachedBalance)}, rpc=${FloatLib.toNumber(rpcBalance)}`);
      this.state.divergenceDetected = true;
      return true;
    }

    return false;
  }

  /**
   * Halt on divergence
   *
   * Called when RPC check detects mismatch
   */
  halt(): void {
    this.state.divergenceDetected = true;
    console.error('[HALT] Ledger state diverged - operations halted');
  }

  /**
   * Reset divergence flag (requires manual intervention)
   */
  resetDivergence(): void {
    this.state.divergenceDetected = false;
  }

  // ============================================================================
  // STATE SNAPSHOTS
  // ============================================================================

  /**
   * Take snapshot of current state
   *
   * Used for rollback on divergence
   */
  snapshot(): LedgerState {
    return this._deepCopyState(this.state);
  }

  /**
   * Restore state from snapshot
   */
  restore(snapshot: LedgerState): void {
    this.state = this._deepCopyState(snapshot);
    this.history.push(this.state);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Increment version and record in history
   */
  private _incrementVersion(): void {
    this.state.version += 1n;
    // Create deep copy for history
    const stateCopy = this._deepCopyState(this.state);
    this.history.push(stateCopy);
  }

  /**
   * Deep copy state preserving BigInt and FloatFixed
   */
  private _deepCopyState(state: LedgerState): LedgerState {
    const copy: LedgerState = {
      version: state.version,
      accounts: {},
      blockNumber: state.blockNumber,
      blockTimestamp: state.blockTimestamp,
      divergenceDetected: state.divergenceDetected,
    };

    for (const [address, account] of Object.entries(state.accounts)) {
      copy.accounts[address] = {
        balances: {},
        nonce: account.nonce,
        timestamp: account.timestamp,
      };

      for (const [token, balance] of Object.entries(account.balances)) {
        copy.accounts[address].balances[token] = {
          mantissa: balance.mantissa,
          exponent: balance.exponent,
        };
      }
    }

    return copy;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Ledger;
