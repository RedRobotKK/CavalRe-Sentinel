/**
 * TRADE DECISION ENGINE
 *
 * Core logic for deciding whether to execute a trade.
 *
 * Decision Flow:
 * 1. Retrieve pair history (historical win rate)
 * 2. Analyze current market signals
 * 3. Calculate model confidence = (pair_history * 0.7) + (signals * 0.3)
 * 4. Validate all risk limits (mandatory)
 * 5. If confidence > 65% AND risk checks pass → Execute
 * 6. Else → Reject
 *
 * Every calculation logged and auditable.
 */

import { CalculationLogger } from './CalculationLogger';
import { StructuredLogger } from './StructuredLogger';
import { MetricsCollector } from './MetricsCollector';
import { RiskValidator } from './RiskValidator';
import { SignalAnalyzer, MarketSignals, SignalAnalysis } from './SignalAnalyzer';
import { RiskLimitExceededError, SentinelError } from './TypedError';

/**
 * Pair history (learned from backtest)
 */
export interface PairHistory {
  pair: string;
  profitableTradesCount: number;
  totalTradesCount: number;
  winRate: number; // 0-1
  averageSurplus: string | number; // ETH
  volatilityObserved: number; // 0-100
}

/**
 * Trade decision
 */
export interface TradeDecision {
  id: string;
  timestamp: number;
  pair: string;
  confidence: number; // 0-1
  expectedProfit: string;
  recommendedMarkup: string; // decimal percentage
  reasoning: DecisionReasoning;
  shouldExecute: boolean;
  rejectionReason?: string;
}

/**
 * Reasoning for decision
 */
export interface DecisionReasoning {
  pairHistory: PairHistory;
  signalAnalysis: SignalAnalysis;
  calculatedConfidence: number;
  riskChecksPassed: boolean;
  profitCalculation: {
    surplus: string;
    markup: string;
    expectedProfit: string;
  };
}

/**
 * Core trading decision logic
 */
export class TradeDecisionEngine {
  private calculationLogger: CalculationLogger;
  private structuredLogger: StructuredLogger;
  private metricsCollector: MetricsCollector;
  private riskValidator: RiskValidator;
  private signalAnalyzer: SignalAnalyzer;

  // Constants
  private readonly CONFIDENCE_THRESHOLD = 0.65; // Min confidence to trade
  private readonly PAIR_HISTORY_WEIGHT = 0.7;
  private readonly SIGNALS_WEIGHT = 0.3;
  private readonly DEFAULT_MARKUP = 0.005; // 0.5%

  constructor(
    calculationLogger: CalculationLogger,
    structuredLogger: StructuredLogger,
    metricsCollector: MetricsCollector,
    riskValidator: RiskValidator,
    signalAnalyzer: SignalAnalyzer
  ) {
    this.calculationLogger = calculationLogger;
    this.structuredLogger = structuredLogger;
    this.metricsCollector = metricsCollector;
    this.riskValidator = riskValidator;
    this.signalAnalyzer = signalAnalyzer;
  }

