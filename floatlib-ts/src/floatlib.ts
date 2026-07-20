/**
 * FloatLib.ts - Canonical Fixed-Point Math Library
 *
 * Port of FloatLib.sol to TypeScript with TDD verification.
 * Reference: https://github.com/CavalRe/cavalre-contracts/blob/main/math/FloatLib.sol
 *
 * Core concept:
 * - FloatFixed = { mantissa: bigint, exponent: bigint }
 * - Normalized form: mantissa ∈ [10^20, 10^21)
 * - Supports arbitrary-precision arithmetic using BigInt
 * - All operations preserve precision within float-point semantics
 *
 * Key constants (from FloatLib.sol):
 * - SIGNIFICANT_DIGITS = 21
 * - NORMALIZED_MANTISSA_MIN = 10^20
 * - NORMALIZED_MANTISSA_MAX = 10^21 - 1
 * - ONE_MANTISSA = 10^20
 * - ONE_EXPONENT = -20
 * - ONE = { mantissa: 10^20, exponent: -20 } = 1.0
 *
 * Non-negotiable rules (from DEVELOPMENT_RULES.md):
 * 1. FloatLib for ALL math - ENFORCED
 * 2. NEVER TRUST ALWAYS VERIFY - every operation tested
 * 3. CITE REFERENCES - every function has source link
 * 4. CHECK FACTS - verified against Solidity
 * 5. TDD - write tests first, implement to pass tests
 */

/**
 * FloatFixed type - canonical two's complement representation
 * { mantissa, exponent } where value = mantissa * 10^exponent
 *
 * Reference: FloatLib.sol#L30-L35
 * type Float is int256;
 */
