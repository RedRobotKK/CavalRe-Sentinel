#!/usr/bin/env python3
"""
DEFILLAMA SIGNAL FETCHER - Local Run
Fetch free-tier signals and correlate with CoW intent data
Run on your machine (not in workspace - network proxy blocks API calls)

Usage:
    python3 fetch-signals.py
    python3 fetch-signals.py --schedule daily
"""

import requests
import json
import sys
from pathlib import Path
from datetime import datetime
import time

API_BASE = "https://api.llama.fi"
RATE_LIMIT = 1  # seconds between requests

# Tokens
TOKENS = {
    "USDC": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "USDT": "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "DAI": "0x6b175474e89094c44da98b954eedeac495271d0f",
    "WETH": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
}

class DefiLlamaFetcher:
    def __init__(self):
        self.session = requests.Session()
        self.signals = {}
        self.timestamp = int(time.time() * 1000)

    def fetch(self, endpoint):
        """Fetch with retry and rate limiting"""
        url = f"{API_BASE}{endpoint}"
        print(f"  → {endpoint[:50]}...", end="", flush=True)

        for attempt in range(3):
            try:
                resp = self.session.get(url, timeout=10)
                resp.raise_for_status()
                print(" ✓")
                time.sleep(RATE_LIMIT)
                return resp.json()
            except Exception as e:
                if attempt == 2:
                    print(f" ✗ ({e})")
                    return None
                time.sleep(2 ** attempt)

    def fetch_dex_volumes(self):
        """DEX volume signal - where is trading happening?"""
        print("📊 DEX Volumes")
        data = self.fetch("/overview/dexs")
        if not data:
            return None

        return {
            "timestamp": self.timestamp,
            "totalVolume24h": data.get("totalVolume24h", 0),
            "topDexs": [
                {"name": d["name"], "volume24h": d.get("volume24h", 0)}
                for d in sorted(data.get("dexs", []),
                               key=lambda x: x.get("volume24h", 0),
                               reverse=True)[:5]
            ]
        }

    def fetch_stablecoin_supply(self):
        """Stablecoin supply - risk-on/risk-off regime"""
        print("📊 Stablecoin Supply")
        data = self.fetch("/stablecoins")
        if not data:
            return None

        chart = self.fetch("/stablecoincharts/all")
        if not chart:
            return None

        latest = chart[-1] if chart else [0, 0]
        prev = chart[-2] if len(chart) > 1 else [0, 0]

        return {
            "timestamp": self.timestamp,
            "totalSupply": latest[1],
            "change24h": latest[1] - prev[1],
            "topStables": [
                {"name": s["name"], "supply": s.get("supply", 0)}
                for s in sorted(data.get("peggedAssets", []),
                              key=lambda x: x.get("supply", 0),
                              reverse=True)[:5]
            ]
        }

    def fetch_token_prices(self):
        """Token prices - volatility and momentum"""
        print("📊 Token Prices")
        token_str = ",".join([f"ethereum:{addr}" for addr in TOKENS.values()])
        data = self.fetch(f"/prices/current/{token_str}")
        if not data:
            return None

        prices = {}
        for symbol, addr in TOKENS.items():
            key = f"ethereum:{addr}"
            coin_data = data.get("coins", {}).get(key, {})
            prices[symbol] = {
                "price": coin_data.get("price", 0),
                "timestamp": coin_data.get("timestamp", 0)
            }

        return {
            "timestamp": self.timestamp,
            "prices": prices
        }

    def fetch_protocol_tvl(self):
        """Protocol TVL - liquidity and capital flows"""
        print("📊 Protocol TVL")
        data = self.fetch("/protocols")
        if not data:
            return None

        protocols = {}
        for proto in sorted(data, key=lambda x: x.get("tvl", 0), reverse=True)[:10]:
            protocols[proto["slug"]] = {
                "tvl": proto.get("tvl", 0),
                "change24h": proto.get("change_1d", 0)
            }

        return {
            "timestamp": self.timestamp,
            "protocols": protocols,
            "totalTvl": sum(p.get("tvl", 0) for p in data)
        }

    def fetch_yields(self):
        """Yields - capital allocation signal"""
        print("📊 Yields/APY")
        data = self.fetch("/pools")
        if not data:
            return None

        pools = data.get("data", [])
        top_yields = sorted(
            [p for p in pools if p.get("tvl") and p.get("apy")],
            key=lambda x: x.get("apy", 0),
            reverse=True
        )[:10]

        return {
            "timestamp": self.timestamp,
            "topYields": [
                {
                    "pool": y.get("symbol", y.get("pool", "unknown")),
                    "apy": y.get("apy", 0),
                    "tvl": y.get("tvlUsd", 0),
                    "protocol": y.get("project", "")
                }
                for y in top_yields
            ]
        }

    def fetch_open_interest(self):
        """Open interest - leverage sentiment"""
        print("📊 Open Interest")
        data = self.fetch("/overview/open-interest")
        if not data:
            return None

        exchanges = sorted(
            data.get("protocols", []),
            key=lambda x: x.get("openInterest", 0),
            reverse=True
        )[:5]

        return {
            "timestamp": self.timestamp,
            "totalOI": sum(e.get("openInterest", 0) for e in data.get("protocols", [])),
            "topExchanges": [
                {
                    "name": e["name"],
                    "openInterest": e.get("openInterest", 0)
                }
                for e in exchanges
            ]
        }

    def fetch_all(self):
        """Fetch all signals"""
        print("\n╔════════════════════════════════════════════╗")
        print("║  DEFILLAMA SIGNAL FETCHER                  ║")
        print("║  Free tier - no auth required              ║")
        print("╚════════════════════════════════════════════╝\n")

        self.signals["dexVolumes"] = self.fetch_dex_volumes()
        self.signals["stablecoinSupply"] = self.fetch_stablecoin_supply()
        self.signals["tokenPrices"] = self.fetch_token_prices()
        self.signals["protocolTvl"] = self.fetch_protocol_tvl()
        self.signals["yields"] = self.fetch_yields()
        self.signals["openInterest"] = self.fetch_open_interest()

        return self.signals

    def save(self, output_dir="signals-data"):
        """Save signals to JSON"""
        Path(output_dir).mkdir(exist_ok=True)

        timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        output_file = Path(output_dir) / f"signals_{timestamp_str}.json"

        output = {
            "timestamp": self.timestamp,
            "date": datetime.utcfromtimestamp(self.timestamp / 1000).isoformat(),
            "signals": {k: v for k, v in self.signals.items() if v}
        }

        with open(output_file, "w") as f:
            json.dump(output, f, indent=2)

        # Also append to history
        history_file = Path(output_dir) / "signals_history.jsonl"
        with open(history_file, "a") as f:
            f.write(json.dumps(output) + "\n")

        print(f"\n✅ SIGNALS SAVED")
        print(f"   Snapshot: {output_file}")
        print(f"   History: {history_file}")
        print(f"\n📊 Data collected:")
        for key, val in output["signals"].items():
            status = "✓" if val else "✗"
            print(f"   {status} {key}")

if __name__ == "__main__":
    fetcher = DefiLlamaFetcher()
    fetcher.fetch_all()
    fetcher.save()

    print(f"\nNext: Correlate signals-data/ with intents-mock.json")
    print(f"      to find which signals predict higher surplus.")
