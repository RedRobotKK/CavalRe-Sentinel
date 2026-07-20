# Phase 3: Testnet Verification Against Solidity

**Objective:** Verify FloatLib.ts results match FloatLib.sol bytecode exactly  
**Status:** Ready to deploy and test  
**Timeline:** 2-3 hours (1hr deployment + 1-2hr testing)

---

## What This Phase Does

Compares FloatLib.ts arithmetic against deployed FloatLib.sol contract on Ethereum testnet.

**Test Coverage:**
- Arithmetic: ×, ÷, +, −
- Comparisons: ==, >, <, >=, <=, zero
- Edge cases: 1/3, 1e30 × 1e20, 1e-30 × 1e-20
- Precision: Round-trip (a/b)*b ≈ a
- Integration: USDC (6 decimals), ETH (18 decimals), mixed scales

---

## Step 1: Deploy FloatLib.sol to Sepolia Testnet

### Prerequisites
```bash
# 1. Clone CavalRe contracts repo
git clone https://github.com/RedRobotKK/cavalre-contracts.git
cd cavalre-contracts

# 2. Install dependencies
npm install

# 3. Create .env with testnet key
echo "PRIVATE_KEY=0x..." >> .env
echo "INFURA_KEY=..." >> .env
```

### Deploy
```bash
# Deploy FloatLib.sol to Sepolia
npx hardhat run scripts/deploy-floatlib.ts --network sepolia

# Output will show:
# FloatLib deployed to: 0x...
```

**Save the contract address** — you'll need it in Step 2.

---

## Step 2: Configure Verification Tests

### Create `.env.test` in floatlib-ts/

```bash
cd /Users/daniel/Development/CavalRe/server/CavalRe-Sentinel/floatlib-ts

cat > .env.test << 'EOF'
# Enable testnet verification
SOLIDITY_VERIFY=true

# Ethereum Sepolia RPC
RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY

# FloatLib.sol contract address (from Step 1)
FLOATLIB_CONTRACT_ADDRESS=0x...paste_address_here...
EOF
```

### Get Infura Key
1. Visit https://infura.io
2. Sign up / login
3. Create Sepolia project
4. Copy API key
5. Paste into `.env.test`

---

## Step 3: Run Verification Tests

### Basic Tests (No Testnet Needed)
```bash
cd floatlib-ts

# Quick smoke test (optional)
npm run verify:basics

# Full unit test suite (79 tests)
npm test

# Expected: 100 passed, 0 failed
```

### Testnet Verification (Requires .env.test)
```bash
# Run with testnet verification enabled
npm run test:solidity-verify

# Expected output:
# ✓ Arithmetic Operations (3 tests)
# ✓ Comparison Operations (2 tests)
# ✓ Edge Cases (3 tests)
# ✓ Precision Tests (2 tests)
# ✓ Integration Points (3 tests)
#
# 16 passed
```

---

## What Gets Tested

### Arithmetic Operations
```typescript
// times: 2 * 3 = 6
// divide: 10 / 2 = 5
// plus: 1.5 + 2.5 = 4
// minus: 5 - 3 = 2
```

### Comparisons
```typescript
// isEQ: 5 == 5 → true
// isGT: 10 > 5 → true
// isLT: 3 < 7 → true
```

### Edge Cases
```typescript
// 1/3 ≈ 0.333... (precision)
// 1e30 * 1e20 (very large)
// 1e-30 * 1e-20 (very small)
```

### Precision
```typescript
// Round-trip: (a/b)*b ≈ a
// 0.1 + 0.2 = 0.3 (no precision loss)
```

### Integration
```typescript
// USDC (6 decimals): 1e6 = 1.0
// ETH (18 decimals): 1e18 = 1.0
// Mixed scales: USDC + WETH addition
```

---

## Success Criteria

✅ **All 79 unit tests pass** (`npm test`)
✅ **All 16 testnet tests pass** (`npm run test:solidity-verify`)
✅ **TypeScript strict mode** (`npm run typecheck`)
✅ **Coverage >= 90%** (`npm test:coverage`)
✅ **No linting errors** (`npm run lint`)

---

## Troubleshooting

