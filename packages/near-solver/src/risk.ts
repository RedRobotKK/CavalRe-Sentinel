/**
 * SOLVER RISK GUARD
 *
 * Hard limits for the quoting path. Everything is fail-closed:
 * an unknown notional is a rejected quote, full stop.
 *
 * The kill switch is deliberately NOT cleared by resetDay(): if something
 * tripped it, a human (or an explicit supervisor process) must clear it.
 */

import * as FloatLib from '@cavalre/floatlib-ts';

export interface SolverRiskConfig {
  /** Max USD notional for a single quote (inclusive). */
  maxQuoteNotionalUsd: FloatLib.FloatFixed;
  /** Max cumulative realized daily loss in USD before quoting halts. */
  maxDailyLossUsd: FloatLib.FloatFixed;
}

export interface RiskVerdict {
  allowed: boolean;
  reason: string;
}

const ALLOWED: RiskVerdict = { allowed: true, reason: 'ok' };

export class SolverRiskGuard {
  private killSwitchReason: string | null = null;
  private dailyPnlUsd: FloatLib.FloatFixed = FloatLib.ZERO;

  constructor(private readonly config: SolverRiskConfig) {}

  checkQuote(params: { notionalUsd: FloatLib.FloatFixed | null }): RiskVerdict {
    if (this.killSwitchReason !== null) {
      return { allowed: false, reason: `kill_switch:${this.killSwitchReason}` };
    }
    if (params.notionalUsd === null) {
      return { allowed: false, reason: 'unpriceable_notional' };
    }
    if (FloatLib.isGT(params.notionalUsd, this.config.maxQuoteNotionalUsd)) {
      return { allowed: false, reason: 'notional_exceeds_max' };
    }
    if (this.isDailyLossExceeded()) {
      return { allowed: false, reason: 'daily_loss_exceeded' };
    }
    return ALLOWED;
  }

  /** Record realized PnL (negative = loss). Called on settlement reconciliation. */
  recordRealizedPnlUsd(pnlUsd: FloatLib.FloatFixed): void {
    this.dailyPnlUsd = FloatLib.plus(this.dailyPnlUsd, pnlUsd);
  }

  private isDailyLossExceeded(): boolean {
    // Loss = -PnL when PnL is negative
    const loss = FloatLib.minus(this.dailyPnlUsd); // negate
    return FloatLib.isGT(loss, this.config.maxDailyLossUsd);
  }

  tripKillSwitch(reason: string): void {
    this.killSwitchReason = reason;
  }

  clearKillSwitch(): void {
    this.killSwitchReason = null;
  }

  /** Roll the daily loss window. Does NOT clear the kill switch by design. */
  resetDay(): void {
    this.dailyPnlUsd = FloatLib.ZERO;
  }

  get state(): { killSwitch: string | null; dailyPnlUsd: number } {
    return {
      killSwitch: this.killSwitchReason,
      dailyPnlUsd: FloatLib.toNumber(this.dailyPnlUsd),
    };
  }
}
