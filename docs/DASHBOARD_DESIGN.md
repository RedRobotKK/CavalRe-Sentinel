# Professional Solver Dashboard
## Real-time Monitoring + Wallet Integration

---

## Design Principles

**Look:** Deribit/GMX-level professional  
**Feel:** Real-time data streaming  
**Function:** See capital, see solver running, see profit happening  
**Integration:** One-click wallet connect, auto-load balance  

---

## Dashboard Screens

### Screen 1: Live Status (Main)

```
┌─────────────────────────────────────────────────────────┐
│  🤖 SOLVER STATUS                    🔌 Connect Wallet  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐  ┌──────────────────────────────┐│
│  │ 💰 CAPITAL      │  │ 📊 PERFORMANCE               ││
│  │ $50,234.50      │  │ Win Rate: 27.3% ✅           ││
│  │ (USDC + ETH)    │  │ Daily P&L: +$1,234          ││
│  │                 │  │ Total Profit: +$12,450       ││
│  │ ┌─ LIVE ─┐      │  │ Model Accuracy: 76%          ││
│  └─────────────────┘  │ Solver Uptime: 18h 34m       ││
│                       │ Last Trade: 2 sec ago        ││
│                       └──────────────────────────────┘│
│                                                          │
│  ┌──────────────────────────────────────────────────────┐│
│  │ 📡 LIVE INTENT STREAM (Real-time)                    ││
│  │                                                      ││
│  │ [NOW] USDC→ETH  $5,234  Gas: 45 Gwei                ││
│  │       ↳ Decision: BID $450 (92% confident)         ││
│  │       ↳ Status: SUBMITTED (awaiting outcome)        ││
│  │                                                      ││
│  │ [2s]  ETH→wstETH $12,000 Gas: 42 Gwei               ││
│  │       ↳ Decision: SKIP (low win rate)              ││
│  │                                                      ││
│  │ [4s]  USDC→USDT $8,500 Gas: 48 Gwei                 ││
│  │       ↳ Decision: BID $400 (85% confident)         ││
│  │       ↳ Status: WON ✅ +$287 profit                ││
│  │                                                      ││
│  │ [7s]  DAI→ETH $3,200 Gas: 46 Gwei                   ││
│  │       ↳ Decision: BID $300 (78% confident)         ││
│  │       ↳ Status: LOST ❌ -$50 (gas)                 ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌──────────────────────────────────────────────────────┐│
│  │ 📈 PROFIT OVER TIME (Last 24h)                       ││
│  │                                                      ││
│  │     +$1.5k ┤                                    ╱╱   ││
│  │     +$1.0k ┤                              ╱╱╱        ││
│  │     +$500  ┤                        ╱╱╱╱             ││
│  │        $0  ┼──────────────────────╱                  ││
│  │    -$500   ┤                                         ││
│  │     -$1.0k ┤                                         ││
│  │            └─────────────────────────────────────    ││
│  │            0h    6h    12h   18h   24h              ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

### Screen 2: Wallet & Capital Management

```
┌─────────────────────────────────────────────────────────┐
│  💼 WALLET & CAPITAL                                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Connected Wallet: 0x742d...35eE                        │
│  Network: Ethereum Mainnet                              │
│  RPC: https://eth.llamarpc.com ✅                       │
│                                                          │
│  ┌─ BALANCES ──────────────────────────────────────────┐│
│  │                                                      ││
│  │  USDC (ERC-20)        $42,500  ─→ [Deposit] [Use]   ││
│  │  ETH                   5.25 Ξ  ─→ [Deposit] [Use]   ││
│  │  DAI                 $8,000     ─→ [Deposit] [Use]   ││
│  │                                                      ││
│  │  Total: $65,234 (+ fees)                            ││
│  │                                                      ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌─ SOLVER CAPITAL ALLOCATION ──────────────────────────┐│
│  │                                                      ││
│  │  Available for Bidding: $50,000                      ││
│  │  ├─ Position limit per trade: $2,500 (5%)           ││
│  │  ├─ Daily loss limit: $5,000 (10%)                  ││
│  │  ├─ Max leverage: 2.0x                              ││
│  │  │                                                  ││
│  │  Current Usage:                                      ││
│  │  ├─ Open Positions: $1,200 (2.4% of capital)        ││
│  │  ├─ Daily Loss Used: $234 (4.7% of limit)           ││
│  │  ├─ Leverage: 1.2x                                  ││
│  │  │                                                  ││
│  │  🟢 All systems green - ready to bid                ││
│  │                                                      ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  [Adjust Risk Limits]  [Withdraw Profits]  [Deposit]    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

