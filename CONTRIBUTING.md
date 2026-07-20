# Contributing to Sentinel

Thank you for wanting to improve Sentinel! This guide explains how to contribute code, tests, documentation, or bug reports.

## Core Philosophy

Every contribution must follow **5 non-negotiable rules:**

1. **FloatLib for ALL math** — No JavaScript Number type. Ever.
2. **NEVER TRUST, ALWAYS VERIFY** — Tests for every behavior
3. **CITE REFERENCES** — Every function links to its source
4. **CHECK FACTS** — Edge cases and boundaries tested
5. **TDD** — Tests written before implementation

Violations of these rules will cause PR rejection, even if the code is elegant.

## Getting Started

### 1. Fork & Clone
```bash
git clone https://github.com/YOUR_USERNAME/sentinel.git
cd sentinel
npm install --recursive
```

### 2. Create a Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 3. Make Changes
Follow the style guide below.

### 4. Test & Verify
```bash
# TypeScript strict mode
npm run typecheck

# Tests
npm run test

# Coverage
npm run test:coverage
```

### 5. Submit PR
Push your branch and open a PR with:
- Clear title: "Add Kelly position sizing" or "Fix precision loss in normalize()"
- Description: What changed and why
- Test results: Proof that all tests pass

---

## Style Guide

### TypeScript

```typescript
// ✅ Good
export function calculatePositionSize(surplus: FloatLib.FloatFixed): FloatLib.FloatFixed {
  /**
   * Returns safe position size: min(5% capital, 10x surplus, max position)
   * Reference: REFOCUSED_ARCHITECTURE.md#Position-Sizing
   */
  if (FloatLib.isZero(surplus)) {
    return FloatLib.ZERO;
  }
  // ... implementation
}

// ❌ Bad
export function calcPos(s) {
  return s ? min(0.05, 10 * s) : 0; // No types, no docs, native math
}
```

### Rules

1. **Always use FloatLib**
   ```typescript
   // ❌ Never
   const total = balance * 0.05;
   
   // ✅ Always
   const fivePercent = FloatLib.divide(FloatLib.toFloat(5n, 0n), FloatLib.toFloat(100n, 0n));
   const total = FloatLib.times(balance, fivePercent);
   ```

2. **Document every exported function**
   ```typescript
   /**
    * Brief description
    * 
    * Detailed explanation if needed
    * Reference: [Link to source/paper/spec]
    */
   export function myFunction(...) { }
   ```

3. **No magic numbers**
   ```typescript
   // ❌ Bad
   const pos = FloatLib.times(capital, FloatLib.toFloat(5n, 0n));
   
   // ✅ Good
   const POSITION_SIZE_PCT = FloatLib.toFloat(5n, 0n);
   const pos = FloatLib.times(capital, POSITION_SIZE_PCT);
   ```

4. **Handle errors explicitly**
   ```typescript
   // ❌ Bad
   const result = FloatLib.divide(a, b); // Crashes if b is zero
   
   // ✅ Good
   if (FloatLib.isZero(b)) {
     throw new Error('Cannot divide by zero');
   }
   const result = FloatLib.divide(a, b);
   ```

5. **Test edge cases**
   ```typescript
   // ✅ Good test file
   describe('calculatePositionSize', () => {
     it('should return zero for zero surplus', () => {
       const result = calculatePositionSize(FloatLib.ZERO);
       expect(FloatLib.isZero(result)).toBe(true);
     });
     
     it('should cap at max position size', () => {
       const huge = FloatLib.toFloat(1000000n, 0n);
       const result = calculatePositionSize(huge);
       expect(FloatLib.isLEQ(result, MAX_POSITION)).toBe(true);
     });
     
     it('should enforce 10x leverage on surplus', () => {
       const surplus = FloatLib.toFloat(100n, 0n);
       const result = calculatePositionSize(surplus);
       expect(FloatLib.isLEQ(result, FloatLib.toFloat(1000n, 0n))).toBe(true);
     });
   });
   ```

---

## Contribution Types

### 🐛 Bug Fixes

1. **Identify the issue** — Reproduce it with a test
2. **Write a failing test** — Test that catches the bug
3. **Fix the code** — Implementation to pass the test
4. **Verify** — All tests pass, coverage maintained

**Example PR:**
```
Title: Fix precision loss in toInt() conversion

Description:
- toInt() was adding extra +21 to exponent incorrectly
- This caused conversions like 1.5 USDC to calculate as 1.5e21
- Added test case to catch this
- Fixed the exponent calculation

Tests:
- ✅ All 98 FloatLib tests pass
- ✅ New test_toInt_precision passes
- ✅ Coverage maintained >90%
```

