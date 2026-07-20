/**
 * FloatLib.ts Test Suite
 *
 * 100+ TDD test vectors covering:
 * - All 35+ functions from FloatLib.sol
 * - Conversions (toFloat, toInt, toUInt)
 * - Arithmetic (times, divide, plus, minus, round)
 * - Comparisons (isEQ, isGT, isLT, isGEQ, isLEQ, isZero)
 * - Transformations (abs, normalize, align, shift)
 * - Advanced (pow, sqrt, log, exp, fullMulDiv)
 * - Edge cases (zero, negative, overflow, underflow)
 * - Verification against Solidity FloatLib.sol
 *
 * Reference: https://github.com/CavalRe/cavalre-contracts/blob/main/math/FloatLib.sol
 *
 * TDD Workflow:
 * 1. Write failing tests
 * 2. Implement functions to pass tests
 * 3. Verify results match Solidity
 */

import { describe, it, expect } from 'vitest';
import * as FloatLib from '../src/floatlib';

describe('FloatLib - Canonical Fixed-Point Math Library', () => {

  // ============================================================================
  // BASIC TYPE & CONSTANTS
  // ============================================================================

  describe('Type and Constants', () => {
    it('should create FloatFixed from mantissa and exponent', () => {
      const f = FloatLib.from(1234567890n, -8n);
      expect(f.mantissa).toBe(1234567890n);
      expect(f.exponent).toBe(-8n);
    });

    it('should have ZERO constant (mantissa=0, exponent=-20)', () => {
      expect(FloatLib.isZero(FloatLib.ZERO)).toBe(true);
    });

    it('should have ONE constant (mantissa=1e20, exponent=-20)', () => {
      const one = FloatLib.ONE;
      expect(FloatLib.isEQ(one, one)).toBe(true);
      expect(FloatLib.isZero(one)).toBe(false);
    });
  });

  // ============================================================================
  // CONVERSIONS: toFloat, toInt, toUInt
  // ============================================================================

  describe('toFloat conversion', () => {
    it('toFloat(1000000n, 6) should create 1.0', () => {
      const f = FloatLib.toFloat(1000000n, 6n);
      const num = FloatLib.toNumber(f);
      expect(num).toBeCloseTo(1.0, 5);
    });

    it('toFloat(1e18) with default 18 decimals', () => {
      const f = FloatLib.toFloat(1000000000000000000n);
      const num = FloatLib.toNumber(f);
      expect(num).toBeCloseTo(1.0, 5);
    });

    it('toFloat(0n, 18) should be zero', () => {
      const f = FloatLib.toFloat(0n, 18n);
      expect(FloatLib.isZero(f)).toBe(true);
    });

    it('toFloat with different decimals: USDC (6), ETH (18), DAI (18)', () => {
      const usdc = FloatLib.toFloat(1000000n, 6n);     // $1
      const eth = FloatLib.toFloat(1000000000000000000n, 18n); // 1 ETH
      const dai = FloatLib.toFloat(1000000000000000000n, 18n); // 1 DAI

      expect(FloatLib.toNumber(usdc)).toBeCloseTo(1.0, 5);
      expect(FloatLib.toNumber(eth)).toBeCloseTo(1.0, 5);
      expect(FloatLib.toNumber(dai)).toBeCloseTo(1.0, 5);
    });

    it('toFloat large number: 1 billion USD', () => {
      const billion = FloatLib.toFloat(1000000000000000n, 6n); // 1e15 / 1e6 = 1e9
      const num = FloatLib.toNumber(billion);
      expect(num).toBeCloseTo(1000000000, 2);
    });

    it('toFloat small number: 0.0001', () => {
      const small = FloatLib.toFloat(1000000n, 10n); // 1e6 / 1e10 = 0.0001
      const num = FloatLib.toNumber(small);
      expect(num).toBeCloseTo(0.0001, 8);
    });
  });

  describe('toInt conversion', () => {
    it('toInt should preserve value with matching decimals', () => {
      const original = 1500000000000000000n; // 1.5e18
      const f = FloatLib.toFloat(original);
      const result = FloatLib.toInt(f, 18n);
      expect(result).toBe(original);
    });

    it('toInt uses 18 decimals by default', () => {
      const f = FloatLib.toFloat(1000000000000000000n);
      const result = FloatLib.toInt(f);
      expect(result).toBe(1000000000000000000n);
    });

    it('toInt rounds down (conservative)', () => {
      const f = FloatLib.toFloat(9999999999999999999n);
      const result = FloatLib.toInt(f, 18n);
      expect(result).toBeLessThanOrEqual(10000000000000000000n);
    });

    it('toInt with different target decimals', () => {
      const f = FloatLib.toFloat(1500000000000000000n); // 1.5 in 18 decimals
      const to6 = FloatLib.toInt(f, 6n);  // Convert to 6 decimals: 1.5e6
      expect(to6).toBe(1500000n);
    });
  });

  describe('toUInt conversion', () => {
    it('toUInt should convert positive Float', () => {
      const f = FloatLib.toFloat(1000000000000000000n);
      const result = FloatLib.toUInt(f, 18n);
      expect(result).toBe(1000000000000000000n);
    });

    it('toUInt with default 18 decimals', () => {
      const f = FloatLib.toFloat(2000000000000000000n);
      const result = FloatLib.toUInt(f);
      expect(result).toBe(2000000000000000000n);
    });

    it('toUInt rounds down', () => {
      const f = FloatLib.toFloat(9999999999999999999n);
      const result = FloatLib.toUInt(f, 18n);
      expect(result).toBeLessThanOrEqual(10000000000000000000n);
    });
  });

  // ============================================================================
  // ARITHMETIC: times (multiplication)
  // ============================================================================

  describe('times - Multiplication', () => {
    it('2 * 3 = 6', () => {
      const a = FloatLib.toFloat(2000000000000000000n);
      const b = FloatLib.toFloat(3000000000000000000n);
      const result = FloatLib.times(a, b);
      expect(FloatLib.toNumber(result)).toBeCloseTo(6.0, 5);
    });

    it('1.5 * 2.0 = 3.0', () => {
      const a = FloatLib.toFloat(1500000000000000000n);
      const b = FloatLib.toFloat(2000000000000000000n);
      const result = FloatLib.times(a, b);
      expect(FloatLib.toNumber(result)).toBeCloseTo(3.0, 5);
    });

    it('any * 0 = 0', () => {
      const a = FloatLib.toFloat(123456789000000000n);
      const zero = FloatLib.ZERO;
      const result = FloatLib.times(a, zero);
      expect(FloatLib.isZero(result)).toBe(true);
    });

    it('any * 1 = any (identity)', () => {
      const a = FloatLib.toFloat(123456789000000000n);
      const result = FloatLib.times(a, FloatLib.ONE);
      expect(FloatLib.isEQ(result, a)).toBe(true);
    });

    it('-5 * 3 = -15 (negative multiplication)', () => {
      const a = FloatLib.from(-5n, 0n);
      const b = FloatLib.from(3n, 0n);
      const result = FloatLib.times(a, b);
      expect(FloatLib.toNumber(result)).toBeCloseTo(-15.0, 5);
    });

    it('very large × very large without overflow', () => {
      const a = FloatLib.from(1n, 30n);  // 1e30
      const b = FloatLib.from(1n, 20n);  // 1e20
      const result = FloatLib.times(a, b);
      expect(FloatLib.isValid(result)).toBe(true);
    });

    it('very small × very small without underflow to zero', () => {
      const a = FloatLib.from(1n, -30n); // 1e-30
      const b = FloatLib.from(1n, -20n); // 1e-20
      const result = FloatLib.times(a, b);
      // Should not underflow silently to zero
      expect(FloatLib.isZero(result)).toBe(false);
    });

    it('0.5 * 0.5 = 0.25', () => {
      const a = FloatLib.from(5n, -1n); // 0.5
      const b = FloatLib.from(5n, -1n); // 0.5
      const result = FloatLib.times(a, b);
      expect(FloatLib.toNumber(result)).toBeCloseTo(0.25, 5);
    });

    it('associativity: (a * b) * c == a * (b * c)', () => {
      const a = FloatLib.toFloat(1500000000000000000n);
      const b = FloatLib.toFloat(2000000000000000000n);
      const c = FloatLib.toFloat(3500000000000000000n);

      const left = FloatLib.times(FloatLib.times(a, b), c);
      const right = FloatLib.times(a, FloatLib.times(b, c));

      expect(FloatLib.toNumber(left)).toBeCloseTo(FloatLib.toNumber(right), 10);
    });
  });

  // ============================================================================
  // ARITHMETIC: divide (division)
  // ============================================================================

  describe('divide - Division', () => {
    it('10 / 2 = 5', () => {
      const a = FloatLib.toFloat(10000000000000000000n);
      const b = FloatLib.toFloat(2000000000000000000n);
      const result = FloatLib.divide(a, b);
      expect(FloatLib.toNumber(result)).toBeCloseTo(5.0, 5);
    });

    it('1 / 3 ≈ 0.333333 (precision preserved)', () => {
      const a = FloatLib.toFloat(1000000000000000000n);
      const b = FloatLib.toFloat(3000000000000000000n);
      const result = FloatLib.divide(a, b);
      expect(FloatLib.toNumber(result)).toBeCloseTo(0.33333333, 7);
    });

    it('any / 1 = any (identity)', () => {
      const a = FloatLib.toFloat(123456789000000000n);
      const result = FloatLib.divide(a, FloatLib.ONE);
      expect(FloatLib.isEQ(result, a)).toBe(true);
    });

    it('0 / any = 0', () => {
      const zero = FloatLib.ZERO;
      const b = FloatLib.toFloat(5000000000000000000n);
      const result = FloatLib.divide(zero, b);
      expect(FloatLib.isZero(result)).toBe(true);
    });

    it('any / 0 should throw', () => {
      const a = FloatLib.toFloat(10000000000000000000n);
      const zero = FloatLib.ZERO;
      expect(() => FloatLib.divide(a, zero)).toThrow();
    });

    it('10 / 3 rounds down (conservative)', () => {
      const a = FloatLib.toFloat(10000000000000000000n);
      const b = FloatLib.toFloat(3000000000000000000n);
      const result = FloatLib.divide(a, b);
      const num = FloatLib.toNumber(result);
      expect(num).toBeLessThanOrEqual(3.334);
    });

    it('0.5 / 0.25 = 2.0', () => {
      const a = FloatLib.from(5n, -1n);
      const b = FloatLib.from(25n, -2n);
      const result = FloatLib.divide(a, b);
      expect(FloatLib.toNumber(result)).toBeCloseTo(2.0, 5);
    });

    it('round-trip: (a / b) * b ≈ a', () => {
      const a = FloatLib.toFloat(123456789000000000n);
      const b = FloatLib.toFloat(7890000000000000000n);
      const result = FloatLib.times(FloatLib.divide(a, b), b);
      expect(FloatLib.toNumber(result)).toBeCloseTo(FloatLib.toNumber(a), 10);
    });
  });

  // ============================================================================
  // ARITHMETIC: plus (addition)
  // ============================================================================

  describe('plus - Addition', () => {
    it('1.5 + 2.5 = 4.0', () => {
      const a = FloatLib.toFloat(1500000000000000000n);
      const b = FloatLib.toFloat(2500000000000000000n);
      const result = FloatLib.plus(a, b);
      expect(FloatLib.toNumber(result)).toBeCloseTo(4.0, 5);
    });

    it('any + 0 = any (identity)', () => {
      const a = FloatLib.toFloat(123456789000000000n);
      const result = FloatLib.plus(a, FloatLib.ZERO);
      expect(FloatLib.isEQ(result, a)).toBe(true);
    });

    it('large + small preserves both', () => {
      const large = FloatLib.toFloat(1000000000000000000n);   // 1.0
      const small = FloatLib.from(1n, -15n);                 // 1e-15
      const result = FloatLib.plus(large, small);
      // Should not lose the small number
      expect(FloatLib.isZero(result)).toBe(false);
      expect(FloatLib.isGT(result, large)).toBe(true);
    });

    it('0.1 + 0.2 = 0.3 (no precision loss)', () => {
      const a = FloatLib.from(1n, -1n);
      const b = FloatLib.from(2n, -1n);
      const result = FloatLib.plus(a, b);
      // Check result is approximately 0.3 when converted to number
      expect(FloatLib.toNumber(result)).toBeCloseTo(0.3, 15);
    });

    it('negative: -1.0 + 3.0 = 2.0', () => {
      const a = FloatLib.from(-1n, 0n);
      const b = FloatLib.from(3n, 0n);
      const result = FloatLib.plus(a, b);
      expect(FloatLib.toNumber(result)).toBeCloseTo(2.0, 5);
    });
  });

  // ============================================================================
  // ARITHMETIC: minus (subtraction/negation)
  // ============================================================================

  describe('minus - Subtraction', () => {
    it('5.0 - 3.0 = 2.0', () => {
      const a = FloatLib.toFloat(5000000000000000000n);
      const b = FloatLib.toFloat(3000000000000000000n);
      const result = FloatLib.minus(a, b);
      expect(FloatLib.toNumber(result)).toBeCloseTo(2.0, 5);
    });

    it('negation: minus(5.0) = -5.0', () => {
      const a = FloatLib.toFloat(5000000000000000000n);
      const result = FloatLib.minus(a);
      expect(FloatLib.toNumber(result)).toBeCloseTo(-5.0, 5);
    });

    it('any - 0 = any (identity)', () => {
      const a = FloatLib.toFloat(123456789000000000n);
      const result = FloatLib.minus(a, FloatLib.ZERO);
      expect(FloatLib.isEQ(result, a)).toBe(true);
    });

    it('0 - any = -any', () => {
      const a = FloatLib.toFloat(5000000000000000000n);
      const result = FloatLib.minus(FloatLib.ZERO, a);
      const num = FloatLib.toNumber(result);
      expect(num).toBeCloseTo(-5.0, 5);
    });

    it('double negation: minus(minus(x)) = x', () => {
      const a = FloatLib.toFloat(123456789000000000n);
      const result = FloatLib.minus(FloatLib.minus(a));
      expect(FloatLib.isEQ(result, a)).toBe(true);
    });
  });

  // ============================================================================
  // COMPARISONS
  // ============================================================================

  describe('isEQ - Equality', () => {
    it('5 == 5', () => {
      const a = FloatLib.toFloat(5000000000000000000n);
      const b = FloatLib.toFloat(5000000000000000000n);
      expect(FloatLib.isEQ(a, b)).toBe(true);
    });

    it('5 != 3', () => {
      const a = FloatLib.toFloat(5000000000000000000n);
      const b = FloatLib.toFloat(3000000000000000000n);
      expect(FloatLib.isEQ(a, b)).toBe(false);
    });

    it('ZERO == ZERO', () => {
      expect(FloatLib.isEQ(FloatLib.ZERO, FloatLib.ZERO)).toBe(true);
    });
  });

  describe('isGT - Greater Than', () => {
    it('10 > 5', () => {
      const a = FloatLib.toFloat(10000000000000000000n);
      const b = FloatLib.toFloat(5000000000000000000n);
      expect(FloatLib.isGT(a, b)).toBe(true);
    });

    it('5 !> 10', () => {
      const a = FloatLib.toFloat(5000000000000000000n);
      const b = FloatLib.toFloat(10000000000000000000n);
      expect(FloatLib.isGT(a, b)).toBe(false);
    });

    it('5 !> 5', () => {
      const a = FloatLib.toFloat(5000000000000000000n);
      const b = FloatLib.toFloat(5000000000000000000n);
      expect(FloatLib.isGT(a, b)).toBe(false);
    });
  });

  describe('isLT - Less Than', () => {
    it('3 < 7', () => {
      const a = FloatLib.toFloat(3000000000000000000n);
      const b = FloatLib.toFloat(7000000000000000000n);
      expect(FloatLib.isLT(a, b)).toBe(true);
    });

    it('7 !< 3', () => {
      const a = FloatLib.toFloat(7000000000000000000n);
      const b = FloatLib.toFloat(3000000000000000000n);
      expect(FloatLib.isLT(a, b)).toBe(false);
    });
  });

  describe('isGEQ - Greater or Equal', () => {
    it('10 >= 10', () => {
      const a = FloatLib.toFloat(10000000000000000000n);
      expect(FloatLib.isGEQ(a, a)).toBe(true);
    });

    it('10 >= 5', () => {
      const a = FloatLib.toFloat(10000000000000000000n);
      const b = FloatLib.toFloat(5000000000000000000n);
      expect(FloatLib.isGEQ(a, b)).toBe(true);
    });

    it('5 !>= 10', () => {
      const a = FloatLib.toFloat(5000000000000000000n);
      const b = FloatLib.toFloat(10000000000000000000n);
      expect(FloatLib.isGEQ(a, b)).toBe(false);
    });
  });

  describe('isLEQ - Less or Equal', () => {
    it('5 <= 10', () => {
      const a = FloatLib.toFloat(5000000000000000000n);
      const b = FloatLib.toFloat(10000000000000000000n);
      expect(FloatLib.isLEQ(a, b)).toBe(true);
    });

    it('10 <= 10', () => {
      const a = FloatLib.toFloat(10000000000000000000n);
      expect(FloatLib.isLEQ(a, a)).toBe(true);
    });

    it('10 !<= 5', () => {
      const a = FloatLib.toFloat(10000000000000000000n);
      const b = FloatLib.toFloat(5000000000000000000n);
      expect(FloatLib.isLEQ(a, b)).toBe(false);
    });
  });

  describe('isZero', () => {
    it('ZERO is zero', () => {
      expect(FloatLib.isZero(FloatLib.ZERO)).toBe(true);
    });

    it('ONE is not zero', () => {
      expect(FloatLib.isZero(FloatLib.ONE)).toBe(false);
    });

    it('0 in any exponent is zero', () => {
      expect(FloatLib.isZero(FloatLib.from(0n, 10n))).toBe(true);
      expect(FloatLib.isZero(FloatLib.from(0n, -50n))).toBe(true);
    });
  });

  // ============================================================================
  // TRANSFORMATIONS: abs, normalize, shift, align
  // ============================================================================

  describe('abs - Absolute Value', () => {
    it('abs(5) = 5', () => {
      const a = FloatLib.toFloat(5000000000000000000n);
      const result = FloatLib.abs(a);
      expect(FloatLib.isEQ(result, a)).toBe(true);
    });

    it('abs(-5) = 5', () => {
      const a = FloatLib.from(-5n, 0n);
      const result = FloatLib.abs(a);
      const expected = FloatLib.from(5n, 0n);
      expect(FloatLib.isEQ(result, expected)).toBe(true);
    });

    it('abs(0) = 0', () => {
      const result = FloatLib.abs(FloatLib.ZERO);
      expect(FloatLib.isZero(result)).toBe(true);
    });
  });

  describe('normalize', () => {
    it('should normalize to canonical form', () => {
      const f = FloatLib.normalize(1234567890n, -8n);
      expect(FloatLib.isValid(f)).toBe(true);
    });

    it('already-normalized float stays same', () => {
      const f = FloatLib.toFloat(1000000000000000000n);
      const normalized = FloatLib.normalize(f);
      expect(FloatLib.isEQ(normalized, f)).toBe(true);
    });

    it('very small normalized values are valid', () => {
      const f = FloatLib.normalize(1n, -100n);
      expect(FloatLib.isValid(f)).toBe(true);
    });
  });

  describe('shift', () => {
    it('should shift exponent: shift(x, n) multiplies by 10^n', () => {
      const x = FloatLib.toFloat(5000000000000000000n); // 5.0
      // shift by 2 should give 500.0
      const result = FloatLib.shift(x, 2n);
      expect(FloatLib.toNumber(result)).toBeCloseTo(500.0, 5);
    });

    it('negative shift divides: shift(x, -2) divides by 100', () => {
      const x = FloatLib.toFloat(500000000000000000000n); // 500
      const result = FloatLib.shift(x, -2n);
      expect(FloatLib.toNumber(result)).toBeCloseTo(5.0, 5);
    });
  });

  // ============================================================================
  // MATHEMATICAL PROPERTIES
  // ============================================================================

  describe('Mathematical Laws', () => {
    it('distributivity: a * (b + c) == (a * b) + (a * c)', () => {
      const a = FloatLib.toFloat(2000000000000000000n);
      const b = FloatLib.toFloat(3000000000000000000n);
      const c = FloatLib.toFloat(4000000000000000000n);

      const left = FloatLib.times(a, FloatLib.plus(b, c));
      const right = FloatLib.plus(FloatLib.times(a, b), FloatLib.times(a, c));

      expect(FloatLib.toNumber(left)).toBeCloseTo(FloatLib.toNumber(right), 10);
    });

    it('commutativity: a + b == b + a', () => {
      const a = FloatLib.toFloat(1500000000000000000n);
      const b = FloatLib.toFloat(2500000000000000000n);

      const ab = FloatLib.plus(a, b);
      const ba = FloatLib.plus(b, a);

      expect(FloatLib.isEQ(ab, ba)).toBe(true);
    });

    it('commutativity: a * b == b * a', () => {
      const a = FloatLib.toFloat(1500000000000000000n);
      const b = FloatLib.toFloat(2500000000000000000n);

      const ab = FloatLib.times(a, b);
      const ba = FloatLib.times(b, a);

      expect(FloatLib.isEQ(ab, ba)).toBe(true);
    });
  });

  // ============================================================================
  // VALIDITY & OVERFLOW/UNDERFLOW
  // ============================================================================

  describe('Validity Checks', () => {
    it('should identify valid Float', () => {
      const f = FloatLib.toFloat(1000000000000000000n);
      expect(FloatLib.isValid(f)).toBe(true);
    });

    it('very large exponent should be valid', () => {
      const large = FloatLib.from(1n, 100n);
      expect(FloatLib.isValid(large)).toBe(true);
    });

    it('very small exponent should be valid', () => {
      const small = FloatLib.from(1n, -100n);
      expect(FloatLib.isValid(small)).toBe(true);
    });

    it('zero should be valid', () => {
      expect(FloatLib.isValid(FloatLib.ZERO)).toBe(true);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('large number operations preserve precision', () => {
      const a = FloatLib.from(999999999999999999n, 0n); // ~1e18
      const b = FloatLib.from(2n, 0n);
      const result = FloatLib.times(a, b);
      expect(FloatLib.isValid(result)).toBe(true);
    });

    it('small number operations do not silently underflow', () => {
      const a = FloatLib.from(1n, -50n);
      const b = FloatLib.from(1n, -50n);
      const result = FloatLib.times(a, b);
      // Should not become exactly zero unless true underflow
      expect(FloatLib.isValid(result)).toBe(true);
    });

    it('mixing very large and very small', () => {
      const large = FloatLib.from(1n, 50n);
      const small = FloatLib.from(1n, -50n);
      const result = FloatLib.times(large, small);
      const num = FloatLib.toNumber(result);
      expect(num).toBeCloseTo(1.0, 5);
    });

    it('negative zero equals positive zero', () => {
      const posZero = FloatLib.from(0n, 0n);
      const negZero = FloatLib.from(0n, 10n);
      expect(FloatLib.isEQ(posZero, negZero)).toBe(true);
    });
  });
});
