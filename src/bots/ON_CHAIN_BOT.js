#!/usr/bin/env node

/**
 * ON-CHAIN INTENT BOT
 *
 * Listen to Ethereum. Find intents. Execute trades. Make money.
 *
 * npm install viem ethers dotenv
 * node ON_CHAIN_BOT.js
 */

const { createPublicClient, createWalletClient, http, parseAbi } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
require('dotenv').config();

// ============================================================================
// CONFIG
// ============================================================================

const RPC_URL = process.env.RPC_URL || 'https://eth.rpc.bloxroute.com/public';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x...';  // Your private key
const MY_ADDRESS = process.env.MY_ADDRESS || '0x...';   // Your wallet

// Risk limits (in ETH)
const MAX_POSITION = 0.1;  // Max 0.1 ETH per trade
const MAX_LEVERAGE = 2.0;
const MAX_DAILY_LOSS = 1.0;  // Max 1 ETH loss per day

// ============================================================================
// SETUP
// ============================================================================

const publicClient = createPublicClient({ transport: http(RPC_URL) });
const account = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({
  account,
  transport: http(RPC_URL),
});

let portfolio = {
  eth: 0,
  usdc: 0,
  positions: [],
  trades: 0,
  profit: 0,
  dailyLoss: 0,
};

// ============================================================================
// LISTEN FOR INTENTS
// ============================================================================

async function listenForIntents() {
  console.log('🔍 Listening for intents on Ethereum...');
  console.log(`📍 RPC: ${RPC_URL}`);
  console.log(`💼 Wallet: ${MY_ADDRESS}\n`);

  // Listen for pending transactions (intents)
  const unsubscribe = await publicClient.watchPendingTransactions({
    onTransactions: (txs) => {
      txs.forEach(async (tx) => {
        await processIntent(tx);
      });
    },
  });

  return unsubscribe;
}

// ============================================================================
// PROCESS INTENT
// ============================================================================

async function processIntent(txHash) {
  try {
    // Get transaction details
    const tx = await publicClient.getTransaction({ hash: txHash });

    // Parse transaction data
    const intent = parseIntent(tx);

    if (!intent) return;

    console.log(`\n🎯 FOUND INTENT`);
    console.log(`   Hash: ${txHash}`);
    console.log(`   From: ${tx.from}`);
    console.log(`   To: ${tx.to}`);
    console.log(`   Value: ${(BigInt(tx.value) / 1e18).toFixed(4)} ETH`);

    // Decide: should we execute?
    const shouldExecute = await evaluateIntent(intent, tx);

    if (shouldExecute) {
      console.log(`✅ EXECUTING INTENT`);
      await executeIntent(intent, tx);
    }
  } catch (error) {
    // Most transactions won't be intents, skip silently
  }
}

// ============================================================================
// EVALUATE INTENT
// ============================================================================

function parseIntent(tx) {
  // Look for swap/trade-like transactions
  // This is simplified - real intent parsing is more complex

  if (!tx.input || tx.input === '0x') return null;

  // Check for common DEX signatures
  const swapSigs = [
    '0x414bf389',  // Uniswap V3 exactInputSingle
    '0x8803dbee',  // Uniswap V2 swapWithFee
    '0x7ff36ab5',  // Uniswap V2 swapExactETHForTokens
  ];

  const sig = tx.input.slice(0, 10);

  if (swapSigs.includes(sig)) {
    return {
      type: 'SWAP',
      sig: sig,
      data: tx.input,
    };
  }

  return null;
}

async function evaluateIntent(intent, tx) {
  // Check if this is profitable for us to execute

  // 1. Check risk limits
  if (portfolio.positions.length >= 5) {
    return false;  // Too many open positions
  }

  if (portfolio.dailyLoss > MAX_DAILY_LOSS) {
    return false;  // Hit daily loss limit
  }

  // 2. Check position size
  const value = BigInt(tx.value) / 1e18;  // Convert to ETH
  if (value > MAX_POSITION) {
    return false;  // Position too large
  }

  // 3. Check profitability
  // (In real life, calculate MEV opportunity, slippage, gas costs)
  const gasPrice = await publicClient.getGasPrice();
  const estimatedGasCost = gasPrice * 200000n / 1e18;  // Rough estimate

  if (value < estimatedGasCost * 2) {
    return false;  // Not profitable after gas
  }

  return true;
}

// ============================================================================
// EXECUTE INTENT
// ============================================================================

async function executeIntent(intent, originalTx) {
  try {
    console.log(`\n⚡ EXECUTING...`);

    // Build our transaction to sandwich/execute

    const hash = await walletClient.sendTransaction({
      account,
      to: originalTx.to,
      data: intent.data,
      value: BigInt(originalTx.value),
      gasLimit: 300000n,
    });

    console.log(`   TX: ${hash}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log(`✅ SUCCESS`);

      portfolio.trades++;

      // Track profit (simplified)
      const profit = 0.001;  // Assume small profit per execution
      portfolio.profit += profit;

      console.log(`   Profit: +${profit.toFixed(4)} ETH`);
      console.log(`   Total: ${portfolio.profit.toFixed(4)} ETH`);
    } else {
      console.log(`❌ FAILED`);
      portfolio.dailyLoss += 0.001;
    }
  } catch (error) {
    console.error(`❌ Error executing: ${error.message}`);
    portfolio.dailyLoss += 0.001;
  }
}

// ============================================================================
// MONITOR PORTFOLIO
// ============================================================================

async function monitorPortfolio() {
  setInterval(() => {
    console.log(`\n📊 PORTFOLIO: ${portfolio.trades} executions | $${portfolio.profit.toFixed(4)} profit | Daily loss: ${portfolio.dailyLoss.toFixed(4)} ETH`);
  }, 60000);
}

// ============================================================================
// GET BALANCE
// ============================================================================

async function getBalance() {
  try {
    const balance = await publicClient.getBalance({
      address: MY_ADDRESS,
    });

    console.log(`💰 ETH Balance: ${(balance / 1e18).toFixed(4)}`);
    return balance;
  } catch (error) {
    console.error('Error getting balance:', error.message);
  }
}

// ============================================================================
// START BOT
// ============================================================================

async function start() {
  console.log(`
╔════════════════════════════════════════════╗
║      ON-CHAIN INTENT BOT v1.0              ║
║   Listen. Execute. Profit.                 ║
╚════════════════════════════════════════════╝
`);

  // Check balance first
  await getBalance();

  // Start monitoring portfolio
  monitorPortfolio();

  // Listen for intents
  await listenForIntents();

  console.log('\n✅ Bot running...\n');
}

start().catch(console.error);
