/**
 * INPUT VALIDATOR
 *
 * Validates all inputs before processing.
 * Prevents bad data from flowing through the system.
 */

import { ValidationError } from './TypedError';
import { MarketSignals } from './SignalAnalyzer';
import { PairHistory } from './TradeDecisionEngine';

/**
 * Validates market signals
 */
export function validateMarketSignals(signals: any): signals is MarketSignals {
  const errors: string[] = [];

  if (typeof signals !== 'object' || signals === null) {
    throw new ValidationError('Signals must be an object', ['signals']);
  }

  const dexVol = Number(signals.dexVolume24h);
  if (isNaN(dexVol) || dexVol < 0) {
    errors.push('dexVolume24h must be a positive number');
  }

  const vol = Number(signals.volatility);
  if (isNaN(vol) || vol < 0 || vol > 100) {
    errors.push('volatility must be between 0-100');
  }

  const oi = Number(signals.openInterest);
  if (isNaN(oi) || oi < 0) {
    errors.push('openInterest must be a positive number');
  }

  if (!['risk-on', 'risk-off', 'neutral'].includes(signals.stablecoinTrend)) {
    errors.push('stablecoinTrend must be risk-on, risk-off, or neutral');
  }

  const price = Number(signals.wethPrice);
  if (isNaN(price) || price <= 0) {
    errors.push('wethPrice must be a positive number');
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid market signals', errors);
  }

  return true;
}

/**
 * Validates pair history
 */
export function validatePairHistory(history: any): history is PairHistory {
  const errors: string[] = [];

  if (typeof history !== 'object' || history === null) {
    throw new ValidationError('Pair history must be an object', ['pairHistory']);
  }

  if (typeof history.pair !== 'string' || history.pair.length === 0) {
    errors.push('pair must be a non-empty string');
  }

  const profitable = Number(history.profitableTradesCount);
  if (!Number.isInteger(profitable) || profitable < 0) {
    errors.push('profitableTradesCount must be a non-negative integer');
  }

  const total = Number(history.totalTradesCount);
  if (!Number.isInteger(total) || total <= 0) {
    errors.push('totalTradesCount must be a positive integer');
  }

  if (profitable > total) {
    errors.push('profitableTradesCount cannot exceed totalTradesCount');
  }

  const winRate = Number(history.winRate);
  if (isNaN(winRate) || winRate < 0 || winRate > 1) {
    errors.push('winRate must be between 0-1');
  }

  const surplus = Number(history.averageSurplus);
  if (isNaN(surplus)) {
    errors.push('averageSurplus must be a number');
  }

  const vol = Number(history.volatilityObserved);
  if (isNaN(vol) || vol < 0 || vol > 100) {
    errors.push('volatilityObserved must be between 0-100');
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid pair history', errors);
  }

  return true;
}

/**
 * Validates trading context
 */
export function validateTradingContext(context: any): boolean {
  const errors: string[] = [];

  if (typeof context !== 'object' || context === null) {
    throw new ValidationError('Context must be an object', ['context']);
  }

  const surplus = Number(context.surplus);
  if (isNaN(surplus) || surplus < 0) {
    errors.push('surplus must be a non-negative number');
  }

  const capital = Number(context.totalCapital);
  if (isNaN(capital) || capital <= 0) {
    errors.push('totalCapital must be a positive number');
  }

  if (surplus > capital) {
    errors.push('surplus cannot exceed totalCapital');
  }

  const leverage = Number(context.currentLeverage);
  if (isNaN(leverage) || leverage < 1 || leverage > 10) {
    errors.push('currentLeverage must be between 1-10');
  }

  const loss = Number(context.dailyLoss);
  if (isNaN(loss)) {
    errors.push('dailyLoss must be a number');
  }

  const drawdown = Number(context.currentDrawdown);
  if (isNaN(drawdown) || drawdown < 0 || drawdown > 1) {
    errors.push('currentDrawdown must be between 0-1');
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid trading context', errors);
  }

  return true;
}

/**
 * Validates trade parameters
 */
export function validateTradeParams(pair: string, markup: number): boolean {
  const errors: string[] = [];

  if (typeof pair !== 'string' || pair.length === 0) {
    errors.push('pair must be a non-empty string');
  }

  const markupNum = Number(markup);
  if (isNaN(markupNum) || markupNum < 0 || markupNum > 0.1) {
    errors.push('markup must be between 0-0.1 (0-10%)');
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid trade parameters', errors);
  }

  return true;
}

/**
 * Validates capital value
 */
export function validateCapital(value: any): number {
  const num = Number(value);

  if (isNaN(num) || num <= 0) {
    throw new ValidationError('Capital must be a positive number', ['capital']);
  }

  return num;
}

/**
 * Validates accuracy value (0-1 or 0-100)
 */
export function validateAccuracy(value: any): number {
  const num = Number(value);

  if (isNaN(num)) {
    throw new ValidationError('Accuracy must be a number', ['accuracy']);
  }

  // Normalize to 0-1 if > 1
  if (num > 1) {
    if (num > 100) {
      throw new ValidationError('Accuracy cannot exceed 100%', ['accuracy']);
    }
    return num / 100;
  }

  if (num < 0 || num > 1) {
    throw new ValidationError('Accuracy must be between 0-1 or 0-100', ['accuracy']);
  }

  return num;
}

/**
 * Validates correlation ID
 */
export function validateCorrelationId(id: string): boolean {
  if (typeof id !== 'string' || id.length === 0) {
    throw new ValidationError('Correlation ID must be a non-empty string', ['correlationId']);
  }

  return true;
}