### ✨ New Features

1. **Propose first** — Open issue describing the feature
2. **Design in code** — Show how the API would work
3. **Write tests** — Before implementation
4. **Implement** — Make tests pass
5. **Document** — Update README, add examples

**Example features accepted:**
- New risk models (Sharpe ratio, VaR, stress testing)
- Multi-chain support
- Advanced position sizing algorithms
- Integration helpers (viem, ethers, etc.)

**Example features likely rejected:**
- Removing FloatLib dependency to "simplify"
- Disabling TDD or tests
- Removing divergence detection
- Adding magic numbers

### 📚 Documentation

Documentation improvements are always welcome!

- Typos and clarity fixes
- New examples or use cases
- API reference improvements
- Architecture deep-dives

Just submit a PR with your changes.

### 🧪 Tests

Add tests for:
- New functions/methods
- Bug fixes (add regression test)
- Edge cases (zero, negative, boundaries)
- Integration scenarios

Test template:
```typescript
describe('Feature Name', () => {
  it('should do X when given Y', () => {
    const input = FloatLib.toFloat(...);
    const result = myFunction(input);
    expect(FloatLib.isEQ(result, expected)).toBe(true);
  });
  
  it('should handle edge case: zero input', () => {
    const result = myFunction(FloatLib.ZERO);
    expect(FloatLib.isZero(result)).toBe(true);
  });
  
  it('should throw on invalid input', () => {
    expect(() => {
      myFunction(invalid);
    }).toThrow();
  });
});
```

---

## PR Review Checklist

Before submitting, verify:

- [ ] All tests pass (`npm test`)
- [ ] TypeScript strict mode passes (`npm run typecheck`)
- [ ] Coverage >90% (`npm run test:coverage`)
- [ ] No ESLint violations (`npm run lint`)
- [ ] Code formatted (`npm run format`)
- [ ] All FloatLib math (no Number type)
- [ ] All functions documented
- [ ] All edge cases tested
- [ ] References cited where applicable
- [ ] Follows 5 non-negotiable rules

### Things That Will Cause Rejection

❌ Using JavaScript `Number` type for math  
❌ Removing or disabling tests  
❌ Functions without documentation  
❌ Magic numbers without constants  
❌ No test coverage for new code  
❌ Breaking changes without discussion  
❌ Removing divergence detection or risk limits  

---

## Commit Messages

Use clear, descriptive commit messages:

```
✨ Add Kelly criterion position sizing
- Implements f* = (bp - q) / b formula
- Includes 5 test cases covering edge cases
- Reference: Wikipedia Kelly criterion

Fix: Precision loss in toInt() conversion
- Was incorrectly adding +21 to exponent
- Now correctly calculates mantissa × 10^(exp + decimals)
- Regression test added
```

---

## Code Review Process

1. **Automated checks** — GitHub Actions runs tests, lint, coverage
2. **Manual review** — Maintainers check logic, safety, documentation
3. **Discussion** — Questions asked, concerns addressed
4. **Approval** — Changes merged once approved

Typical timeline: 24-48 hours for review.

---

## Reporting Bugs

Found a bug? Open an issue:

1. **Title** — Clear, specific: "FloatLib.divide() returns wrong sign for negative divisor"
2. **Reproduction** — Step-by-step or code example
3. **Expected** — What should happen
4. **Actual** — What actually happens
5. **Environment** — Node version, platform, etc.

**Example:**
```
Title: Ledger.checkDivergence() doesn't compare correctly

Reproduction:
const ledger = new Ledger();
const a = FloatLib.toFloat(100n, 6n);
ledger.checkDivergence('0xTest', 'USDC', a);
const b = FloatLib.toFloat(99999999n, 0n); // Tiny difference
const diverged = ledger.checkDivergence('0xTest', 'USDC', b);

Expected: diverged = true (difference exceeds tolerance)
Actual: diverged = false (not caught)

Environment: Node 18.0.0, Ubuntu 22.04
```

---

## Release Process

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (x.0.0) — Breaking changes
- **MINOR** (0.x.0) — New features, backward compatible
- **PATCH** (0.0.x) — Bug fixes

Example: v1.2.3 → v1.3.0 (new feature)

---

## Questions?

- 💬 Open a discussion
- 📧 Email `hello@cavalierre.com`
- 🐛 Open an issue

---

## License

By contributing, you agree your code is MIT licensed.

---

**Thank you for making Sentinel better! 🙏**
