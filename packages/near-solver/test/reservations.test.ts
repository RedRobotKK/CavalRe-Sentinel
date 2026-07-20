/**
 * QUANT REVIEW FINDING: the pipeline checks inventory against the LEDGER
 * balance, but quotes are commitments. Two quotes issued in the same second
 * could both pass the check and both get filled — a guaranteed overdraw on
 * the second settlement. Quotes must RESERVE inventory for their lifetime.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { LedgerInventory, ReservingInventory } from '../src/solver';

const USDC = 'nep141:usdc.near';
const WNEAR = 'nep141:wrap.near';
const REGISTRY = new Map([
  [USDC, { symbol: 'USDC', decimals: 6n }],
  [WNEAR, { symbol: 'wNEAR', decimals: 24n }],
]);

describe('ReservingInventory', () => {
  let clock: { nowMs: number };
  let base: LedgerInventory;
  let inv: ReservingInventory;

  beforeEach(() => {
    clock = { nowMs: 1_000_000 };
    base = new LedgerInventory(REGISTRY);
    base.deposit(WNEAR, 300n * 10n ** 24n, 'genesis');
    base.deposit(USDC, 1_000_000000n, 'genesis');
    inv = new ReservingInventory(base, () => clock.nowMs);
  });

  it('reserving reduces available inventory', () => {
    inv.reserve('q-1', WNEAR, 200n * 10n ** 24n, clock.nowMs + 60_000);
    expect(inv.availableRaw(WNEAR)).toBe(100n * 10n ** 24n);
  });

  it('THE RACE: a second concurrent quote cannot double-book the same inventory', () => {
    expect(inv.reserve('q-1', WNEAR, 200n * 10n ** 24n, clock.nowMs + 60_000)).toBe(true);
    // second quote wants 200 wNEAR but only 100 remains unreserved
    expect(inv.reserve('q-2', WNEAR, 200n * 10n ** 24n, clock.nowMs + 60_000)).toBe(false);
    expect(inv.availableRaw(WNEAR)).toBe(100n * 10n ** 24n); // failed reserve holds nothing
  });

  it('expired reservations release automatically on read', () => {
    inv.reserve('q-1', WNEAR, 200n * 10n ** 24n, clock.nowMs + 60_000);
    clock.nowMs += 60_001;
    expect(inv.availableRaw(WNEAR)).toBe(300n * 10n ** 24n);
  });

  it('release() frees a reservation early (quote lost the auction)', () => {
    inv.reserve('q-1', WNEAR, 200n * 10n ** 24n, clock.nowMs + 60_000);
    inv.release('q-1');
    expect(inv.availableRaw(WNEAR)).toBe(300n * 10n ** 24n);
  });

  it('release is idempotent', () => {
    inv.reserve('q-1', WNEAR, 200n * 10n ** 24n, clock.nowMs + 60_000);
    inv.release('q-1');
    inv.release('q-1');
    expect(inv.availableRaw(WNEAR)).toBe(300n * 10n ** 24n);
  });

  it('commit() applies the fill to the ledger and frees the reservation', () => {
    inv.reserve('q-1', WNEAR, 199n * 10n ** 24n, clock.nowMs + 60_000);
    inv.commit('q-1', {
      assetIn: USDC,
      amountInRaw: 100_000000n,
      assetOut: WNEAR,
      amountOutRaw: 199n * 10n ** 24n,
      txHash: '0xsettled',
    });
    expect(inv.availableRaw(WNEAR)).toBe(101n * 10n ** 24n); // 300 - 199, no reservation left
    expect(inv.availableRaw(USDC)).toBe(1_100_000000n);
  });

  it('duplicate reserve for the same quoteId is rejected (no silent overwrite)', () => {
    expect(inv.reserve('q-1', WNEAR, 100n * 10n ** 24n, clock.nowMs + 60_000)).toBe(true);
    expect(inv.reserve('q-1', WNEAR, 100n * 10n ** 24n, clock.nowMs + 60_000)).toBe(false);
    expect(inv.availableRaw(WNEAR)).toBe(200n * 10n ** 24n); // held once, not twice
  });

  it('reservations on one asset do not affect another', () => {
    inv.reserve('q-1', WNEAR, 200n * 10n ** 24n, clock.nowMs + 60_000);
    expect(inv.availableRaw(USDC)).toBe(1_000_000000n);
  });
});
