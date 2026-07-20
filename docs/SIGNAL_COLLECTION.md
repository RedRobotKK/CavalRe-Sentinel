# DefiLlama Signal Collection

**TL;DR:** Run locally on your machine (network proxy blocks workspace API calls). Grab free-tier signals to correlate with intent data.

## Setup

### Option 1: Bash Script (Simple)
```bash
cd CavalRe-Sentinel
chmod +x fetch-signals.sh
./fetch-signals.sh
```

Creates: `signals-data/signals_YYYYMMDD_HHMMSS.json`

### Option 2: Python Script (Robust)
```bash
cd CavalRe-Sentinel
python3 fetch-signals.py
```

Creates:
- `signals-data/signals_YYYYMMDD_HHMMSS.json` (single snapshot)
- `signals-data/signals_history.jsonl` (append-only history for correlation)

## What Signals Are Collected

### 1. **DEX Volumes** (Where is trading happening?)
```json
{
  "totalVolume24h": 1234567890,
  "topDexs": [
    {"name": "Uniswap", "volume24h": 500000000},
    {"name": "Curve", "volume24h": 300000000}
  ]
}
```
**Use case:** High volume = more CoW orders possible. Correlate with your surplus.

### 2. **Stablecoin Supply** (Risk-On/Risk-Off Regime)
```json
{
  "totalSupply": 150000000000,
  "change24h": 500000000,
  "topStables": [
    {"name": "USDC", "supply": 50000000000}
  ]
}
```
**Use case:** Rising supply = risk-on (bull market). Falling = risk-off (bear market).
Signal: Adjust your bid markup based on regime.

### 3. **Token Prices** (Volatility & Momentum)
```json
{
  "prices": {
    "USDC": {"price": 0.9995},
    "WETH": {"price": 2500.50}
  }
}
```
**Use case:** High volatility = wider spreads = more surplus.

### 4. **Protocol TVL** (Liquidity & Capital Flows)
```json
{
  "protocols": {
    "uniswap": {"tvl": 5000000000, "change24h": 100000000},
    "aave": {"tvl": 10000000000, "change24h": -50000000}
  }
}
```
**Use case:** TVL dropping = capital fleeing = potential execution slippage.

### 5. **Yields** (Capital Allocation Signal)
```json
{
  "topYields": [
    {"pool": "USDC-WETH", "apy": 25.5, "tvl": 100000000}
  ]
}
```
**Use case:** High yields on stablecoins = risky = predict bid spreads.

### 6. **Open Interest** (Leverage & Sentiment)
```json
{
  "totalOI": 5000000000,
  "topExchanges": [
    {"name": "Dydx", "openInterest": 2000000000}
  ]
}
```
**Use case:** High OI = aggressive traders = wider bid/ask spreads.

## Correlation Workflow

### Step 1: Collect Signals Daily
```bash
# Run daily (e.g., via cron, systemd timer, or watch)
*/30 * * * * cd ~/CavalRe-Sentinel && python3 fetch-signals.py
```

### Step 2: Correlate with Intents
```python
import json
import pandas as pd

# Load signals
with open('signals-data/signals_latest.json') as f:
    signals = json.load(f)

# Load intents
with open('intents-mock.json') as f:
    intents = json.load(f)

# Create signal dataframe
signal_df = pd.DataFrame([signals])  # Time-indexed

# Create intent dataframe
intent_df = pd.DataFrame(intents)
intent_df['created_timestamp'] = intent_df['created_at']

# Join on timestamp (intents → closest signal)
merged = pd.merge_asof(
    intent_df.sort_values('created_timestamp'),
    signal_df.sort_values('timestamp'),
    left_on='created_timestamp',
    right_on='timestamp'
)

# Correlation: Do high DEX volumes predict higher surplus?
correlation = merged['dexVolumes.totalVolume24h'].corr(
    merged['executed_surplus']
)
print(f"DEX Volume → Surplus correlation: {correlation}")
```

### Step 3: Train SLM with Signals
Incorporate signal features into your model:

```python
# Feature engineering
features = {
    'stablecoin_supply_trend': signals['stablecoinSupply']['change24h'],
    'dex_volume_24h': signals['dexVolumes']['totalVolume24h'],
    'protocol_tvl_change': signals['protocolTvl']['protocols']['uniswap']['change24h'],
    'average_yield': np.mean([y['apy'] for y in signals['yields']['topYields']]),
    'open_interest': signals['openInterest']['totalOI'],
    'weth_price': signals['tokenPrices']['prices']['WETH']['price'],
}

# Use as input to your SLM decision model
bid_markup = model.predict(features)  # Outputs bid markup %
```

## Free Tier Rate Limits

- **Requests per second:** ~3-5 (we rate limit to 1/sec to be safe)
- **Total endpoints:** 31 free endpoints available
- **Auth required:** No

**Avoid:** Pro API ($300/mo) — unnecessary for initial development.

## Troubleshooting

### "403 Forbidden - blocked-by-allowlist"
**Problem:** Network proxy blocking API calls.  
**Solution:** Run script on your local machine (outside workspace).

### "Connection timeout"
**Problem:** API slow or rate limited.  
**Solution:** Already included - script retries 3x with exponential backoff.

### "KeyError in correlation"
**Problem:** Signal data missing.  
**Solution:** Check that signals are fetching (look for ✓ in output). Some endpoints may be rate-limited.

## Files Created

```
CavalRe-Sentinel/
├── fetch-signals.sh              # Bash version (simple)
├── fetch-signals.py              # Python version (robust)
├── SIGNAL_COLLECTION.md          # This file
├── signals-data/                 # Output directory
│   ├── signals_20260719_120000.json     # Single snapshot
│   ├── signals_20260719_120500.json     # Next snapshot
│   └── signals_history.jsonl            # All history (one JSON per line)
├── intents-mock.json             # Mock training data (10k intents)
└── intents-mock.csv              # Preview
```

## Example: Daily Automation

### macOS/Linux (crontab)
```bash
# Edit crontab
crontab -e

# Add this line (runs every 30 minutes)
*/30 * * * * cd ~/CavalRe-Sentinel && python3 fetch-signals.py >> signals.log 2>&1
```

### macOS (launchd)
Create `~/Library/LaunchAgents/com.sentinel.signals.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.sentinel.signals</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/Users/daniel/Development/CavalRe-Sentinel/fetch-signals.py</string>
    </array>
    <key>StartInterval</key>
    <integer>1800</integer> <!-- 30 minutes -->
</dict>
</plist>
```

Then:
```bash
launchctl load ~/Library/LaunchAgents/com.sentinel.signals.plist
```

## Next Steps

1. **Run the fetcher** once to confirm it works
2. **Set up daily automation** (cron or launchd)
3. **Collect 2-4 weeks of signal history**
4. **Correlate signals with intents** to find alpha
5. **Train SLM with signal features** to improve surplus prediction
6. **Backtest** with real CoW data + signals together

---

**Note:** This uses only **free-tier** endpoints. Once you identify which signals matter, you can upgrade to Pro ($300/mo) to access:
- Token unlocks (supply shock prediction)
- Bridge activity (capital flow tracking)
- Borrow rates (interest rate signals)
- Historical liquidity (slippage curves)

But start free. Most edge comes from combining simple signals well.
