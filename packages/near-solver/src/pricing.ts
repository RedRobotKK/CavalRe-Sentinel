/**
 * QUOTE PRICING
 *
 * All money math runs through CavalRe FloatLib (arbitrary-precision BigInt
 * floats) — never JavaScript Number. Conversions back to raw token units are
 * ALWAYS rounded in the solver's favor:
 *   - exact-in  (we choose amountOut): FLOOR — never pay out a unit too many
 *   - exact-out (we choose amountIn):  CEIL  — never charge a unit too few
 *
 * Spread is expressed in basis points and applied against the taker.
 */

import * as FloatLib from '@cavalre/floatlib-ts';

const BPS_DECIMALS = 4n; // 1 bps = 10^-4

/**
 * Raw token units -> FloatFixed for ANY decimals.
 * FloatLib.toFloat throws for decimals > 21 (e.g. wNEAR's 24) because it
 * computes 10^(21 - decimals); normalize(mantissa, exponent) has no such
 * limit, so all raw-unit conversion in this package goes through here.
 */
export function rawToFloat(valueRaw: bigint, decimals: bigint): FloatLib.FloatFixed {
  if (valueRaw === 0n) return FloatLib.ZERO;
  return FloatLib.normalize(valueRaw, -decimals);
}

export function bpsToFraction(bps: number): FloatLib.FloatFixed {
  if (!Number.isInteger(bps) || bps < 0) {
    throw new Error(`spread bps must be a non-negative integer, got ${bps}`);
  }
  if (bps === 0) return FloatLib.ZERO;
  return FloatLib.toFloat(BigInt(bps), BPS_DECIMALS);
}

/**
 * FloatFixed -> raw token units, rounding DOWN.
 * Exact when the value has no sub-unit fraction.
 */
export function floorToRaw(f: FloatLib.FloatFixed, decimals: bigint): bigint {
  return convertToRaw(f, decimals, 'floor');
}

/** FloatFixed -> raw token units, rounding UP. */
export function ceilToRaw(f: FloatLib.FloatFixed, decimals: bigint): bigint {
  return convertToRaw(f, decimals, 'ceil');
}

function convertToRaw(f: FloatLib.FloatFixed, decimals: bigint, mode: 'floor' | 'ceil'): bigint {
  const [mantissa, exponent] = FloatLib.components(f);
  if (mantissa === 0n) return 0n;
  if (mantissa < 0n) throw new Error('negative amounts cannot convert to raw token units');

  const shift = exponent + decimals; // raw = mantissa * 10^shift
  if (shift >= 0n) {
    return mantissa * 10n ** shift;
  }
  const divisor = 10n ** -shift;
  const quotient = mantissa / divisor;
  const remainder = mantissa % divisor;
  if (remainder === 0n) return quotient;
  return mode === 'floor' ? quotient : quotient + 1n;
}

export interface ExactInParams {
  amountInRaw: bigint;
  decimalsIn: bigint;
  decimalsOut: bigint;
  /** Mid price: units of tokenOut per unit of tokenIn. */
  mid: FloatLib.FloatFixed;
  /** Half-spread + inventory skew, in basis points, charged to the taker. */
  totalSpreadBps: number;
}

/** Price an exact-in request: how much tokenOut do we pay for amountIn? */
export function priceExactIn(p: ExactInParams): bigint {
  if (p.amountInRaw === 0n) return 0n;
  const amountIn = rawToFloat(p.amountInRaw, p.decimalsIn);
  const gross = FloatLib.times(amountIn, p.mid);
  const discount = FloatLib.minus(FloatLib.ONE, bpsToFraction(p.totalSpreadBps));
  const net = FloatLib.times(gross, discount);
  return floorToRaw(net, p.decimalsOut);
}

export interface ExactOutParams {
  amountOutRaw: bigint;
  decimalsIn: bigint;
  decimalsOut: bigint;
  mid: FloatLib.FloatFixed;
  totalSpreadBps: number;
}

/** Price an exact-out request: how much tokenIn do we require to pay amountOut? */
export function priceExactOut(p: ExactOutParams): bigint {
  if (p.amountOutRaw === 0n) return 0n;
  const amountOut = rawToFloat(p.amountOutRaw, p.decimalsOut);
  const gross = FloatLib.divide(amountOut, p.mid);
  const markup = FloatLib.plus(FloatLib.ONE, bpsToFraction(p.totalSpreadBps));
  const net = FloatLib.times(gross, markup);
  return ceilToRaw(net, p.decimalsIn);
}

/**
 * Inventory skew in bps: widens the spread linearly with how much of our
 * available inventory this single quote would consume. utilization in [0,1].
 */
export function inventorySkewBps(params: {
  amountOutRaw: bigint;
  availableRaw: bigint;
  maxSkewBps: number;
}): number {
  if (params.availableRaw <= 0n) return params.maxSkewBps;
  if (params.amountOutRaw >= params.availableRaw) return params.maxSkewBps;
  // utilization with 4 decimal places of precision, then scale to bps
  const utilizationBps = Number((params.amountOutRaw * 10_000n) / params.availableRaw);
  return Math.min(
    params.maxSkewBps,
    Math.ceil((utilizationBps / 10_000) * params.maxSkewBps)
  );
}
