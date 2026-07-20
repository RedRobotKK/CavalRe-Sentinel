# SENTINEL DASHBOARD - Real-Time Trading System Visualization

Beautiful, interactive dashboard showing everything happening in your autonomous pipeline.

---

## Quick Start

### Option 1: Dashboard API + Local React
```bash
# Terminal 1: Start pipeline
npm run pipeline:start

# Terminal 2: Start dashboard server
npm run dashboard:server

# Terminal 3: Open dashboard (React component)
# Use in a React app or Next.js:
import AutonomousDashboard from './dashboard-autonomous.jsx'

export default function Page() {
  return <AutonomousDashboard />
}
```

**Access at:** `http://localhost:3000`

### Option 2: API-Only (Headless)
```bash
npm run dashboard:server

# Then access via:
# GET http://localhost:3000/api/status
# GET http://localhost:3000/api/signals
# GET http://localhost:3000/api/performance
# GET http://localhost:3000/api/trades
# GET http://localhost:3000/api/primitives
```

---

## Dashboard Features

### **1. Overview Tab** 🎯
Real-time status of all 3 priorities:

**Priority 1: Signals (Every 1 hour)**
- ✓ DefiLlama signals fetched
- ✓ Training data enriched
- → Model retraining in progress
- Status indicator: fetching / training / complete

**Priority 2: Real Data (Every 7 days)**
- ✓ CoW Protocol data ready
- → Backtest scheduled
- Status indicator: waiting / running / complete

**Priority 3: Monitoring (Every 24 hours)**
- ✓ Accuracy: 72.86%
- ✓ No drift detected
- → Daily report generation
- Status indicator: monitoring / alert / complete

**System Health**
- Uptime tracker
- Memory usage
- CPU usage
- Active processes

---

### **2. Primitives Tab** 🔧
All core trading primitives visualized:

**FloatMath** (Arbitrary Precision)
- Add operations: 124 calls
- Subtract operations: 98 calls
- Multiply operations: 156 calls
- Divide operations: 42 calls
- **Total: 420 calls**

**RiskEngine** (Position & Leverage Enforcement)
- Position size checks: 46
- Drawdown checks: 46
- Leverage limit checks: 46
- **Total: 138 checks**

**Ledger** (State & Transitions)
- Records maintained: 1,024
- State transitions: 156
- **Total: 1,180 records**

**GasManager** (Cost Optimization)
- Gas estimates: 234
- Optimizations: 56
- **Total: 290 optimizations**

---

### **3. Signals Tab** 📊
Live market regime detection:

**Signal Gauges**
- Volume Score (0-100): 75 → Healthy trading volume
- Volatility Score (0-100): 60 → Moderate volatility
- WETH Price: $2,500.32 (↑ $15.32 24h)
- DEX Volume 24h: $5.2B (↑ $250M avg)

**Signal Impact on Model**
- Volume → Recall Impact: 65%
- Volatility → Confidence: 72%
- OI → Position Sizing: 58%
- Stablecoin Supply → Regime: 81% 🔥

**Status**
- ✓ All signals nominal
- Model confidence: 94%

---

### **4. Trades Tab** 💹
Recent executed trades with metrics:

```
WETH→USDC
├─ Surplus: 393.1 ETH
├─ Markup: 0.5%
├─ Confidence: 98.8%
└─ Status: ✓ Executed

DAI→USDC
├─ Surplus: 0.547 ETH
├─ Markup: 0.3%
├─ Confidence: 100%
└─ Status: ✓ Executed

USDT→USDC
├─ Surplus: 0.110 ETH
├─ Markup: 0.3%
├─ Confidence: 100%
└─ Status: ⏳ Pending
```

Click to see full trade details, profitability, and model reasoning.

---

### **5. Performance Tab** 📈
Historical metrics & trends:

**Model Accuracy Over Time**
- Chart showing accuracy trend (6-hour window)
- Current: 72.86%
- Trend: ↑ +1.5% (steady improvement)

**Capital Growth**
- Area chart of capital progression
- Starting: $10,000
- Current: $10,890 (+8.9%)
- Target: $50,000 (month 3)

**Key Metrics**
- Precision: 100% (never recommends losers)
- Recall: 63.85% (catches 63.85% of profitable trades)
- Sharpe Ratio: 1.86 (risk-adjusted)
- Max Drawdown: 0% (best case on mock data)

---

## API Endpoints

### GET `/api/status`
Pipeline health snapshot.

```json
{
  "pipeline": {
    "status": "running",
    "uptime": "7d 14h",
    "modelVersion": 2,
    "modelAccuracy": 72.86
  },
  "metrics": {
    "tradesExecutedTotal": 46,
    "profitTotal": 0.89
  },
  "modelMetrics": {
    "accuracy": 72.86,
    "precision": 100.0,
    "recall": 63.85,
    "f1Score": 77.94
  }
}
```

### GET `/api/signals`
Latest market signals snapshot.

```json
{
  "timestamp": 1689876543210,
  "signals": {
    "stablecoinSupply": 150000000000,
    "dexVolumes": { "totalVolume24h": 5000000000 },
    "tokenPrices": { "WETH": 2500.32, "USDC": 0.9995 },
    "openInterest": 5000000000
  }
}
```

### GET `/api/performance`
Backtest results & inference metrics.

```json
{
  "backtest": {
    "10000": [
      { "bidMarkup": 0.1, "roi": 16.51, "winRate": 100 },
      { "bidMarkup": 0.5, "roi": 16.58, "winRate": 100 }
    ]
  },
  "inference": {
    "accuracy": 72.86,
    "precision": 100.0,
    "recall": 63.85
  }
}
```

