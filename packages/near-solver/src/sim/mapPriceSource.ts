/**
 * In-memory USD mids → PriceSource for Tier A sim / offline decide().
 * mid(a,b) = usd(a) / usd(b). Null if either leg missing.
 */

import * as FloatLib from '@cavalre/floatlib-ts';
import type { PriceSource } from '../solver.js';

export class MapPriceSource implements PriceSource {
  private mids = new Map<string, number>();

  setMids(midsUsd: Record<string, number>): void {
    this.mids.clear();
    for (const [asset, px] of Object.entries(midsUsd)) {
      if (Number.isFinite(px) && px > 0) this.mids.set(asset, px);
    }
  }

  usdPrice(asset: string): FloatLib.FloatFixed | null {
    const px = this.mids.get(asset);
    if (px === undefined) return null;
    return FloatLib.toFloat(BigInt(Math.round(px * 1e8)), 8n);
  }

  mid(assetIn: string, assetOut: string): FloatLib.FloatFixed | null {
    const a = this.mids.get(assetIn);
    const b = this.mids.get(assetOut);
    if (a === undefined || b === undefined || b === 0) return null;
    const ratio = a / b;
    return FloatLib.toFloat(BigInt(Math.round(ratio * 1e12)), 12n);
  }
}
