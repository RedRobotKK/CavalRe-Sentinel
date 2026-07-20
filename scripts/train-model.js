#!/usr/bin/env node

/**
 * TRAIN SLM MODEL
 *
 * Takes backtest observations + training data
 * Trains a simple decision model to predict:
 * 1. Is this order likely profitable?
 * 2. What markup should we apply?
 * 3. Should we execute this order?
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// LOAD TRAINING DATA
// ============================================================================

function loadTrainingData() {
  const dataPath = path.join(__dirname, '../data/training-data.json');
  if (!fs.existsSync(dataPath)) {
    console.error('❌ training-data.json not found');
    console.error('   Run: node scripts/backtest-pipeline.js');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`✅ Loaded ${data.count} training examples`);
  return data.examples;
}

// ============================================================================
// FEATURE ENGINEERING
// ============================================================================

function engineerFeatures(example) {
  const { features, labels } = example;

  return {
    // Input features
    tokenPairHash: hashTokenPair(features.pair),
    amountIn: features.amount_in,
    executionPrice: features.execution_price,
    intendedSurplus: features.intended_surplus,

    // Encoded token pair
    isWethPair: features.token_in === 'WETH' || features.token_out === 'WETH' ? 1 : 0,
    isStablePair: (features.token_in === 'USDC' || features.token_in === 'USDT' || features.token_in === 'DAI') &&
                   (features.token_out === 'USDC' || features.token_out === 'USDT' || features.token_out === 'DAI') ? 1 : 0,

    // Labels
    isProfitable: labels.is_profitable,
    expectedSurplus: labels.expected_surplus,
    recommendedMarkup: labels.recommended_markup
  };
}

function hashTokenPair(pair) {
  let hash = 0;
  for (let i = 0; i < pair.length; i++) {
    const char = pair.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % 100;  // 0-99 hash
}

// ============================================================================
// SIMPLE DECISION TREE MODEL
// ============================================================================

class SimpleModel {
  constructor() {
    this.rules = {};
    this.performance = {};
  }

  train(examples) {
    console.log(`\n📚 Training model on ${examples.length} examples...`);

    // Engineer features
    const engineered = examples.map(engineerFeatures);

    // Learn rules by token pair
    this.learnTokenPairRules(engineered);

    // Learn markup thresholds
    this.learnMarkupThresholds(engineered);

    console.log(`✅ Model trained`);
    console.log(`   Rules learned for token pairs`);
    console.log(`   Markup strategies optimized`);
  }

  learnTokenPairRules(examples) {
    const pairStats = {};

    for (const ex of examples) {
      const pair = ex.tokenPairHash;
      if (!pairStats[pair]) {
        pairStats[pair] = {
          count: 0,
          profitable: 0,
          avgProfit: 0,
          maxProfit: 0
        };
      }

      pairStats[pair].count++;
      if (ex.isProfitable) pairStats[pair].profitable++;
      pairStats[pair].avgProfit += ex.expectedSurplus;
      pairStats[pair].maxProfit = Math.max(pairStats[pair].maxProfit, ex.expectedSurplus);
    }

    // Convert to percentages
    for (const pair in pairStats) {
      const stats = pairStats[pair];
      stats.winRate = (stats.profitable / stats.count) * 100;
      stats.avgProfit = stats.avgProfit / stats.count;
      this.rules[`pair_${pair}`] = stats;
    }
  }

  learnMarkupThresholds(examples) {
    // Rule: High surplus = can afford higher markup
    const highSurplus = examples.filter(e => e.expectedSurplus > 100);
    const lowSurplus = examples.filter(e => e.expectedSurplus <= 100);

    const highAvg = highSurplus.reduce((sum, e) => sum + e.recommendedMarkup, 0) / Math.max(highSurplus.length, 1);
    const lowAvg = lowSurplus.reduce((sum, e) => sum + e.recommendedMarkup, 0) / Math.max(lowSurplus.length, 1);

    this.rules.markupHighSurplus = highAvg;
    this.rules.markupLowSurplus = lowAvg;
  }

  predict(order) {
    // Decision: Should we execute this order and with what markup?

    // 1. Get token pair rule
    const pairHash = hashTokenPair(`${order.token_in}→${order.token_out}`);
    const pairRule = this.rules[`pair_${pairHash}`] || { winRate: 75, avgProfit: 0.2 };

    // 2. Estimate expected profit
    const baseProfit = order.executed_surplus * 0.75;  // 75% of mock surplus available
    const isSamplable = baseProfit > 0;

    // 3. Decide markup based on pair profitability
    let decidedMarkup = 0.3;  // Default
    if (pairRule.winRate > 80 && pairRule.avgProfit > 200) {
      decidedMarkup = this.rules.markupHighSurplus || 0.5;
    } else if (pairRule.winRate < 70) {
      decidedMarkup = this.rules.markupLowSurplus || 0.2;
    }

    // 4. Confidence score (0-100)
    const confidence = Math.min(100, pairRule.winRate * 1.2);

    return {
      shouldExecute: isSamplable && pairRule.winRate > 70,
      decidedMarkup: parseFloat(decidedMarkup.toFixed(2)),
      confidence: parseFloat(confidence.toFixed(1)),
      pairWinRate: parseFloat(pairRule.winRate.toFixed(1)),
      expectedProfit: parseFloat(baseProfit.toFixed(4))
    };
  }

  save(outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify({
      timestamp: Date.now(),
      modelType: 'SimpleDecisionTree',
      rules: this.rules
    }, null, 2));
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║  TRAIN SLM MODEL                                                   ║
║  Learn from backtest observations                                 ║
╚════════════════════════════════════════════════════════════════════╝
  `);

  // Load training data
  const examples = loadTrainingData();

  // Train model
  const model = new SimpleModel();
  model.train(examples);

  // Save model
  const modelPath = path.join(__dirname, '../data/model-trained.json');
  model.save(modelPath);

  // Show sample predictions
  console.log(`\n🤖 Sample Predictions (on training data):`);
  console.log('━'.repeat(70));

  for (const example of examples.slice(0, 5)) {
    const prediction = model.predict(example.features);
    const actual = example.labels;

    console.log(`
Order: ${example.features.pair}
  Amount: ${example.features.amount_in.toFixed(2)} | Surplus: ${example.features.intended_surplus.toFixed(6)} ETH

  Actual: Profitable=${actual.is_profitable}, Recommended markup=${actual.recommended_markup}%
  Predicted: Execute=${prediction.shouldExecute}, Markup=${prediction.decidedMarkup}%, Confidence=${prediction.confidence}%
  Expected Profit: ${prediction.expectedProfit} ETH
    `);
  }

  console.log(`
✅ MODEL TRAINED
   Saved: ${modelPath}
   Rules: Token pair strategies + markup optimization

Next: Test inference
   node scripts/test-inference.js
  `);
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