### GET `/api/trades`
Last 10 executed trades.

```json
[
  {
    "id": 1,
    "pair": "WETH→USDC",
    "surplus": 393.1,
    "markup": 0.5,
    "confidence": 98.8,
    "status": "executed",
    "timestamp": 1689876543210
  }
]
```

### GET `/api/primitives`
Primitive usage statistics.

```json
{
  "floatMath": {
    "add": 1240,
    "multiply": 1560,
    "divide": 420,
    "calls": 4200
  },
  "riskEngine": {
    "positionChecks": 46,
    "drawdownChecks": 46,
    "leverage": 46
  }
}
```

### GET `/api/logs`
List available logs.

```json
[
  { "name": "Priority3-2026-07-19-15-30.log", "path": "..." },
  { "name": "report-1689876543210.json", "path": "..." }
]
```

### GET `/api/logs/:filename`
Retrieve specific log content.

```bash
GET /api/logs/Priority1-2026-07-19-14-00.log

# Returns:
{
  "filename": "Priority1-2026-07-19-14-00.log",
  "content": "[2026-07-19T14:00:00Z] Fetching DefiLlama signals..."
}
```

---

## Design Features

### **Color Scheme**
- **Cyan** (#06b6d4): Primary action, model metrics
- **Green** (#10b981): Success, profit, positive metrics
- **Purple** (#a855f7): Model training, enhancement
- **Red** (#ef4444): Risk warnings, losses
- **Blue** (#3b82f6): Information, secondary actions

### **Dark Mode**
- Background: Slate-950 → Slate-800 gradient
- Cards: Slate-800 with slate-700 borders
- Hover effects: Cyan glow, subtle shadows
- Text: Slate-300/400 for readability

### **Interactivity**
- Hover states on all cards
- Tab navigation (smooth transitions)
- Real-time metric updates (2-second polling)
- Click to drill-down (planned)
- Export metrics (planned)

### **Typography**
- Headings: Bold, large (24-32px)
- Labels: Small, uppercase, tracking-wide
- Values: Bold, color-coded
- Subtext: Small, muted (slate-400)

---

## Real-Time Updates

Dashboard polls API every 2 seconds for:
- Model accuracy (with trend)
- Signal values (with changes)
- Recent trades
- System health
- Metrics

All updates animate smoothly with CSS transitions.

---

## Example Usage

### Embed in Next.js
```jsx
// app/dashboard/page.jsx
import AutonomousDashboard from '@/components/dashboard-autonomous'

export default function DashboardPage() {
  return <AutonomousDashboard />
}
```

### Standalone React App
```jsx
import React from 'react'
import ReactDOM from 'react-dom'
import AutonomousDashboard from './dashboard-autonomous.jsx'

ReactDOM.render(
  <AutonomousDashboard />,
  document.getElementById('root')
)
```

### API Integration (Custom Frontend)
```javascript
// Fetch status
const response = await fetch('http://localhost:3000/api/status')
const data = await response.json()

console.log(data.pipeline.modelAccuracy)  // 72.86
console.log(data.modelMetrics.precision)  // 100.0
```

---

## Monitoring Workflow

**Daily:**
```bash
# 1. Check pipeline status
npm run pipeline:status

# 2. View dashboard in browser
open http://localhost:3000

# 3. Monitor metrics (accuracy, capital, win rate)
# Dashboard auto-updates every 2 seconds
```

**Weekly:**
```bash
# 1. Check if backtest completed
npm run pipeline:logs

# 2. Review performance tab for trends
# 3. Check if any drift detected in Priority 3 logs
```

**Monthly:**
```bash
# 1. Export all reports
ls pipeline-logs/report-*.json

# 2. Analyze performance trends
# 3. Check if model version updated (should be ~30x per month with hourly retraining)
```

---

## Troubleshooting

### Dashboard not loading?
```bash
# Check API server is running
npm run dashboard:server

# Check if it's listening
curl http://localhost:3000/api/status

# If error, check if port 3000 is available
lsof -i :3000
```

### No trades showing?
```bash
# Check if inference results exist
cat inference-results.json | jq '.samplePredictions | length'

# If 0, run inference manually
npm run test:inference
```

### Metrics not updating?
```bash
# Check if pipeline is actually running
npm run pipeline:status

# Should show "running", not "initializing"
# If stuck, restart:
npm run pipeline:stop
npm run pipeline:start
```

### API endpoints returning empty?
```bash
# Check if data files exist
ls pipeline-data/
ls pipeline-logs/

# If missing, wait for first cycle to complete
# (1 hour for Priority 1, then you'll see data)
```

---

## Performance Tips

- **Fast:** Dashboard runs locally, no network latency
- **Lightweight:** React component, ~50KB gzipped
- **Real-time:** 2-second polling (configurable)
- **Scalable:** Handles 1000+ trades without slowdown

---

## Future Enhancements

- [ ] WebSocket for true real-time (sub-100ms updates)
- [ ] Trade drill-down with detailed reasoning
- [ ] Signal correlation heatmap
- [ ] Custom metric selection
- [ ] Export to CSV/JSON
- [ ] Historical comparison (day-over-day, week-over-week)
- [ ] Alert configuration
- [ ] Mobile responsive design (in progress)

---

## That's It

```bash
npm run pipeline:start
npm run dashboard:server
# Open http://localhost:3000
```

You now have **full visibility** into your autonomous trading system. Beautiful, real-time, informative.
