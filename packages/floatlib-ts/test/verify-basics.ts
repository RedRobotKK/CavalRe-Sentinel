/**
 * Quick verification of basic FloatLib operations
 * Run: npx tsx test/verify-basics.ts
 */

import * as FloatLib from '../src/floatlib';

console.log('=== FloatLib Basic Verification ===\n');

// Test 1: Constants
console.log('Test 1: Constants');
console.log(`ZERO: ${FloatLib.toNumber(FloatLib.ZERO)} (expect 0)`);
console.log(`ONE: ${FloatLib.toNumber(FloatLib.ONE)} (expect 1)`);
console.log();

// Test 2: toFloat and back
console.log('Test 2: toFloat roundtrip');
const f1 = FloatLib.toFloat(1000000000000000000n, 18n); // 1.0
console.log(`toFloat(1e18, 18): ${FloatLib.toNumber(f1)} (expect 1)`);
const back1 = FloatLib.toInt(f1, 18n);
console.log(`toInt back: ${back1} (expect 1e18 = ${1000000000000000000n})`);
console.log();

// Test 3: toFloat with 6 decimals (USDC)
console.log('Test 3: toFloat with 6 decimals (USDC)');
const f2 = FloatLib.toFloat(1000000n, 6n); // $1 USDC
console.log(`toFloat(1e6, 6): ${FloatLib.toNumber(f2)} (expect 1)`);
const back2 = FloatLib.toInt(f2, 6n);
console.log(`toInt back: ${back2} (expect 1e6 = ${1000000n})`);
console.log();

// Test 4: Multiplication
console.log('Test 4: Multiplication');
const a = FloatLib.toFloat(2000000000000000000n, 18n); // 2
const b = FloatLib.toFloat(3000000000000000000n, 18n); // 3
const mul = FloatLib.times(a, b);
console.log(`2 * 3 = ${FloatLib.toNumber(mul)} (expect 6)`);
console.log();

// Test 5: Division
console.log('Test 5: Division');
const c = FloatLib.toFloat(10000000000000000000n, 18n); // 10
const d = FloatLib.toFloat(2000000000000000000n, 18n);  // 2
const div = FloatLib.divide(c, d);
console.log(`10 / 2 = ${FloatLib.toNumber(div)} (expect 5)`);
console.log();

// Test 6: Addition
console.log('Test 6: Addition');
const e = FloatLib.toFloat(1500000000000000000n, 18n); // 1.5
const f = FloatLib.toFloat(2500000000000000000n, 18n); // 2.5
const sum = FloatLib.plus(e, f);
console.log(`1.5 + 2.5 = ${FloatLib.toNumber(sum)} (expect 4)`);
console.log();

// Test 7: Subtraction
console.log('Test 7: Subtraction');
const g = FloatLib.toFloat(5000000000000000000n, 18n); // 5
const h = FloatLib.toFloat(3000000000000000000n, 18n); // 3
const sub = FloatLib.minus(g, h);
console.log(`5 - 3 = ${FloatLib.toNumber(sub)} (expect 2)`);
console.log();

// Test 8: Comparisons
console.log('Test 8: Comparisons');
const ten = FloatLib.toFloat(10000000000000000000n, 18n);
const five = FloatLib.toFloat(5000000000000000000n, 18n);
console.log(`10 > 5: ${FloatLib.isGT(ten, five)} (expect true)`);
console.log(`5 < 10: ${FloatLib.isLT(five, ten)} (expect true)`);
console.log(`10 == 10: ${FloatLib.isEQ(ten, ten)} (expect true)`);
console.log();

// Test 9: Zero checks
console.log('Test 9: Zero checks');
const zero = FloatLib.ZERO;
console.log(`isZero(ZERO): ${FloatLib.isZero(zero)} (expect true)`);
console.log(`isZero(ONE): ${FloatLib.isZero(FloatLib.ONE)} (expect false)`);
console.log();

// Test 10: Normalization
console.log('Test 10: Normalization');
const unnormalized = FloatLib.from(5n, 10n);
const normalized = FloatLib.normalize(unnormalized);
console.log(`Normalized {5, 10}: mantissa=${normalized.mantissa}, exponent=${normalized.exponent}`);
console.log(`Value: ${FloatLib.toNumber(normalized)} (expect 5e10 = ${50000000000})`);
console.log();

console.log('=== All basic tests completed ===');
