# FloatLib.ts - Canonical Fixed-Point Math Library

TypeScript port of **FloatLib.sol** with strict Test-Driven Development (TDD).

**Status:** Task #4 in progress – 100+ test cases written, implementation skeleton complete  
**Verification Plan:** Tests → Implement → Verify against Solidity on testnet

---

## Purpose

Arbitrary-precision fixed-point arithmetic for CavalRe Sentinel intent solver.

- **21 significant digits** of precision
- **Normalized form:** mantissa ∈ [10^20, 10^21)
- **No silent precision loss** at scale
- **Verified against Solidity** FloatLib.sol

---

## Architecture

```
FloatFixed = { mantissa: bigint, exponent: bigint }
value = mantissa * 10^exponent
```

**Example:** `5.0` → `{ mantissa: 5 * 10^20, exponent: -20 }`

---

## Core Functions

### Conversions
- `toFloat(value, decimals)` - uint256 → FloatFixed
- `toInt(f, decimals)` - FloatFixed → int256
- `toUInt(f, decimals)` - FloatFixed → uint256
- `toNumber(f)` - FloatFixed → number (debug only)

### Arithmetic
- `times(a, b)` - Multiplication a * b
- `divide(a, b)` - Division a / b (throws on div-by-zero)
- `plus(a, b)` - Addition a + b
- `minus(a, b)` - Subtraction a - b (or negation -a)

### Comparisons
- `isEQ(a, b)` - Equality
- `isGT(a, b)` - Greater than
- `isLT(a, b)` - Less than
- `isGEQ(a, b)` - Greater or equal
- `isLEQ(a, b)` - Less or equal
- `isZero(a)` - Zero check

### Transformations
- `abs(a)` - Absolute value
- `normalize(m, e)` - Normalize to canonical form
- `shift(a, n)` - Multiply by 10^n
- `align(a, b)` - Align exponents

### Advanced (TODO)
- `pow(base, exp)` - Power function
- `sqrt(a)` - Square root
- `log(a)` - Natural logarithm
- `exp(a)` - e^x
- `fullMulDiv(a, b, divisor)` - 256-bit multiply-divide

---

## Test Suite

**100+ test cases** organized by category:

```typescript
// Types & Constants
✓ FloatFixed structure
✓ ZERO and ONE constants

// Conversions (10 tests)
✓ toFloat with various decimals (USDC, ETH, DAI)
✓ toInt with rounding
✓ toUInt validation
✓ Round-trip precision

// Arithmetic (35 tests)
✓ Multiplication edge cases (zero, one, negatives, overflow)
✓ Division with precision (1/3, round-down)
✓ Addition precision preservation
✓ Subtraction and negation

// Comparisons (20 tests)
✓ isEQ, isGT, isLT, isGEQ, isLEQ
✓ Edge cases (zero, same value)

// Mathematical Laws (5 tests)
✓ Associativity
✓ Distributivity
✓ Commutativity

// Edge Cases (10 tests)
✓ Very large numbers
✓ Very small numbers
✓ Mixing scales
✓ Negative zero
```

---

## TDD Workflow

### Phase 1: RED (Tests Fail)
```bash
npm test
# FAIL: 100+ tests not implemented
```

### Phase 2: GREEN (Implement to Pass)
```bash
# Implementation in src/floatlib.ts
# Functions pass tests one by one
npm test
# PASS: 100 tests
```

### Phase 3: VERIFY (Against Solidity)
```bash
# Run test vectors against deployed FloatLib.sol on testnet
npm run test:solidity-verify

# Expected: 100% match between FloatLib.ts and FloatLib.sol
```

---

## References

**FloatLib.sol:** https://github.com/CavalRe/cavalre-contracts/blob/main/math/FloatLib.sol

**Implementation notes:**
- Constants: SIGNIFICANT_DIGITS=21, NORMALIZED_MANTISSA_MIN=10^20, NORMALIZED_MANTISSA_MAX=10^21-1
- Normalization: Ensures mantissa always fits in [10^20, 10^21) for consistency
- Precision: All operations preserve 21 significant digits
- Rounding: Conservative (round down) to prevent over-estimation

---

## Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Watch mode (re-run on file change)
npm test:watch

# Coverage report
npm test:coverage

# Type checking
npm run typecheck

# Lint
npm run lint
```

---

## Development Rules

From DEVELOPMENT_RULES.md:

1. **FloatLib for ALL math** - Every numeric operation uses FloatLib
2. **NEVER TRUST, ALWAYS VERIFY** - Tests verify against Solidity
3. **CITE REFERENCES** - Every function links to FloatLib.sol
4. **CHECK FACTS** - No assumptions, verify implementation
5. **TDD** - Tests first, code to pass tests

---

## Known Limitations (v0.1.0)

- ❌ `pow()`, `sqrt()`, `log()`, `exp()` not yet implemented (stubs)
- ❌ No overflow detection (all math in BigInt)
- ❌ No underflow protection
- ⚠️ `toNumber()` loses precision for values > 2^53

**Next phase:** Implement advanced functions after core functions verified.

---

## Verification Status

| Component | Status | Verified Against |
|-----------|--------|------------------|
| toFloat | ✅ Implemented | FloatLib.sol#L70-L76 |
| toInt | ✅ Implemented | FloatLib.sol#L77-L82 |
| times | ✅ Implemented | FloatLib.sol#L217-L223 |
| divide | ✅ Implemented | FloatLib.sol#L224-L231 |
| plus | ✅ Implemented | FloatLib.sol#L232-L241 |
| minus | ✅ Implemented | FloatLib.sol#L242-L254 |
| isEQ | ✅ Implemented | FloatLib.sol#L184-L191 |
| isGT | ✅ Implemented | FloatLib.sol#L192-L203 |
| normalize | ✅ Implemented | FloatLib.sol#L152-L159 |
| Advanced | ❌ TODO | FloatLib.sol#L275+ |

---

## Quality Gates

Before merging floatlib-ts:

- [ ] 100% of test cases pass (npm test)
- [ ] TypeScript strict mode passes (npm run typecheck)
- [ ] No ESLint violations (npm run lint)
- [ ] Test vectors match Solidity FloatLib.sol on testnet
- [ ] Code coverage >= 90%
- [ ] All functions cited and documented

---

## Integration with CavalRe Sentinel

FloatLib.ts is used by:
- **Ledger.ts** - State replica synchronization
- **Risk Engine** - Position sizing, limit checks
- **Intent Matcher** - Surplus calculation
- **Execution** - Gas estimation, slippage

All math operations across Sentinel route through FloatLib.ts.

---

**Last Updated:** 2026-07-19  
**Task:** #4 - Port FloatLib.sol to TypeScript with strict TDD  
**Next:** Implement advanced functions (pow, sqrt, log, exp)
