# SENTINEL AI DASHBOARD - OpenWebUI Style Chat Interface

**Beautiful dashboard + conversational AI = full system understanding without leaving the interface.**

---

## Quick Start

### 1. Start Everything
```bash
# Terminal 1: Autonomous pipeline
npm run pipeline:start

# Terminal 2: Ollama (local SLM)
ollama run mistral
# Or for smaller model: ollama run mistral:1.3b

# Terminal 3: Dashboard server + API
npm run dashboard:server

# Open: http://localhost:3000
```

### 2. Chat with the System
```
You: "Why was the last WETH→USDC trade executed?"
AI: "The model executed because: (1) WETH→USDC has 98.8% historical confidence,
    (2) DEX volume was high, (3) Risk checks passed (3.2% position sizing < 5% limit),
    (4) Expected profit: $1,965 ETH surplus available at 0.5% markup..."
```

---

## What the AI Dashboard Shows

### **Left Side: Metrics & Status** 📊
- Real-time model accuracy (72.86%)
- Capital & ROI tracking
- Win rate & precision metrics
- Priority 1/2/3 status
- Signal values (volume, volatility, OI)
- System health (uptime, memory, CPU)

### **Right Side: Conversational AI** 💬
OpenWebUI-style chat interface where you can ask:
- **Trade decisions**: "Why was order X executed?"
- **Signal interpretation**: "What do current signals mean?"
- **Risk analysis**: "What are hard risk limits?"
- **Model reasoning**: "How does the model make decisions?"
- **Performance**: "What's our current capital and ROI?"
- **System status**: "Is everything running normally?"

---

## Quick Questions (No Ollama Needed)

The system has pre-cached answers for common questions:

```
"signals"      → "Current signal analysis shows..."
"decision"     → "Trades are executed when..."
"risk"         → "Hard risk limits enforced..."
"model"        → "Model v2 achieved..."
"capital"      → "$10,000 starting capital..."
"primitives"   → "FloatMath: 420+ operations..."
```

These return instantly (~50ms) without calling Ollama.

---

## Full AI Responses (With Ollama)

Install Ollama: https://ollama.ai

```bash
# Download mistral (7B model)
ollama pull mistral

# Or smaller 1.3B
ollama pull mistral:1.3b

# Start Ollama server
ollama serve
# Runs on http://localhost:11434
```

Then the AI can answer any question with full context:
- System status
- Signal analysis
- Model architecture
- Risk calculations
- Trading performance
- Primitive usage stats
- Backtest results

---

## Chat Features

### **Suggested Questions**
First message shows quick suggestions:
- "Explain current signals"
- "Why was last trade executed?"
- "Current risk profile"
- "Model accuracy details"

Click any to auto-fill and send.

### **Message History**
- All messages persist during session
- Auto-scrolls to latest
- Timestamps on each message
- User vs AI clearly marked

### **Typing Indicators**
- "Thinking..." animation while AI responds
- Shows model is processing
- ~2-5 seconds for Ollama responses

### **Responsive Design**
- Chat sidebar collapsible (desktop)
- Slide-out chat on mobile
- Full dashboard accessible
- Toggle button always visible

---

## API Endpoints

### POST `/api/slm/query`
Send a question to the SLM.

```bash
curl -X POST http://localhost:3000/api/slm/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Why was the last trade executed?"}'

# Response:
{
  "response": "The model executed the WETH→USDC trade because...",
  "source": "ollama"  // or "quick" or "fallback"
}
```

### GET `/api/slm/health`
Check if Ollama is running.

```bash
curl http://localhost:3000/api/slm/health

# Response:
{
  "healthy": true,
  "model": "mistral",
  "url": "http://localhost:11434"
}
```

### GET `/api/slm/quick-answers`
Get pre-cached common answers.

```bash
curl http://localhost:3000/api/slm/quick-answers

# Response:
{
  "signals": "Current signal analysis...",
  "decision": "Trades are executed when...",
  ...
}
```

---

## System Context Provided to AI

The AI has full understanding of:

**System Status**
- Model version, accuracy, uptime
- Current capital, ROI, trades

**Live Metrics**
- Precision (100%), Recall (63.85%), Sharpe ratio
- Win rate, max drawdown

**Current Signals**
- DEX volume, volatility, stablecoin supply
- Open interest, price movements

**Primitives**
- FloatMath operations (420+ calls)
- RiskEngine checks (138+ enforcements)
- Ledger records (1,180+ transitions)
- GasManager optimizations (290+ calculations)

**Training & Strategy**
- 10,000 mock intents (75% profitable)
- Token pair features, slippage patterns
- Walk-forward validation, weekly real data tests

**Risk Framework**
- Max 5% position sizing
- 2x leverage cap
- 10% daily loss limit
- 15% max drawdown

---

## Example Conversations

