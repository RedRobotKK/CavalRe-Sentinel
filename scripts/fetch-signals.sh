#!/bin/bash

# FETCH DEFILLAMA SIGNALS - Run this on your local machine
# Usage: ./fetch-signals.sh

echo "╔════════════════════════════════════════════╗"
echo "║  FETCH DEFILLAMA SIGNALS (LOCAL)           ║"
echo "║  Run this on your machine, not in workspace║"
echo "╚════════════════════════════════════════════╝"
echo ""

OUTPUT_DIR="./signals-data"
mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
OUTPUT_FILE="$OUTPUT_DIR/signals_${TIMESTAMP}.json"

echo "📊 Fetching DEX volumes..."
DEX_VOLUMES=$(curl -s "https://api.llama.fi/overview/dexs" | head -c 5000)
sleep 1

echo "📊 Fetching stablecoin supply..."
STABLE_SUPPLY=$(curl -s "https://api.llama.fi/stablecoins" | head -c 5000)
sleep 1

echo "📊 Fetching token prices (USDC, USDT, DAI, WETH)..."
PRICES=$(curl -s "https://api.llama.fi/prices/current/ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48,ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7,ethereum:0x6b175474e89094c44da98b954eedeac495271d0f,ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2")
sleep 1

echo "📊 Fetching protocol TVL..."
PROTOCOLS=$(curl -s "https://api.llama.fi/protocols" | jq 'map(select(.tvl > 100000000)) | .[0:10]' 2>/dev/null)
sleep 1

echo "📊 Fetching yields..."
YIELDS=$(curl -s "https://api.llama.fi/pools" | jq '.data | map(select(.tvl > 100000)) | sort_by(.apy) | reverse | .[0:10]' 2>/dev/null)
sleep 1

echo "📊 Fetching open interest..."
OI=$(curl -s "https://api.llama.fi/overview/open-interest" | jq '.protocols | sort_by(.openInterest) | reverse | .[0:5]' 2>/dev/null)
sleep 1

# Save combined output
cat > "$OUTPUT_FILE" << EOF
{
  "timestamp": $(date +%s)000,
  "date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "signals": {
    "dexVolumes": $DEX_VOLUMES,
    "stablecoinSupply": $STABLE_SUPPLY,
    "tokenPrices": $PRICES,
    "protocolTvl": $PROTOCOLS,
    "yields": $YIELDS,
    "openInterest": $OI
  }
}
EOF

echo ""
echo "✅ SIGNALS SAVED"
echo "   File: $OUTPUT_FILE"
echo ""
echo "📊 Data collected:"
echo "   ✓ DEX volumes"
echo "   ✓ Stablecoin supply"
echo "   ✓ Token prices (USDC/USDT/DAI/WETH)"
echo "   ✓ Top 10 protocols by TVL"
echo "   ✓ Top 10 yield opportunities"
echo "   ✓ Top 5 perpetual exchanges by OI"
echo ""
echo "Next steps:"
echo "1. Run this script daily: 'watch -n 86400 ./fetch-signals.sh'"
echo "2. Correlate signals-data/ with intents-mock.json"
echo "3. Identify which signals predict higher CoW surplus"