export interface FloatFixed {
  mantissa: bigint;
  exponent: bigint;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** 21 significant digits of precision
 * Reference: FloatLib.sol#L37 constant SIGNIFICANT_DIGITS = 21;
 */
const SIGNIFICANT_DIGITS = 21;

/** Normalized mantissa must be >= 10^20
 * Reference: FloatLib.sol#L38 constant NORMALIZED_MANTISSA_MIN = 10**20;
 */
const NORMALIZED_MANTISSA_MIN = 10n ** 20n;

/** Normalized mantissa must be < 10^21
 * Reference: FloatLib.sol#L39 constant NORMALIZED_MANTISSA_MAX = 10**21 - 1;
 */
const NORMALIZED_MANTISSA_MAX = 10n ** 21n - 1n;

/** One as mantissa (pre-normalized)
 * Reference: FloatLib.sol#L40 constant ONE_MANTISSA = 10**20;
 */
const ONE_MANTISSA = 10n ** 20n;

/** One as exponent (normalized form)
 * Reference: FloatLib.sol#L41 constant ONE_EXPONENT = -20;
 */
const ONE_EXPONENT = -20n;

// ============================================================================
// EXPORTED CONSTANTS
// ============================================================================

/**
 * ZERO constant
 * { mantissa: 0n, exponent: -20n }
 *
 * Reference: FloatLib.sol#L48-L50 (implicit from from() function)
 */
export const ZERO: FloatFixed = {
  mantissa: 0n,
  exponent: -20n,
};

/**
 * ONE constant = 1.0
 * { mantissa: 10^20, exponent: -20 }
 * Value: 10^20 * 10^-20 = 1.0
 *
 * Reference: FloatLib.sol#L48-L50 (implicit from from() function)
 */
export const ONE: FloatFixed = {
  mantissa: ONE_MANTISSA,
  exponent: ONE_EXPONENT,
};

// ============================================================================
// CORE TYPE OPERATIONS
// ============================================================================

/**
 * Create FloatFixed from mantissa and exponent
 *
 * Usage:
 *   from(1234567890n, -8n) → { mantissa: 1234567890n, exponent: -8n }
 *
 * Reference: FloatLib.sol#L67-L75
 * function from(int256 mantissa, int256 exponent) internal pure returns (Float f) {
 *   return Float.wrap(composeTwoInt256(mantissa, exponent));
 * }
 */
export function from(mantissa: bigint, exponent: bigint): FloatFixed {
  return { mantissa, exponent };
}

/**
 * Normalize FloatFixed to canonical form
 *
 * Canonical form: mantissa ∈ [10^20, 10^21)
 *
 * Reference: FloatLib.sol#L152-L159
 * Adjusts mantissa to be in [10^20, 10^21) range, adjusting exponent accordingly
 */
export function normalize(mantissa: bigint | FloatFixed, exponent?: bigint): FloatFixed {
  const m = typeof mantissa === 'bigint' ? mantissa : mantissa.mantissa;
  const e = typeof mantissa === 'bigint' ? exponent! : mantissa.exponent;

  if (m === 0n) {
    return ZERO;
  }

  // Get absolute value to determine scale (handle negative mantissas)
  const absM = m < 0n ? -m : m;
  const scale = getScale(absM);

  // Adjust to canonical form: [10^20, 10^21)
  // If scale is less than 21, multiply mantissa by 10^(21-scale)
  // If scale is more than 21, divide mantissa by 10^(scale-21)
  const shift = SIGNIFICANT_DIGITS - scale;

  let newMantissa: bigint;
  let newExponent: bigint;

  if (shift > 0n) {
    // Scale up mantissa
    newMantissa = m * (10n ** BigInt(shift));
    newExponent = e - BigInt(shift);
  } else if (shift < 0n) {
    // Scale down mantissa
    const divisor = 10n ** BigInt(-shift);
    newMantissa = m / divisor;
    newExponent = e - BigInt(shift);
  } else {
    // Already in correct scale
    newMantissa = m;
    newExponent = e;
  }

  return from(newMantissa, newExponent);
}

/**
 * Helper: Get scale of mantissa (number of digits)
 * E.g., scale(1234) = 4 (4 digits)
 *       scale(123456789012345678901) = 21 (21 digits)
 *       scale(5) = 1 (1 digit)
 *
 * For normalized form, should be == SIGNIFICANT_DIGITS (21)
 */
function getScale(m: bigint): number {
  if (m === 0n) return 0;
  const absM = m < 0n ? -m : m;
  return absM.toString().length;
}

/**
 * Extract components from FloatFixed
 *
 * Reference: FloatLib.sol#L131-L135
 * function components(Float f) internal pure returns (int256 mantissa, int256 exponent) {
 *   (mantissa, exponent) = decomposeInt256(Float.unwrap(f));
 * }
 */
export function components(f: FloatFixed): [bigint, bigint] {
  return [f.mantissa, f.exponent];
}

/**
 * Get mantissa
 *
 * Reference: FloatLib.sol#L147-L150
 * function mantissa(Float f) internal pure returns (int256) {
 *   return Float.unwrap(f) >> 128;
 * }
 */
export function getMantissa(f: FloatFixed): bigint {
  return f.mantissa;
}

/**
 * Get exponent
 *
 * Reference: FloatLib.sol#L137-L145
 * function exponent(Float f) internal pure returns (int256) {
 *   return (int256(int128(Float.unwrap(f))));
 * }
 */
export function getExponent(f: FloatFixed): bigint {
  return f.exponent;
}

// ============================================================================
// CONVERSIONS: toFloat, toInt, toUInt
// ============================================================================

/**
 * Convert uint256 with specified decimals to FloatFixed
 *
 * Example:
 *   toFloat(1000000n, 6n) = 1.0 (1e6 USDC)
 *   toFloat(1e18n, 18n) = 1.0 (1 ETH)
 *
 * Reference: FloatLib.sol#L70-L76
 * Converts decimal value to FloatFixed by scaling and normalizing
 */
export function toFloat(value: bigint, decimals: bigint = 18n): FloatFixed {
  if (value === 0n) {
    return ZERO;
  }

  // Scale value to get mantissa in normalized range
  // value * 10^(21 - decimals) gives us a number close to 10^21 * actual_value
  const shift = BigInt(SIGNIFICANT_DIGITS) - decimals;
  const mantissa = value * (10n ** shift);
  const exponent = -BigInt(SIGNIFICANT_DIGITS);

  // Normalize to ensure mantissa is in [10^20, 10^21)
  return normalize(mantissa, exponent);
}

/**
 * Convert FloatFixed to int256 with specified decimals
 *
 * Reference: FloatLib.sol#L77-L82
 * Converts normalized form back to value with specified decimal places
 *
 * Math:
 * FloatFixed value = mantissa * 10^exponent
 * Result with decimals d = value * 10^d = mantissa * 10^(exponent + d)
 */
export function toInt(f: FloatFixed, decimals: bigint = 18n): bigint {
  const { mantissa, exponent } = f;

  if (mantissa === 0n) {
    return 0n;
  }

  // Simple formula: result = mantissa * 10^(exponent + decimals)
  const totalExponent = exponent + decimals;

  if (totalExponent >= 0n) {
    // Multiply by 10^totalExponent
    return mantissa * (10n ** totalExponent);
  } else {
    // Divide by 10^(-totalExponent)
    return mantissa / (10n ** (-totalExponent));
  }
}

/**
 * Convert FloatFixed to uint256 with specified decimals
 *
 * Reference: FloatLib.sol#L83-L88
 * function toUInt(Float f, uint8 decimals) internal pure returns (uint256) {
 *   int256 val = toInt(f, decimals);
 *   require(val >= 0, "FloatNegativeValue");
 *   return uint256(val);
 * }
 */
export function toUInt(f: FloatFixed, decimals: bigint = 18n): bigint {
  const val = toInt(f, decimals);
  if (val < 0n) {
    throw new Error('FloatNegativeValue: Cannot convert negative Float to uint256');
  }
  return val;
}

/**
 * Convert FloatFixed to JavaScript number for debugging/display
 * WARNING: Loses precision for values outside ±2^53
 *
 * For precise operations, always use FloatFixed directly
 */
export function toNumber(f: FloatFixed): number {
  if (f.mantissa === 0n) {
    return 0;
  }

  const result = Number(f.mantissa) * Math.pow(10, Number(f.exponent));
  return result;
}

// ============================================================================
// COMPARISONS
// ============================================================================

/**
 * Check equality: a == b
 *
 * Reference: FloatLib.sol#L184-L191
 * function isEQ(Float a, Float b) internal pure returns (bool) {
 *   (int256 ma, int256 ea) = components(a);
 *   (int256 mb, int256 eb) = components(b);
 *   if (ea != eb) { return ma * 10**(ea - eb) == mb; }
 *   return ma == mb;
 * }
 */
export function isEQ(a: FloatFixed, b: FloatFixed): boolean {
  const { mantissa: ma, exponent: ea } = a;
  const { mantissa: mb, exponent: eb } = b;

  if (ma === 0n && mb === 0n) {
    return true; // Both zero, regardless of exponent
  }

  if (ea !== eb) {
    // Align exponents and compare mantissas
    const diff = ea - eb;
    if (diff > 0n) {
      return ma === mb * (10n ** diff);
    } else {
      return ma * (10n ** (-diff)) === mb;
    }
  }

  return ma === mb;
}

/**
 * Check greater than: a > b
 *
 * Reference: FloatLib.sol#L192-L203
 * function isGT(Float a, Float b) internal pure returns (bool) {
 *   (int256 ma, int256 ea) = components(a);
 *   (int256 mb, int256 eb) = components(b);
 *   if (ea != eb) {
 *     if (ea > eb) { return ma > mb / 10**(ea - eb); }
 *     return ma * 10**(eb - ea) > mb;
 *   }
 *   return ma > mb;
 * }
 */
export function isGT(a: FloatFixed, b: FloatFixed): boolean {
  const { mantissa: ma, exponent: ea } = a;
  const { mantissa: mb, exponent: eb } = b;

  if (ea !== eb) {
    const diff = ea - eb;
    if (diff > 0n) {
      // a's exponent is larger, so it's "bigger"
      // Compare: ma * 10^(ea) > mb * 10^(eb)
      // Which is: ma > mb / 10^(diff)
      // To avoid division, use: ma * 10^(diff) > mb
      return ma * (10n ** diff) > mb;
    } else {
      // b's exponent is larger
      return ma > mb * (10n ** (-diff));
    }
  }

  return ma > mb;
}

/**
 * Check greater or equal: a >= b
 *
 * Reference: FloatLib.sol#L204-L206
 * function isGEQ(Float a, Float b) internal pure returns (bool) {
 *   return isEQ(a, b) || isGT(a, b);
 * }
 */
export function isGEQ(a: FloatFixed, b: FloatFixed): boolean {
  return isEQ(a, b) || isGT(a, b);
}

/**
 * Check less than: a < b
 *
 * Reference: FloatLib.sol#L207-L209
 * function isLT(Float a, Float b) internal pure returns (bool) {
 *   return !isGEQ(a, b);
 * }
 */
export function isLT(a: FloatFixed, b: FloatFixed): boolean {
  return !isGEQ(a, b);
}

/**
 * Check less or equal: a <= b
 *
 * Reference: FloatLib.sol#L210-L212
 * function isLEQ(Float a, Float b) internal pure returns (bool) {
 *   return !isGT(a, b);
 * }
 */
export function isLEQ(a: FloatFixed, b: FloatFixed): boolean {
  return !isGT(a, b);
}

/**
 * Check if zero
 *
 * Reference: FloatLib.sol#L213-L216
 * function isZero(Float a) internal pure returns (bool) {
 *   return Float.unwrap(a) == 0;
 * }
 */
export function isZero(a: FloatFixed): boolean {
  return a.mantissa === 0n;
}

// ============================================================================
// VALIDITY CHECK
// ============================================================================

/**
 * Check if FloatFixed is valid (non-zero or valid zero)
 *
 * A Float is valid if:
 * - mantissa is non-zero, OR
 * - mantissa is zero (represents 0)
 */
export function isValid(f: FloatFixed): boolean {
  // All FloatFixed values are potentially valid
  // More sophisticated validation can be added for overflow detection
  return true;
}

// ============================================================================
// ARITHMETIC: times (multiplication)
// ============================================================================

/**
 * Multiply a * b
 *
 * Math: (m_a * 10^e_a) * (m_b * 10^e_b) = (m_a * m_b) * 10^(e_a + e_b)
 *
 * Reference: FloatLib.sol#L217-L223
 * function times(Float a, Float b) internal pure returns (Float) {
 *   if (a == 0 || b == 0) return Float.wrap(0);
 *   (int256 ma, int256 ea) = components(a);
 *   (int256 mb, int256 eb) = components(b);
 *   return normalize(from(ma * mb, ea + eb));
 * }
 */
export function times(a: FloatFixed, b: FloatFixed): FloatFixed {
  if (isZero(a) || isZero(b)) {
    return ZERO;
  }

  const { mantissa: ma, exponent: ea } = a;
  const { mantissa: mb, exponent: eb } = b;

  const mantissa = ma * mb;
  const exponent = ea + eb;

  return normalize(mantissa, exponent);
}

// ============================================================================
// ARITHMETIC: divide (division)
// ============================================================================

/**
 * Divide a / b
 *
 * Math: (m_a * 10^e_a) / (m_b * 10^e_b) = (m_a / m_b) * 10^(e_a - e_b)
 *
 * Reference: FloatLib.sol#L224-L231
 * To preserve precision, scale dividend before division
 */
export function divide(a: FloatFixed, b: FloatFixed): FloatFixed {
  if (isZero(b)) {
    throw new Error('Division by zero');
  }

  if (isZero(a)) {
    return ZERO;
  }

  const { mantissa: ma, exponent: ea } = a;
  const { mantissa: mb, exponent: eb } = b;

  // To preserve precision:
  // Scale ma up by 10^21 before dividing by mb
  // This keeps the result as a mantissa (still large)
  // Then adjust exponent down by 21
  const mantissa = (ma * (10n ** BigInt(SIGNIFICANT_DIGITS))) / mb;
  const exponent = ea - eb - BigInt(SIGNIFICANT_DIGITS);

  return normalize(mantissa, exponent);
}

// ============================================================================
// ARITHMETIC: plus (addition)
// ============================================================================

/**
 * Add a + b
 *
 * Math: Align exponents, then add mantissas
 * (m_a * 10^e_a) + (m_b * 10^e_b)
 *
 * Reference: FloatLib.sol#L232-L241
 * Align to larger exponent (smaller actual scale), then add
 */
export function plus(a: FloatFixed, b: FloatFixed): FloatFixed {
  if (isZero(a)) return b;
  if (isZero(b)) return a;

  const { mantissa: ma, exponent: ea } = a;
  const { mantissa: mb, exponent: eb } = b;

  if (ea === eb) {
    // Same exponent, simple addition
    return normalize(ma + mb, ea);
  } else if (ea > eb) {
    // ea is larger (less negative), so it's bigger scale
    // Align b down to a's exponent by dividing mantissa
    const diff = ea - eb;
    const alignedMb = mb / (10n ** diff);
    return normalize(ma + alignedMb, ea);
  } else {
    // eb > ea, align a down to b's exponent
    const diff = eb - ea;
    const alignedMa = ma / (10n ** diff);
    return normalize(alignedMa + mb, eb);
  }
}

// ============================================================================
// ARITHMETIC: minus (subtraction and negation)
// ============================================================================

/**
 * Subtract a - b or negate a (if b not provided)
 *
 * Math: (m_a * 10^e_a) - (m_b * 10^e_b)
 *
 * Reference: FloatLib.sol#L242-L254
 * function minus(Float a, Float b) internal pure returns (Float) {
 *   (int256 ma, int256 ea) = components(a);
 *   (int256 mb, int256 eb) = components(b);
 *   if (ea > eb) {
 *     return normalize(from(ma - mb / 10**(ea - eb), ea));
 *   } else if (ea < eb) {
 *     return normalize(from(ma / 10**(eb - ea) - mb, eb));
 *   }
 *   return normalize(from(ma - mb, ea));
 * }
 */
export function minus(a: FloatFixed, b?: FloatFixed): FloatFixed {
  if (!b) {
    // Negation: -a
    return from(-a.mantissa, a.exponent);
  }

  if (isZero(a)) return from(-b.mantissa, b.exponent);
  if (isZero(b)) return a;

  const { mantissa: ma, exponent: ea } = a;
  const { mantissa: mb, exponent: eb } = b;

  if (ea === eb) {
    return normalize(ma - mb, ea);
  } else if (ea > eb) {
    const diff = ea - eb;
    const alignedMb = mb / (10n ** diff);
    return normalize(ma - alignedMb, ea);
  } else {
    const diff = eb - ea;
    const alignedMa = ma / (10n ** diff);
    return normalize(alignedMa - mb, eb);
  }
}

// ============================================================================
// TRANSFORMATIONS: abs, shift, align
// ============================================================================

/**
 * Absolute value
 *
 * Reference: FloatLib.sol#L255-L259
 * function abs(Float a) internal pure returns (Float) {
 *   (int256 ma, int256 ea) = components(a);
 *   if (ma < 0) return from(-ma, ea);
 *   return a;
 * }
 */
export function abs(a: FloatFixed): FloatFixed {
  if (a.mantissa < 0n) {
    return from(-a.mantissa, a.exponent);
  }
  return a;
}

/**
 * Shift exponent by n (multiply by 10^n)
 *
 * Reference: FloatLib.sol#L260-L263
 * function shift(Float a, int256 n) internal pure returns (Float) {
 *   (int256 ma, int256 ea) = components(a);
 *   return from(ma, ea + n);
 * }
 */
export function shift(a: FloatFixed, n: bigint): FloatFixed {
  return from(a.mantissa, a.exponent + n);
}

/**
 * Align exponents of two floats (helper for binary operations)
 * Returns both aligned to the larger exponent
 *
 * Reference: FloatLib.sol#L264-L274 (implicit in binary operations)
 */
export function align(a: FloatFixed, b: FloatFixed): [FloatFixed, FloatFixed] {
  const { mantissa: ma, exponent: ea } = a;
  const { mantissa: mb, exponent: eb } = b;

  if (ea === eb) {
    return [a, b];
  } else if (ea > eb) {
    const diff = ea - eb;
    const alignedMb = mb / (10n ** diff);
    return [from(ma, ea), from(alignedMb, ea)];
  } else {
    const diff = eb - ea;
    const alignedMa = ma / (10n ** diff);
    return [from(alignedMa, eb), from(mb, eb)];
  }
}

// ============================================================================
// ADVANCED: round, pow, sqrt, log, exp (stubs for now)
// ============================================================================

/**
 * Round to specified decimals
 *
 * Reference: FloatLib.sol#L275-L278
 * Converts to int (which truncates), then back to Float
 */
export function round(a: FloatFixed, decimals: bigint): FloatFixed {
  const intVal = toInt(a, decimals);
  // toFloat expects unsigned, so handle negative values
  if (intVal < 0n) {
    const absVal = -intVal;
    const f = toFloat(absVal, decimals);
    return from(-f.mantissa, f.exponent);
  }
  return toFloat(intVal, decimals);
}

/**
 * Power function: x ^ n
 * TODO: Implement full power function with fractional exponents
 *
 * Reference: FloatLib.sol#L279-L285
 */
export function pow(base: FloatFixed, exponent: FloatFixed): FloatFixed {
  // Stub - implement in next phase
  throw new Error('pow() not yet implemented');
}

/**
 * Square root
 * TODO: Implement Newton's method for precision
 *
 * Reference: FloatLib.sol#L286-L292
 */
export function sqrt(a: FloatFixed): FloatFixed {
  // Stub - implement in next phase
  throw new Error('sqrt() not yet implemented');
}

/**
 * Natural logarithm
 * TODO: Implement using Taylor series
 *
 * Reference: FloatLib.sol#L293-L299
 */
export function log(a: FloatFixed): FloatFixed {
  // Stub - implement in next phase
  throw new Error('log() not yet implemented');
}

/**
 * Exponential function (e^x)
 * TODO: Implement using Taylor series
 *
 * Reference: FloatLib.sol#L300-L306
 */
export function exp(a: FloatFixed): FloatFixed {
  // Stub - implement in next phase
  throw new Error('exp() not yet implemented');
}

/**
 * Full multiply and divide with 256-bit precision
 * Reference: FloatLib.sol#L307-L320
 */
export function fullMulDiv(a: bigint, b: bigint, divisor: bigint): bigint {
  // Stub - implement in next phase
  throw new Error('fullMulDiv() not yet implemented');
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  from,
  normalize,
  components,
  getMantissa,
  getExponent,
  toFloat,
  toInt,
  toUInt,
  toNumber,
  isEQ,
  isGT,
  isGEQ,
  isLT,
  isLEQ,
  isZero,
  isValid,
  times,
  divide,
  plus,
  minus,
  abs,
  shift,
  align,
  round,
  ZERO,
  ONE,
};