### Screen 3: Model & Data Streaming

```
┌─────────────────────────────────────────────────────────┐
│  🧠 MODEL PERFORMANCE                                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─ MODEL VERSION ──────────────────────────────────────┐│
│  │  Current: solver-v3                                  ││
│  │  Trained: 3 hours ago                                ││
│  │  Accuracy: 76.2%                                     ││
│  │  Parameters: 1.3B (Mistral)                          ││
│  │  Latency p95: 48ms                                   ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌─ DECISION BREAKDOWN (Last 100 Bids) ─────────────────┐│
│  │                                                      ││
│  │  BID decisions: 67                                   ││
│  │  ├─ Won: 19 (28.4%) ✅                              ││
│  │  ├─ Lost: 48 (71.6%) ❌                             ││
│  │  ├─ Avg profit/win: +$287                           ││
│  │  ├─ Avg loss/loss: -$62                             ││
│  │                                                      ││
│  │  SKIP decisions: 33                                  ││
│  │  └─ Avoided loss avg: $34                            ││
│  │                                                      ││
│  │  → Solver is being selective (good!)                ││
│  │                                                      ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌─ CONFIDENCE DISTRIBUTION ────────────────────────────┐│
│  │                                                      ││
│  │  90-100%: ▓▓▓▓▓▓▓ 12 bids  (18% win rate)           ││
│  │  80-90%:  ▓▓▓▓▓▓▓▓▓▓▓▓ 22 bids  (32% win rate)      ││
│  │  70-80%:  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 28 bids  (25% win rate)    ││
│  │  60-70%:  ▓▓▓▓▓ 5 bids    (20% win rate)            ││
│  │                                                      ││
│  │  → Higher confidence = higher accuracy ✓            ││
│  │                                                      ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  [Retrain Model]  [View Training Data]  [A/B Test]     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

### Screen 4: Trade History

```
┌─────────────────────────────────────────────────────────┐
│  📋 TRADE HISTORY (Last 24h)                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Time │ Pair      │ Amount │ Decision │ Outcome │ P&L   │
│──────┼───────────┼────────┼──────────┼─────────┼───────│
│ Now  │USDC→ETH   │ $5,234 │ BID $450 │ Pending │ -     │
│ 2s   │ETH→wstETH │$12,000 │  SKIP    │  N/A   │ N/A   │
│ 4s   │USDC→USDT  │ $8,500 │ BID $400 │ WON ✅  │+$287  │
│ 7s   │DAI→ETH    │ $3,200 │ BID $300 │ LOST ❌ │-$50   │
│ 12s  │USDC→ETH   │ $6,100 │ BID $480 │ WON ✅  │+$356  │
│ 18s  │USDT→DAI   │ $4,500 │  SKIP    │  N/A   │ N/A   │
│ 22s  │wstETH→ETH │ $2,000 │ BID $150 │ LOST ❌ │-$48   │
│ 28s  │USDC→USDT  │ $7,800 │ BID $520 │ WON ✅  │+$412  │
│ 35s  │ETH→USDC   │$15,000 │ BID $900 │ LOST ❌ │-$75   │
│ 42s  │DAI→wstETH │ $5,500 │ BID $400 │ WON ✅  │+$298  │
│                                                          │
│ [Export CSV]  [Filter Trades]  [View Details]           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Technical Architecture

### Frontend (React/Next.js)

```
Dashboard
├─ Components/
│  ├─ WalletConnect.tsx (MetaMask, WalletConnect)
│  ├─ StatusCard.tsx (Live status display)
│  ├─ BalanceCard.tsx (Capital + allocation)
│  ├─ IntentStream.tsx (Real-time scrolling feed)
│  ├─ Chart.tsx (Profit over time)
│  ├─ TradeHistory.tsx (Table of recent trades)
│  └─ ModelMetrics.tsx (Model performance)
│
├─ Hooks/
│  ├─ useWallet() (Connect wallet, get balance)
│  ├─ useSolver() (Connect to solver backend, stream data)
│  ├─ useWebSocket() (Real-time updates)
│  └─ useLocalStorage() (Persist user settings)
│
├─ Services/
│  ├─ walletService.ts (Web3Modal, ethers.js)
│  ├─ solverService.ts (API calls to solver backend)
│  └─ dataService.ts (Format/normalize data)
│
└─ Styles/
   ├─ theme.ts (Dark mode, colors, spacing)
   └─ dashboard.css (Grid layout, animations)
```

### Backend API (Solver exposes)

The solver needs to expose these endpoints for the dashboard:

```javascript
GET  /api/status
     → { status: "running", uptime: 18234, version: "v3" }

GET  /api/capital
     → { 
         available: 50000,
         usdc: 42500,
         eth: 5.25,
         openPositions: 1200,
         dailyLoss: 234
       }

GET  /api/performance
     → {
         winRate: 0.273,
         dailyPnL: 1234,
         totalProfit: 12450,
         modelAccuracy: 0.762,
         lastTrade: "2 seconds ago"
       }

WS   /ws/intents
     → Stream: { intent, decision, outcome, timestamp }

GET  /api/trades?limit=100
     → [ { pair, amount, decision, outcome, pnl } ]

GET  /api/model
     → {
         version: "solver-v3",
         accuracy: 0.762,
         latency: 48,
         lastRetrain: "3 hours ago"
       }
```

---

## Wallet Integration Flow

```
User clicks "Connect Wallet"
         ↓
Web3Modal opens (MetaMask, WalletConnect, etc)
         ↓
User connects wallet
         ↓
Frontend fetches balance (USDC, ETH, DAI)
         ↓
Display: "Connected: 0x742d... | Balance: $65,234"
         ↓
User clicks "Approve USDC for Solver"
         ↓
Solver contract granted spending authority
         ↓
User can now deposit/withdraw in dashboard
         ↓
Solver automatically uses approved balance for bidding
```

---

## Real-time Data Streaming

### Via WebSocket

```javascript
// Frontend connects to solver backend
const ws = new WebSocket('ws://localhost:8080/ws/intents');

ws.onmessage = (event) => {
  const { intent, decision, outcome } = JSON.parse(event.data);
  
  // Add to scroll feed (newest at top)
  updateIntentFeed({
    pair: `${intent.tokenIn}→${intent.tokenOut}`,
    amount: intent.amountIn,
    decision: decision.decision,
    confidence: decision.confidence,
    outcome: outcome.status,
    timestamp: Date.now(),
  });
  
  // Update stats in real-time
  updateStats({
    winRate: calculateWinRate(),
    totalProfit: calculateProfit(),
  });
};
```

---

## Design Specs

### Colors (Dark Mode)
```
Background: #0a0e27
Surface: #1a1f3a
Text: #e0e0e0
Success (Green): #00ff00 / #22c55e
Error (Red): #ff0000 / #ef4444
Warning (Yellow): #fbbf24
Primary (Cyan): #00ffff
Accent (Lime): #00ff88
```

### Typography
```
Title: Inter Bold 32px
Subtitle: Inter Semi-bold 18px
Body: Courier New 14px (monospace for numbers)
Label: Inter Regular 12px
```

### Layout
```
Grid: 12 columns, 20px gap
Padding: 24px edges, 16px internal
Border radius: 8px
Shadows: 0 4px 12px rgba(0,0,0,0.3)
```

---

## Interaction Patterns

### Real-time Feed Animation
```css
/* Slide in from top */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.intent-row {
  animation: slideIn 0.3s ease-out;
}

/* Fade out old trades after 30s */
.intent-row.old {
  opacity: 0.3;
}
```

### Wallet Connection
```
Button states:
- Disconnected: "Connect Wallet" (cyan border)
- Connecting: "Connecting..." (spinner)
- Connected: "0x742d...35eE" (green bg)
- Error: "Connection Failed" (red bg, retry button)
```

### Alerts
```
Success: "+$287 ✅ Won bid on USDC→ETH"
Error: "❌ Daily loss limit approaching (92%)"
Warning: "⚠️  Model accuracy dropped to 73%"
Info: "🔄 Model retraining in 2 hours"
```

---

## Performance Requirements

| Metric | Target | Method |
|--------|--------|--------|
| Page load | <2s | Code split, lazy load charts |
| Intent feed update | <50ms | WebSocket, no re-renders |
| Chart render | <100ms | Canvas or D3.js |
| Wallet connect | <3s | Web3Modal cached |
| Stats update | Real-time | Subscribe to WebSocket |

---

## What Dashboard Enables

✅ **See solver running in real-time**  
✅ **Watch capital balance live**  
✅ **Monitor profit happening**  
✅ **Understand model decisions**  
✅ **Catch issues immediately**  
✅ **Withdraw profits anytime**  
✅ **Share screenshots of performance**  

This is what makes it feel real. Not a black-box solver, but a professional trading operation you can see and control.

---

## Next: Build the React Component

This design spec is ready to build. The React component should:

1. Connect wallet (MetaMask/WalletConnect)
2. Stream live intents via WebSocket
3. Display all metrics in real-time
4. Handle disconnections gracefully
5. Be production-ready (error handling, accessibility)
6. Work on mobile and desktop

Shall I build the React component next?