  /**
   * Decide whether to execute a trade
   *
   * @param pair Token pair (e.g., "WETH→USDC")
   * @param pairHistory Historical performance of this pair
   * @param signals Current market signals
   * @param context Trading context (capital, leverage, etc.)
   * @returns TradeDecision with full reasoning
   * @throws RiskLimitExceededError if risk checks fail
   */
  async decide(params: {
    pair: string;
    pairHistory: PairHistory;
    signals: MarketSignals;
    context: {
      surplus: string | number; // ETH surplus available
      totalCapital: string | number;
      currentLeverage: string | number;
      dailyLoss: string | number;
      currentDrawdown: string | number;
    };
    correlationId?: string;
  }): Promise<TradeDecision> {
    const correlationId = params.correlationId || this.generateCorrelationId();
    const decision: TradeDecision = {
      id: `decision-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      pair: params.pair,
      confidence: 0,
      expectedProfit: '0',
      recommendedMarkup: String(this.DEFAULT_MARKUP),
      reasoning: {} as DecisionReasoning,
      shouldExecute: false
    };

    try {
      // Step 1: Analyze signals
      const signalAnalysis = this.signalAnalyzer.analyze(
        params.signals,
        correlationId
      );

      // Step 2: Calculate confidence
      const confidence = this.calculateConfidence(
        params.pairHistory.winRate,
        signalAnalysis.confidence,
        correlationId
      );

      decision.confidence = confidence;

      // Step 3: Calculate expected profit
      const profitCalc = this.calculateExpectedProfit(
        params.context.surplus,
        this.DEFAULT_MARKUP,
        correlationId
      );

      decision.expectedProfit = profitCalc.expectedProfit;
      decision.recommendedMarkup = profitCalc.markup;

      // Step 4: Validate risk (this throws if checks fail)
      const riskValid = await this.validateRisks(
        {
          position: params.context.surplus,
          totalCapital: params.context.totalCapital,
          leverage: params.context.currentLeverage,
          dailyLoss: params.context.dailyLoss,
          currentDrawdown: params.context.currentDrawdown
        },
        correlationId
      );

      // Step 5: Make decision
      decision.reasoning = {
        pairHistory: params.pairHistory,
        signalAnalysis,
        calculatedConfidence: confidence,
        riskChecksPassed: riskValid,
        profitCalculation: profitCalc
      };

      if (confidence >= this.CONFIDENCE_THRESHOLD && riskValid) {
        decision.shouldExecute = true;

        // Log successful decision
        this.structuredLogger.logTradeDecision({
          decisionId: decision.id,
          pair: params.pair,
          confidence: confidence,
          expectedProfit: decision.expectedProfit,
          reasoning: {
            pairWinRate: params.pairHistory.winRate,
            signalConfidence: signalAnalysis.confidence,
            calculatedConfidence: confidence,
            surplus: params.context.surplus,
            markup: decision.recommendedMarkup
          },
          correlationId
        });

        this.metricsCollector.recordTradeSuccess();
      } else {
        decision.shouldExecute = false;
        if (confidence < this.CONFIDENCE_THRESHOLD) {
          decision.rejectionReason = `Confidence ${(confidence * 100).toFixed(1)}% below threshold ${(this.CONFIDENCE_THRESHOLD * 100).toFixed(1)}%`;
        } else if (!riskValid) {
          decision.rejectionReason = 'Risk checks failed';
        }
      }

      return decision;
    } catch (error) {
      // Handle risk validation errors
      if (error instanceof RiskLimitExceededError) {
        decision.shouldExecute = false;
        decision.rejectionReason = 'Risk limits exceeded: ' +
          error.failedChecks
            .map(c => `${c.name}(${c.actual} > ${c.limit})`)
            .join(', ');

        this.metricsCollector.recordTradeFailure();

        // Still return decision (don't re-throw)
        return decision;
      }

      // Re-throw unexpected errors
      this.metricsCollector.recordError();
      throw error;
    }
  }

  /**
   * Calculate confidence from pair history and signals
   * Formula: (pair_win_rate * 0.7) + (signal_confidence * 0.3)
   */
  private calculateConfidence(
    pairWinRate: number,
    signalConfidence: number,
    correlationId: string
  ): number {
    // Weighted components
    const pairComponent = this.calculationLogger.multiply(
      String(pairWinRate),
      String(this.PAIR_HISTORY_WEIGHT),
      18,
      { purpose: 'pair_history_weighted' }
    );

    const signalComponent = this.calculationLogger.multiply(
      String(signalConfidence),
      String(this.SIGNALS_WEIGHT),
      18,
      { purpose: 'signals_weighted' }
    );

    // Sum
    const confidence = this.calculationLogger.add(
      pairComponent,
      signalComponent,
      18,
      { purpose: 'confidence_composite' }
    );

    return Number(confidence);
  }

  /**
   * Calculate expected profit
   * Expected Profit = Surplus * Markup
   */
  private calculateExpectedProfit(
    surplus: string | number,
    markup: number,
    correlationId: string
  ): {
    expectedProfit: string;
    markup: string;
  } {
    const profitStr = this.calculationLogger.multiply(
      String(surplus),
      String(markup),
      18,
      { purpose: 'profit_calculation' }
    );

    return {
      expectedProfit: profitStr,
      markup: String(markup)
    };
  }

  /**
   * Validate risk limits
   * Returns true if all checks pass, throws if any fail
   */
  private async validateRisks(
    context: {
      position: string | number;
      totalCapital: string | number;
      leverage: string | number;
      dailyLoss: string | number;
      currentDrawdown: string | number;
    },
    correlationId: string
  ): Promise<boolean> {
    const validation = this.riskValidator.validate({
      position: context.position,
      totalCapital: context.totalCapital,
      leverage: context.leverage,
      dailyLoss: context.dailyLoss,
      currentDrawdown: context.currentDrawdown,
      correlationId
    });

    return validation.allChecksPassed;
  }

  /**
   * Generate correlation ID for tracing
   */
  private generateCorrelationId(): string {
    return `trade-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Get decision explanation as human-readable text
   */
  explainDecision(decision: TradeDecision): string {
    const lines: string[] = [
      `Trade Decision: ${decision.pair}`,
      `ID: ${decision.id}`,
      `Timestamp: ${new Date(decision.timestamp).toISOString()}`,
      ``,
      `DECISION: ${decision.shouldExecute ? '✅ EXECUTE' : '❌ REJECT'}`,
      `Confidence: ${(decision.confidence * 100).toFixed(1)}%`,
      `Expected Profit: ${decision.expectedProfit} ETH`,
      `Recommended Markup: ${(Number(decision.recommendedMarkup) * 100).toFixed(2)}%`
    ];

    if (decision.rejectionReason) {
      lines.push(`Rejection Reason: ${decision.rejectionReason}`);
    }

    if (decision.reasoning.pairHistory) {
      lines.push(``,
        `Pair History:`,
        `  Win Rate: ${(decision.reasoning.pairHistory.winRate * 100).toFixed(1)}%`,
        `  Trades: ${decision.reasoning.pairHistory.profitableTradesCount}/${decision.reasoning.pairHistory.totalTradesCount}`,
        `  Avg Surplus: ${decision.reasoning.pairHistory.averageSurplus} ETH`
      );
    }

    if (decision.reasoning.signalAnalysis) {
      const sa = decision.reasoning.signalAnalysis;
      lines.push(``,
        `Market Signals:`,
        `  Regime: ${sa.regime}`,
        `  Volume Score: ${sa.volumeScore}/100`,
        `  Volatility Score: ${sa.volatilityScore}/100`,
        `  OI Score: ${sa.oiScore}/100`,
        `  Composite Score: ${sa.compositeScore}/100`,
        `  Recommendation: ${sa.recommendation}`
      );
    }

    return lines.join('\n');
  }
}