### Conversation 1: Trade Explanation
```
You: "Why was the WETH→USDC trade with 393.1 ETH surplus executed?"

AI: "The model executed because:

1. HISTORICAL PERFORMANCE: WETH→USDC pair has 98.8% confidence 
   and 393.1 ETH average surplus from backtest.

2. SIGNAL CONFIRMATION: Current signals support execution:
   - DEX volume: $5.2B (healthy)
   - Stablecoin supply: rising (risk-on)
   - OI: $5B active (leverage sentiment positive)

3. MODEL CONFIDENCE: 98.8% based on:
   - Token pair strategy (learned from 1,000+ similar trades)
   - Recent signal enrichment (volume score 75%)
   - No drift detected in model accuracy

4. RISK CHECKS PASS:
   - Position sizing: 3.2% of capital (under 5% limit)
   - Leverage: 1.0x (under 2x cap)
   - Daily loss: $0 so far (under 10% limit)
   - Max drawdown: 0% (under 15% limit)

5. MARKUP APPLIED: 0.5% (aggressive but justified given:
   - High historical surplus
   - Strong signal alignment
   - Risk limits respected)

EXPECTED PROFIT: $1,965 ETH at 0.5% markup = +$1,000+ profit target"
```

### Conversation 2: Signal Interpretation
```
You: "What do current signals mean for trading?"

AI: "Current signal analysis:

VOLUME (Score: 75%)
- DEX volume $5.2B, up $250M
- Healthy trading activity
- More liquidity = lower slippage
- Impact on model: Increases recall (catches more wins)

VOLATILITY (Score: 60%)
- Moderate range-bound movement
- Not extreme swings
- Safer execution environment
- Impact: Improves confidence calibration

STABLECOIN SUPPLY (Rising)
- USDC supply up $500M (risk-on sentiment)
- Capital flowing into DeFi
- Higher market activity expected
- Regime: Bull market (adjust markups upward)

OPEN INTEREST (Active at $5B)
- Derivatives market engaged
- Leverage positions active
- More edge opportunities
- But higher tail risk

MODEL RESPONSE:
All signals combined → 94% confidence in current market regime
Recommended: Aggressive positioning (0.5% markup) justified"
```

### Conversation 3: Risk Understanding
```
You: "What are the hard risk limits?"

AI: "Sentinel enforces MANDATORY hard risk limits:

POSITION SIZING:
- Max 5% of capital per order
- Why: Prevents single-trade catastrophe
- Current capital $10k → Max $500 per trade
- Status: ✓ Last trade 3.2% (safe)

LEVERAGE:
- Max 2x leverage allowed
- Why: Avoid liquidation spiral
- Most orders 1x (no leverage)
- Status: ✓ Never exceeded

DAILY LOSS LIMIT:
- Max 10% loss per day
- Why: Drawdown circuit breaker
- Resets each day at UTC 00:00
- Status: ✓ Current: 0% drawdown

MAX DRAWDOWN:
- 15% lifetime maximum
- Why: Protects against regime shifts
- Status: ✓ Current: 0% (mock data)

PRECISION (FloatLib):
- All math uses arbitrary precision
- No rounding errors
- Status: ✓ 420+ operations executed

ENFORCEMENT:
These limits are MANDATORY and cannot be overridden.
They execute before any trade decision.
If risk limit triggers: TRADE IS BLOCKED, even if profitable."
```

---

## Performance & Optimization

### **Response Times**
- Quick answers: ~50ms (cached)
- Ollama (7B): ~2-5 seconds
- Ollama (1.3B): ~1-2 seconds

### **Resource Usage**
- Dashboard: ~50MB RAM
- API server: ~100MB RAM
- Ollama (7B): ~4GB RAM (GPU accelerated: 1GB)
- Ollama (1.3B): ~2GB RAM

### **Optimization Tips**
```bash
# Use smaller model if limited RAM
ollama pull mistral:1.3b

# Enable GPU acceleration
# (Ollama auto-detects CUDA, Metal, etc.)

# Or use quantized version
ollama pull mistral:q4_K_M  # 4-bit quantized
```

---

## Troubleshooting

### Dashboard not showing?
```bash
# Check server is running
curl http://localhost:3000/api/status

# Check logs
npm run pipeline:logs
```

### Chat not working?
```bash
# Check SLM health
curl http://localhost:3000/api/slm/health

# Should return: {"healthy": true, "model": "mistral", ...}
```

### Ollama not running?
```bash
# Start Ollama server
ollama serve

# Or run model directly
ollama run mistral

# Check if accessible
curl http://localhost:11434/api/tags
```

### Slow responses?
```bash
# Use smaller model
ollama pull mistral:1.3b
# Edit slm-integration.js: this.model = 'mistral:1.3b'

# Or quantized
ollama pull mistral:q4
```

---

## That's It

```bash
npm run pipeline:start
ollama run mistral
npm run dashboard:server
# Open http://localhost:3000
```

You now have:
✅ **Beautiful real-time dashboard**
✅ **Conversational AI about your trading system**
✅ **Full context about decisions, signals, risks**
✅ **OpenWebUI-style interface**
✅ **All primitives and metrics visible**

Ask the AI anything. It has full context. It will explain everything.