### "SOLIDITY_VERIFY=true but RPC_URL not set"
Fix: Add RPC_URL to .env.test
```bash
echo "RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY" >> .env.test
```

### "Contract not found at 0x..."
Fix: Verify contract address from Step 1 is correct
```bash
# Check in Sepolia Etherscan
https://sepolia.etherscan.io/address/0x...your_address...
```

### "Connection timeout"
Fix: Check RPC URL is valid and rate limit not exceeded
```bash
# Test RPC connection
curl https://sepolia.infura.io/v3/YOUR_KEY -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","id":1}'
```

### "Math mismatch: expected X, got Y"
This indicates a difference between FloatLib.ts and FloatLib.sol
- Run `npm run verify:basics` to isolate which operation failed
- Check the IMPLEMENTATION_NOTES.md for that operation's logic
- File an issue with the failing test case

---

## Files Involved

| File | Purpose |
|------|---------|
| `test/solidity-verify.test.ts` | Testnet verification harness |
| `.env.test` | Testnet configuration (you create) |
| `floatlib.ts` | Implementation being tested |
| `floatlib.test.ts` | 79 unit tests (no testnet needed) |
| `verify-basics.ts` | Quick smoke test for debugging |

---

## After Verification Passes

### Tag Release
```bash
git tag -a v0.1.0 -m "FloatLib.ts verified against Solidity"
git push origin v0.1.0
```

### Unblock Dependent Tasks
- ✅ Ledger.ts (event-driven state replica)
- ✅ Risk Engine (position sizing)
- ✅ Intent Matcher (surplus calculation)
- ✅ Execution Layer (gas/slippage estimation)

### Next Steps
1. **Task #2:** Rebuild architecture → build Ledger.ts
2. **Task #3:** CoW Solver MVP → integrate Ledger + Intent Matcher
3. **Task #7:** Extract pillar1-validation → backtesting framework

---

## Timeline

| Step | Time | Status |
|------|------|--------|
| Deploy FloatLib.sol | 30 min | ⏳ Ready |
| Configure .env.test | 5 min | ⏳ Ready |
| Run unit tests | 1 min | ✅ Ready |
| Run testnet tests | 2-5 min | ⏳ Ready |
| Analyze results | 10 min | ⏳ Ready |
| **Total** | **~1 hour** | **⏳ Ready** |

---

## Rollback Plan (If Tests Fail)

If testnet verification finds mismatches:

1. **Isolate:** Run `npm run verify:basics` to find failing operation
2. **Debug:** Trace through math in IMPLEMENTATION_NOTES.md
3. **Fix:** Update floatlib.ts and re-run `npm test`
4. **Redeploy:** Push to GitHub and retry Phase 3

Estimated debug time: 30 min per issue

---

## Full Command Sequence

```bash
# Phase 2 Recap: Local Testing
cd floatlib-ts
npm install
npm test
npm run verify:basics
npm test:coverage

# Phase 3: Testnet Verification
# 1. Deploy FloatLib.sol (outside floatlib-ts, in cavalre-contracts)
cd ../../../cavalre-contracts
npx hardhat run scripts/deploy-floatlib.ts --network sepolia
# Note: Contract address

# 2. Configure floatlib-ts/.env.test
cd ../server/CavalRe-Sentinel/floatlib-ts
echo "SOLIDITY_VERIFY=true" > .env.test
echo "RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY" >> .env.test
echo "FLOATLIB_CONTRACT_ADDRESS=0x..." >> .env.test

# 3. Run testnet verification
npm run test:solidity-verify

# Expected: 16 passed
```

---

## Success: Task #4 Complete

When all tests pass locally and on testnet:

✅ FloatLib.ts verified to match FloatLib.sol  
✅ All 5 DEVELOPMENT_RULES enforced  
✅ 95+ test cases cover all functionality  
✅ Production-grade implementation ready  

**Next:** Task #2 (Ledger.ts) now unblocked

---

**Phase 3 Status:** Ready to deploy and verify  
**Deployment Date:** TBD (when ready)  
**Target Completion:** 1-2 hours after deployment  
**Blockers:** None — all prerequisites met
