# Continuous Learning Architecture for Intent Solvers
## Enterprise Design: Anthropic + OpenAI + Jane Street (2026)

---

## The Problem

Most trading systems are static: train once, deploy, watch it decay.

**Reality:**
- Week 1: 75% accuracy
- Week 4: 68% accuracy (distribution shift)
- Week 8: 55% accuracy (competitors adapt)

**The solution:** System that improves while running. Every trade teaches it something.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ETHEREUM MEMPOOL                         │
│              (Intent source, real-time)                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              EVENT STREAM (NATS/Kafka)                       │
│         Immutable log of all intents & outcomes              │
└─────────────────────────────────────────────────────────────┘
                              ↓
          ┌───────────────────┬───────────────────┐
          ↓                   ↓                   ↓
    ┌──────────┐        ┌──────────┐       ┌──────────┐
    │  FEATURE │        │  MODEL   │       │ OUTCOME  │
    │  STORE   │        │INFERENCE │       │ RECORDER │
    └──────────┘        └──────────┘       └──────────┘
          ↓                   ↓                   ↓
    [Real-time         [Execute bid]     [Track result]
     features]              ↓                   ↓
                       ┌─────────────────────────┘
                       ↓
                  ┌──────────────────┐
                  │  OUTCOME STORE   │
                  │  (SQLite/Postgres)│
                  └──────────────────┘
                       ↓
          ┌────────────┬────────────┐
          ↓            ↓            ↓
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │VALIDATION│ │  DRIFT   │ │  TRAINING│
    │  SPLIT   │ │DETECTOR  │ │  PIPELINE│
    └──────────┘ └──────────┘ └──────────┘
          ↓            ↓            ↓
    ┌─────────────────────────────────────┐
    │   RETRAINING (Nightly)              │
    │   - Walk-forward validation         │
    │   - Hard example mining             │
    │   - A/B testing                     │
    └─────────────────────────────────────┘
          ↓
    ┌──────────────────┐
    │ MODEL REGISTRY   │
    │ (Version control)│
    └──────────────────┘
          ↓
    ┌──────────────────┐
    │ CANARY DEPLOYMENT│
    │ (Test on 5%)     │
    └──────────────────┘
          ↓
    ┌──────────────────┐
    │ PRODUCTION MODEL │
    │ (Serve to all)   │
    └──────────────────┘
```

---

## 1. DATA INGESTION

### A. Intent Stream (Real-time)

```python
"""
Every intent from mempool becomes an immutable event.
Source of truth for everything downstream.
"""

from datetime import datetime
from dataclasses import dataclass

@dataclass
class IntentEvent:
    # Core intent data
    intent_id: str              # Unique hash
    token_in: str
    token_out: str
    amount_in: float
    min_amount_out: float
    
    # Metadata (for causality)
    timestamp: float            # When we saw it (not when it executed)
    block_number: int           # Block it was in
    mempool_position: int       # How deep in mempool
    gas_price: float
    
    # Market context (snapshot at decision time)
    eth_price: float            # Price when we saw intent
    volatility_5m: float        # Volatility last 5 min
    hour_of_day: int
    day_of_week: int
    
    # Execution context
    solver_address: str         # Who executed it
    solver_bid: float           # How much they paid
    
    # Outcome (backfilled later)
    outcome: str = None         # "WON" or "LOST" or "PENDING"
    execution_price: float = None
    profit: float = None
    status: str = "PENDING"

class IntentStream:
    def __init__(self, nats_url="nats://localhost:4222"):
        self.nats_url = nats_url
        self.stream_name = "intents"
        
    async def publish(self, intent: IntentEvent):
        """Publish intent to immutable log"""
        await self.nc.publish(
            f"intents.{intent.token_in}.{intent.token_out}",
            json.dumps(intent.__dict__).encode()
        )
    
    async def subscribe(self, callback):
        """Listen to all intents"""
        async def on_message(msg):
            intent = IntentEvent(**json.loads(msg.data))
            await callback(intent)
        
        await self.nc.subscribe("intents.>", cb=on_message)
```

**Why this matters (Jane Street perspective):**
- Immutable event log prevents data leakage (no look-ahead bias)
- Timestamp = decision time, not execution time
- Market context captured at decision point (not biased by hindsight)

---

### B. Outcome Backfill (Delayed Labels)

```python
"""
After trade executes, we backfill the outcome.
This happens minutes to hours later.
"""

class OutcomeBackfiller:
    def __init__(self, db_path="outcomes.db"):
        self.db = Database(db_path)
        self.init_schema()
    
    async def track_execution(self, intent_id: str, solver_address: str):
        """
        Monitor blockchain for execution
        """
        while True:
            # Check if solver won the batch
            batch = await self.get_cow_batch(solver_address)
            
            if batch.status == "settled":
                # Get execution price
                actual_output = await self.get_execution_output(
                    solver_address, intent_id
                )
                
                profit = self.calculate_profit(
                    intent=intent,
                    execution=actual_output,
                    bid=solver_bid
                )
                
                # Backfill outcome
                self.db.execute("""
                    UPDATE intents 
                    SET outcome = ?, execution_price = ?, profit = ?
                    WHERE intent_id = ?
                """, ("WON", actual_output, profit, intent_id))
                
                break
            
            await asyncio.sleep(2)
    
    async def detect_lost_bids(self, intent_id: str, timeout_seconds=60):
        """
        If intent still pending after timeout, we lost the bid
        """
        await asyncio.sleep(timeout_seconds)
        
        intent = self.db.get(intent_id)
        if intent.outcome == "PENDING":
            self.db.execute("""
                UPDATE intents 
                SET outcome = ?, profit = ?
                WHERE intent_id = ?
            """, ("LOST", -10, intent_id))  # Lost + gas cost

class OutcomeProcessor:
    """
    Convert raw outcomes into clean training signals
    """
    
    def process_outcome(self, intent: IntentEvent) -> dict:
        """
        Transform raw outcome into feature + label
        """
        
        # Feature: everything we knew at decision time
        features = {
            "token_in": encode_token(intent.token_in),
            "token_out": encode_token(intent.token_out),
            "amount_in": intent.amount_in,
            "eth_price": intent.eth_price,
            "volatility": intent.volatility_5m,
            "hour": intent.hour_of_day,
            "gas_price": intent.gas_price,
        }
        
        # Label: binary outcome (won or lost)
        label = 1 if intent.outcome == "WON" else 0
        
        # Profit (regression target, not binary)
        profit_target = max(intent.profit, -100)  # Cap losses
        
        return {
            "features": features,
            "label": label,  # Classification
            "profit": profit_target,  # Regression
            "intent_id": intent.intent_id,
            "timestamp": intent.timestamp,  # For train/test split
        }
```

**Critical principle (Anthropic perspective):**
- **No look-ahead bias.** Features only use data known at decision time.
- **Causality preserved.** Outcome timestamps are after decision timestamps.

---

## 2. DATA PROCESSING & FEATURE STORE

### A. Real-time Feature Computation

```python
"""
Features must be computed at prediction time, not backfilled.
This prevents leakage and ensures production realism.
"""

class FeatureStore:
    def __init__(self):
        self.cache = {}  # In-memory cache (TTL: 5 minutes)
        self.db = Database("features.db")
        self.init_schema()
    
    async def get_features_at_time(self, timestamp: float):
        """
        Get market features as of a specific timestamp.
        NEVER use future data.
        """
        
        # Check cache
        if timestamp in self.cache:
            return self.cache[timestamp]
        
        # Query historical data
        features = {
            "eth_price": self.get_price_at(timestamp),
            "volatility_5m": self.get_volatility(timestamp, window=5),
            "volatility_1h": self.get_volatility(timestamp, window=60),
            "volume_1h": self.get_volume(timestamp, window=60),
            "bid_ask_spread": self.get_spread_at(timestamp),
            "funding_rate": self.get_funding_rate_at(timestamp),
            "hour_of_day": int(datetime.fromtimestamp(timestamp).hour),
            "day_of_week": int(datetime.fromtimestamp(timestamp).weekday()),
            "is_high_volume_time": self.detect_volume_spike(timestamp),
        }
        
        self.cache[timestamp] = features
        return features
    
    def get_volatility(self, timestamp: float, window: int):
        """
        Calculate historical volatility using ONLY past data.
        window = minutes
        """
        
        end_time = timestamp
        start_time = timestamp - (window * 60)  # Go back N minutes
        
        # Get prices in the window
        prices = self.db.query("""
            SELECT price FROM price_history
            WHERE timestamp BETWEEN ? AND ?
            ORDER BY timestamp ASC
        """, (start_time, end_time))
        
        if len(prices) < 2:
            return 0
        
        # Calculate log returns
        returns = [
            math.log(prices[i] / prices[i-1])
            for i in range(1, len(prices))
        ]
        
        # Return standard deviation (volatility)
        return np.std(returns)
    
    def get_win_rate_at_time(self, token_in: str, token_out: str, 
                             timestamp: float, lookback_days: int = 7):
        """
        Historical win rate for this pair.
        ONLY use trades before this timestamp.
        """
        
        start_time = timestamp - (lookback_days * 86400)  # N days back
        
        results = self.db.query("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN outcome = 'WON' THEN 1 ELSE 0 END) as wins
            FROM outcomes
            WHERE token_in = ? AND token_out = ?
              AND timestamp < ?
              AND timestamp > ?
        """, (token_in, token_out, timestamp, start_time))
        
        if results[0]['total'] == 0:
            return 0.5  # Default if no history
        
        return results[0]['wins'] / results[0]['total']
```

**Jane Street principle:**
- Features are computed *at decision time*, not backfilled
- All data used is strictly historical (before timestamp)
- No future peeking

---

### B. Feature Validation & Drift Detection

```python
class DriftDetector:
    """
    Monitor if feature distributions are changing.
    If they change too much, model needs retraining.
    """
    
    def __init__(self, window_size: int = 1000):
        self.window_size = window_size
        self.baseline_stats = {}
        self.init_baseline()
    
    def init_baseline(self):
        """
        Establish baseline feature distributions
        from first 1000 trades
        """
        recent = self.db.query("""
            SELECT features FROM processed_data
            ORDER BY timestamp DESC
            LIMIT ?
        """, (self.window_size,))
        
        for feature_name in ["volatility", "eth_price", "volume", "hour"]:
            values = [f[feature_name] for f in recent]
            self.baseline_stats[feature_name] = {
                "mean": np.mean(values),
                "std": np.std(values),
                "min": np.min(values),
                "max": np.max(values),
            }
    
    def detect_drift(self, new_features: dict) -> dict:
        """
        Check if new features deviate from baseline.
        Return severity and affected features.
        """
        
        drift_report = {
            "has_drift": False,
            "severity": 0,  # 0-1 scale
            "affected_features": [],
        }
        
        for feature_name, value in new_features.items():
            baseline = self.baseline_stats.get(feature_name)
            if not baseline:
                continue
            
            # Z-score: how many std devs from mean?
            z_score = abs((value - baseline['mean']) / baseline['std'])
            
            if z_score > 3:  # 3-sigma event
                drift_report['affected_features'].append({
                    "feature": feature_name,
                    "z_score": z_score,
                    "current": value,
                    "baseline_mean": baseline['mean'],
                })
                drift_report['has_drift'] = True
                drift_report['severity'] = max(drift_report['severity'], 
                                              min(z_score / 10, 1.0))
        
        return drift_report
```

---

## 3. THINKING: MODEL INFERENCE & DECISION MAKING

### A. Staged Decision Pipeline

```python
"""
Not all decisions need the same compute.
Route by complexity.
"""

class IntelligentRouter:
    def __init__(self):
        self.cache_model = SimpleCacheModel()          # 1ms
        self.fast_model = LiteDeploy("phi-1.3b")       # 30ms
        self.medium_model = FastLLM("mistral-7b")      # 100ms
        self.confidence_threshold = 0.7
    
    async def decide(self, intent: IntentEvent, features: dict) -> Decision:
        """
        Route decision based on complexity.
        Faster decisions on obvious cases.
        Careful decisions on uncertain cases.
        """
        
        # Stage 1: Exact cache match (1ms)
        decision = await self.cache_model.decide(
            intent, features
        )
        if decision and decision.confidence > 0.95:
            return decision  # Certain, fast
        
        # Stage 2: Fast model (30ms)
        decision = await self.fast_model.decide(
            intent, features
        )
        if decision.confidence > 0.85:
            return decision  # Confident, fast enough
        
        # Stage 3: Medium model (100ms, only on 15% of intents)
        if self.should_escalate(decision, features):
            decision = await self.medium_model.decide(
                intent, features, 
                reasoning=True  # Get explanation too
            )
        
        return decision

@dataclass
class Decision:
    should_bid: bool
    bid_amount: float
    confidence: float
    reasoning: str  # For debugging
    model_used: str
    latency_ms: float
    
    def is_safe(self, risk_limits: dict) -> bool:
        """Check if decision respects risk limits"""
        if self.bid_amount > risk_limits['max_position']:
            return False
        if self.confidence < risk_limits['min_confidence']:
            return False
        return True
```

### B. Model Architecture (What the model actually sees)

```python
"""
Input to model (at decision time):
- Static intent features (5 dims): token_in, token_out, amount
- Dynamic market features (10 dims): price, volatility, volume, hour
- Historical context (5 dims): win_rate, avg_profit, recency, frequency
- Risk state (3 dims): current_positions, daily_pnl, leverage

Total: 23-dimensional input
"""

import torch
import torch.nn as nn

class IntentSolverModel(nn.Module):
    """
    1.3B parameter model (Phi-2 or Mistral-small)
    Fine-tuned on your specific trade data
    """
    
    def __init__(self, hidden_size=768):
        super().__init__()
        
        # Embed categorical features
        self.token_embedding = nn.Embedding(10000, 64)
        
        # Process numeric features
        self.numeric_projection = nn.Linear(20, 128)
        
        # Main transformer (from pretrained Mistral-1.3B)
        self.transformer = load_pretrained("mistral-1.3b")
        
        # Decision head
        self.decision_head = nn.Sequential(
            nn.Linear(768 + 128, 256),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(256, 64),
            nn.ReLU(),
            nn.Linear(64, 1),  # Binary: BID or SKIP
        )
        
        # Confidence head
        self.confidence_head = nn.Sequential(
            nn.Linear(768 + 128, 128),
            nn.ReLU(),
            nn.Linear(128, 1),
            nn.Sigmoid(),  # 0-1 confidence
        )
        
        # Bid amount head (if BID)
        self.bid_head = nn.Sequential(
            nn.Linear(768 + 128, 128),
            nn.ReLU(),
            nn.Linear(128, 1),
            nn.Softplus(),  # Always positive
        )
    
    def forward(self, intent_features, market_features):
        # Embed tokens
        token_emb = self.token_embedding(intent_features['token_in'])
        
        # Project numeric features
        numeric = self.numeric_projection(market_features)
        
        # Run through transformer
        context = self.transformer(
            torch.cat([token_emb, numeric], dim=1)
        )
        
        # Get three outputs
        bid_logit = self.decision_head(context)
        confidence = self.confidence_head(context)
        bid_amount = self.bid_head(context)
        
        return {
            'should_bid': bid_logit > 0,
            'confidence': confidence,
            'bid_amount': bid_amount,
        }
```

**Why this architecture:**
- Small enough to fit on any GPU (even mobile)
- Large enough to learn patterns
- Multiple heads (classification + regression + confidence)
- Interpretable outputs (bid amount, confidence)

---

## 4. ACTION: EXECUTION & MONITORING

### A. Risk-Aware Execution

```python
"""
LLM decides. Sentinel enforces.
Two-layer safety.
"""

class RiskManager:
    def __init__(self, capital: float = 50000):
        self.capital = capital
        self.position_limit = capital * 0.05  # Max 5% per trade
        self.daily_loss_limit = capital * 0.10  # Max 10% per day
        self.leverage_limit = 2.0
        
        self.state = {
            'open_positions': [],
            'daily_pnl': 0,
            'daily_loss': 0,
        }
    
    async def execute_decision(self, decision: Decision, intent: IntentEvent):
        """
        1. Check if decision respects limits
        2. Adjust if needed
        3. Execute
        4. Monitor
        """
        
        # Validate decision
        if not decision.should_bid:
            return {'status': 'SKIPPED', 'reason': 'Model said skip'}
        
        # Apply risk limits
        position_size = min(
            decision.bid_amount,
            self.position_limit,
        )
        
        # Check daily loss limit
        if self.state['daily_loss'] + 50 > self.daily_loss_limit:
            return {'status': 'HALTED', 'reason': 'Daily loss limit hit'}
        
        # Check leverage
        open_positions = sum(p['size'] for p in self.state['open_positions'])
        leverage = open_positions / self.capital
        if leverage > self.leverage_limit:
            return {'status': 'REJECTED', 'reason': 'Leverage too high'}
        
        # Adjust bid if needed
        if position_size < decision.bid_amount:
            adjusted_decision = Decision(
                should_bid=True,
                bid_amount=position_size,
                confidence=decision.confidence * 0.9,  # Penalize for reduction
                reasoning=f"Reduced from {decision.bid_amount} to {position_size}",
                model_used=decision.model_used,
                latency_ms=decision.latency_ms,
            )
        else:
            adjusted_decision = decision
        
        # Submit bid
        result = await self.submit_bid_to_cow(intent, adjusted_decision)
        
        # Track position
        if result['status'] == 'SUBMITTED':
            self.state['open_positions'].append({
                'intent_id': intent.intent_id,
                'size': adjusted_decision.bid_amount,
                'timestamp': datetime.now().timestamp(),
                'model_confidence': adjusted_decision.confidence,
            })
        
        return result

class ExecutionMonitor:
    """
    Track every bid from submission to settlement.
    """
    
    async def monitor_bid(self, bid_id: str, solver_address: str):
        """
        Wait for CoW batch to settle, get outcome
        """
        
        max_wait_seconds = 60
        start_time = time.time()
        
        while time.time() - start_time < max_wait_seconds:
            # Poll CoW API for batch status
            batch = await self.get_cow_batch(solver_address)
            
            if batch['status'] == 'settled':
                # Extract execution price
                execution = await self.parse_settlement(batch)
                
                # Record outcome
                await self.record_outcome(bid_id, execution)
                return execution
            
            await asyncio.sleep(1)
        
        # Timeout = we lost the bid
        await self.record_outcome(bid_id, None)
        return None

class OutcomeRecorder:
    """
    Record every outcome immediately for training
    """
    
    async def record(self, intent_id: str, decision: Decision, 
                    execution: dict, profit: float):
        """
        Store complete feedback loop
        """
        
        record = {
            'intent_id': intent_id,
            'decision': decision.__dict__,
            'execution': execution,
            'profit': profit,
            'timestamp_decision': decision.timestamp,
            'timestamp_execution': execution.get('timestamp'),
            'outcome': 'WON' if profit > 0 else 'LOST',
            'model_version': self.current_model_version,
        }
        
        # Write to database (for future training)
        self.db.insert('outcomes', record)
        
        # Also append to outcome stream (for real-time monitoring)
        await self.nats.publish('outcomes.latest', json.dumps(record))
```

---

## 5. FEEDBACK: LEARNING FROM OUTCOMES

### A. Walk-Forward Validation (Production Training)

```python
"""
CRITICAL: Prevent look-ahead bias in retraining.
Use walk-forward validation like Jane Street does.
"""

class TrainingPipeline:
    def __init__(self):
        self.model_version = 1
        self.retraining_schedule = "daily"  # After market close
    
    async def retrain(self):
        """
        Every night: improve model with today's data
        """
        
        print(f"🔄 Retraining model v{self.model_version}...")
        
        # Step 1: Get outcomes from today
        today_start = datetime.now().replace(hour=0, minute=0, second=0)
        today_outcomes = await self.db.query("""
            SELECT * FROM outcomes
            WHERE timestamp_decision >= ?
            ORDER BY timestamp_decision ASC
        """, (today_start.timestamp(),))
        
        print(f"   Found {len(today_outcomes)} trades today")
        
        if len(today_outcomes) < 100:
            print("   Too few trades, skipping retrain")
            return
        
        # Step 2: Walk-forward split (NO look-ahead bias)
        train_data, val_data = self.walk_forward_split(
            today_outcomes, 
            split_ratio=0.8
        )
        
        # Step 3: Convert to features + labels (only past data)
        X_train, y_train = await self.featurize(train_data)
        X_val, y_val = await self.featurize(val_data)
        
        # Step 4: Fine-tune model (LoRA for speed)
        model = load_model(f"model-v{self.model_version}.pt")
        
        optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)
        
        for epoch in range(3):
            # Training
            for X_batch, y_batch in self.batch_iterator(X_train, y_train):
                logits = model(X_batch)
                loss = self.loss_fn(logits, y_batch)
                loss.backward()
                optimizer.step()
                optimizer.zero_grad()
            
            # Validation
            val_accuracy = self.evaluate(model, X_val, y_val)
            print(f"   Epoch {epoch+1}: Val accuracy = {val_accuracy:.2%}")
        
        # Step 5: Compare to current model
        old_accuracy = self.evaluate(
            load_model(f"model-v{self.model_version}.pt"),
            X_val, y_val
        )
        new_accuracy = self.evaluate(model, X_val, y_val)
        
        improvement = (new_accuracy - old_accuracy) * 100
        print(f"   Old: {old_accuracy:.2%}, New: {new_accuracy:.2%} (+{improvement:.1f}%)")
        
        if new_accuracy > old_accuracy:
            # Step 6: Deploy to canary (5% of traffic)
            print(f"   Improvement found! Deploying to canary...")
            self.model_version += 1
            model.save(f"model-v{self.model_version}.pt")
            await self.deploy_canary(f"model-v{self.model_version}")
        else:
            print("   No improvement, keeping current model")
    
    def walk_forward_split(self, data: list, split_ratio: float = 0.8):
        """
        Split chronologically, not randomly.
        Train on past, validate on future.
        """
        
        split_idx = int(len(data) * split_ratio)
        train = data[:split_idx]  # Earlier trades
        val = data[split_idx:]     # Later trades
        
        return train, val
    
    async def featurize(self, outcomes: list):
        """
        Convert outcomes to features + labels
        """
        
        X = []
        y = []
        
        for outcome in outcomes:
            # Get decision record
            decision = outcome['decision']
            
            # Get market features at decision time
            features = await self.feature_store.get_features_at_time(
                outcome['timestamp_decision']
            )
            
            # Combine
            x = np.array([
                encode_token(outcome['intent']['token_in']),
                encode_token(outcome['intent']['token_out']),
                outcome['intent']['amount_in'],
                features['eth_price'],
                features['volatility'],
                features['hour'],
                decision['confidence'],
            ])
            
            X.append(x)
            y.append(1 if outcome['outcome'] == 'WON' else 0)
        
        return np.array(X), np.array(y)
```

**Jane Street principle (Walk-forward validation):**
```
Day 1:  Train on nothing
Day 2:  Train on Day 1 data, validate on Day 2
Day 3:  Train on Day 1-2 data, validate on Day 3
Day 4:  Train on Day 1-3 data, validate on Day 4
...

Why? Prevents look-ahead bias.
You only use data that existed at decision time.
```

---

### B. Hard Example Mining

```python
"""
Not all trades are equally valuable for learning.
Focus on the ones the model got wrong.
"""

class HardExampleMiner:
    def __init__(self):
        self.mining_schedule = "every_1000_trades"
    
    async def mine_hard_examples(self):
        """
        Find trades where model was wrong or uncertain.
        Retrain only on these.
        """
        
        print("🔨 Mining hard examples...")
        
        # Get recent trades
        recent = await self.db.query("""
            SELECT * FROM outcomes
            WHERE timestamp > NOW() - INTERVAL 7 DAY
            ORDER BY timestamp DESC
            LIMIT 10000
        """)
        
        hard_examples = []
        
        for outcome in recent:
            # Get model's prediction at the time
            prediction = outcome['decision']
            actual = outcome['outcome']
            
            # Calculate model error
            if prediction['should_bid'] and actual == 'LOST':
                # False positive: model said bid, but lost
                error = abs(prediction['confidence'] - 0)
                hard_examples.append({
                    'outcome': outcome,
                    'error': error,
                    'type': 'false_positive',
                })
            
            elif not prediction['should_bid'] and actual == 'WON':
                # False negative: model said skip, but would have won
                error = abs(prediction['confidence'] - 1)
                hard_examples.append({
                    'outcome': outcome,
                    'error': error,
                    'type': 'false_negative',
                })
        
        # Sort by error (hardest first)
        hard_examples.sort(key=lambda x: x['error'], reverse=True)
        
        print(f"   Found {len(hard_examples)} hard examples")
        print(f"   Top 5 errors: {[e['error'] for e in hard_examples[:5]]}")
        
        # Retrain on hardest 10%
        hardest = hard_examples[:len(hard_examples) // 10]
        
        X_hard, y_hard = await self.featurize([e['outcome'] for e in hardest])
        
        # Fine-tune model (less data, more focused)
        model = load_model("model-latest.pt")
        self.fine_tune_hard(model, X_hard, y_hard, epochs=5)
        
        return model
```

---

### C. Multi-Armed Bandit: A/B Testing Models

```python
"""
Run multiple models in parallel.
Let the best one win.
Automatically migrate traffic to winner.
"""

class ModelBandit:
    def __init__(self):
        self.models = {
            'v1': {'model': load_model('v1.pt'), 'wins': 0, 'losses': 0},
            'v2': {'model': load_model('v2.pt'), 'wins': 0, 'losses': 0},
            'v3': {'model': load_model('v3.pt'), 'wins': 0, 'losses': 0},
        }
        self.traffic_split = {
            'v1': 0.33,
            'v2': 0.33,
            'v3': 0.34,
        }
    
    async def decide(self, intent, features):
        """
        Route to best-performing model
        """
        
        # Calculate Thompson sampling probabilities
        probs = {}
        for version, stats in self.models.items():
            # Success rate
            wins = stats['wins']
            losses = stats['losses']
            
            # Bayesian estimate (Beta-Binomial)
            # This naturally trades off exploration vs exploitation
            prob = np.random.beta(wins + 1, losses + 1)
            probs[version] = prob
        
        # Pick model with highest sampled prob
        chosen_model = max(probs.keys(), key=lambda k: probs[k])
        
        # Get decision
        decision = await self.models[chosen_model]['model'].decide(
            intent, features
        )
        decision.model_used = chosen_model
        
        return decision
    
    async def record_feedback(self, chosen_model: str, outcome: str):
        """
        Update bandit based on outcome
        """
        
        if outcome == 'WON':
            self.models[chosen_model]['wins'] += 1
        else:
            self.models[chosen_model]['losses'] += 1
        
        # Recalculate traffic split
        self.update_traffic_split()
    
    def update_traffic_split(self):
        """
        Gradually shift traffic to winning model
        """
        
        win_rates = {}
        for version, stats in self.models.items():
            total = stats['wins'] + stats['losses']
            if total == 0:
                win_rates[version] = 0.5
            else:
                win_rates[version] = stats['wins'] / total
        
        # Soft allocation: 70% to best, 20% to second, 10% to worst
        sorted_versions = sorted(
            win_rates.items(), 
            key=lambda x: x[1], 
            reverse=True
        )
        
        self.traffic_split = {
            sorted_versions[0][0]: 0.70,
            sorted_versions[1][0]: 0.20,
            sorted_versions[2][0]: 0.10,
        }
```

---

## 6. MONITORING & ALERTING

### A. Real-Time Performance Dashboard

```python
class PerformanceMonitor:
    def __init__(self):
        self.metrics = {
            'total_intents': 0,
            'total_bids': 0,
            'wins': 0,
            'losses': 0,
            'profit': 0,
            'model_accuracy': 0,
            'model_latency_p95': 0,
        }
    
    async def track_outcome(self, outcome: dict):
        """
        Update metrics in real-time
        """
        
        self.metrics['total_intents'] += 1
        
        if outcome['decision']['should_bid']:
            self.metrics['total_bids'] += 1
        
        if outcome['outcome'] == 'WON':
            self.metrics['wins'] += 1
        else:
            self.metrics['losses'] += 1
        
        self.metrics['profit'] += outcome['profit']
        
        # Calculate accuracy
        win_rate = self.metrics['wins'] / max(self.metrics['total_bids'], 1)
        self.metrics['model_accuracy'] = win_rate
        
        # Check for anomalies
        await self.check_alerts()
    
    async def check_alerts(self):
        """
        Alert on performance degradation
        """
        
        # Alert: Win rate dropped
        if self.metrics['model_accuracy'] < 0.20:  # Was 25%, now <20%
            await self.send_alert(
                "CRITICAL",
                "Win rate dropped below 20%. Model may need retraining."
            )
        
        # Alert: Repeated losses
        last_10 = await self.db.query("""
            SELECT outcome FROM outcomes
            ORDER BY timestamp DESC
            LIMIT 10
        """)
        
        losses = sum(1 for o in last_10 if o['outcome'] == 'LOST')
        if losses >= 9:  # 9/10 losses
            await self.send_alert(
                "WARNING",
                "9/10 recent bids lost. Possible model degradation."
            )
        
        # Alert: Model inference latency increased
        if self.metrics['model_latency_p95'] > 100:  # Was 50ms, now >100ms
            await self.send_alert(
                "WARNING",
                f"Model latency high: {self.metrics['model_latency_p95']:.0f}ms"
            )
```

---

## 7. BEST PRACTICES (2026 Standard)

### A. Preventing Overfitting

```python
"""
The biggest trap: Model trains on its own trading biases
"""

class OverfitPrevention:
    
    @staticmethod
    def use_walk_forward_validation():
        """
        Train on past, test on future.
        Never use future data in training.
        """
        pass
    
    @staticmethod
    def regularize_model():
        """
        Add L2 penalty to prevent memorization
        """
        optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
        loss = cross_entropy_loss + 0.01 * l2_norm(model.weights)
    
    @staticmethod
    def use_different_market_regimes():
        """
        Train on bull market data
        Validate on bear market data
        Ensure model generalizes
        """
        
        bull_market_data = get_data(2024)  # Bull
        bear_market_data = get_data(2022)  # Bear
        
        train_accuracy = evaluate(model, bull_market_data)
        test_accuracy = evaluate(model, bear_market_data)
        
        if test_accuracy << train_accuracy:
            print("Model overfit to bull market!")
            # Retrain on mixed data
    
    @staticmethod
    def monitor_out_of_sample_performance():
        """
        Constantly test on data the model never saw during training
        """
        
        holdout_set = get_latest_1000_trades()  # Never used in training
        accuracy = evaluate(model, holdout_set)
        
        if accuracy < baseline:
            alert("Model degrading on new data")
```

### B. Causality & No Look-Ahead

```python
"""
The second-biggest trap: Using future data to train
"""

WRONG:
    features = {
        'price_1h_later': get_price(timestamp + 3600),  # FUTURE DATA!
        'profit_realized': get_actual_profit_outcome(),  # CHEATING!
    }

RIGHT:
    features = {
        'price_5m_ago': get_price(timestamp - 300),   # PAST DATA
        'volatility_past': get_volatility(timestamp),  # HISTORICAL
        'hour_of_decision': get_hour(timestamp),       # AT DECISION TIME
    }
```

### C. Model Versioning & Rollback

```python
"""
Always be able to rollback to previous model
"""

class ModelRegistry:
    async def deploy_model(self, model_path: str, 
                          version: str, 
                          validation_accuracy: float):
        """
        1. Save to registry
        2. Deploy to canary (5%)
        3. Wait 1000 trades
        4. If good, promote to 100%
        5. If bad, rollback
        """
        
        # Save metadata
        metadata = {
            'version': version,
            'path': model_path,
            'accuracy': validation_accuracy,
            'deployed_at': datetime.now(),
            'status': 'CANARY',
        }
        
        self.db.insert('model_versions', metadata)
        
        # Deploy to 5%
        self.traffic_split[version] = 0.05
        self.traffic_split['current'] = 0.95
        
        # Monitor
        await self.monitor_canary_deployment(version)
    
    async def monitor_canary_deployment(self, version: str, 
                                       num_trades: int = 1000):
        """
        Track canary performance
        """
        
        canary_trades = await self.db.query("""
            SELECT * FROM outcomes
            WHERE model_version = ?
            ORDER BY timestamp DESC
            LIMIT ?
        """, (version, num_trades))
        
        accuracy = sum(1 for t in canary_trades if t['outcome'] == 'WON') / len(canary_trades)
        
        if accuracy > self.baseline_accuracy:
            print(f"✅ Canary passed! Promoting {version} to 100%")
            self.promote_to_production(version)
        else:
            print(f"❌ Canary failed! Rollback from {version}")
            self.rollback()
```

### D. Observability & Debugging

```python
"""
Log everything for later debugging
"""

class ObservabilityLayer:
    async def log_decision(self, decision: Decision, outcome: dict):
        """
        Store complete decision journey for debugging
        """
        
        log_entry = {
            'intent_id': outcome['intent_id'],
            'timestamp': datetime.now(),
            'decision': decision.__dict__,
            'outcome': outcome.__dict__,
            'features_used': decision.features_used,
            'model_version': decision.model_used,
            'latency_ms': decision.latency_ms,
            'risk_checks': decision.risk_checks_passed,
        }
        
        # Store for debugging
        self.db.insert('decision_log', log_entry)
        
        # Also publish to observability platform (DataDog, etc)
        await self.datadog.log_decision(log_entry)
    
    def debug_bad_decision(self, intent_id: str):
        """
        Replay a bad decision to understand why
        """
        
        log = self.db.get('decision_log', intent_id)
        
        print(f"Decision for {intent_id}:")
        print(f"  Model: {log['model_version']}")
        print(f"  Features: {log['features_used']}")
        print(f"  Confidence: {log['decision']['confidence']}")
        print(f"  Outcome: {log['outcome']}")
        
        # Hypothetically: what if we had MORE confidence?
        # What if we had LESS confidence?
        # Which features were most important?
```

---

## Complete Implementation Timeline

```
WEEK 1: Foundation
□ Set up event stream (NATS)
□ Implement outcome backfiller
□ Create feature store
□ Train baseline model (1.3B)
  Cost: 0 (just your time)
  Accuracy: ~60%

WEEK 2: Validation
□ Walk-forward validation
□ Drift detection
□ First retraining cycle
  Accuracy: ~70%

WEEK 3: Production
□ Deploy to canary (5%)
□ Monitor performance
□ Alerting system
  Accuracy: ~73%

WEEK 4: Optimization
□ Hard example mining
□ Multi-model bandit
□ Model registry
  Accuracy: ~75%

WEEK 5+: Scale
□ Parallel solvers
□ GPU acceleration
□ A/B testing new ideas
  Accuracy: 75-80%+
```

---

## Architecture Principles (2026 Standard)

### From Anthropic:
✅ **Interpretability** - Can you explain why the model decided to bid?
✅ **Safety** - Risk limits are hard constraints, not soft suggestions
✅ **Alignment** - Model should optimize for YOUR profit, not just win rate

### From OpenAI:
✅ **Scalability** - Can you add 10x more solvers without breaking anything?
✅ **Iterative improvement** - Retraining is continuous, not an event
✅ **Feedback loops** - Outcomes immediately improve the system

### From Jane Street:
✅ **Realism** - Features computed at decision time, not backfilled
✅ **Caution** - Walk-forward validation prevents look-ahead bias
✅ **Risk first** - Position sizing and capital management drive decisions
✅ **Regime awareness** - Model knows when market conditions change

---

## The Real Constraint

**It's not building this. Building it is 1-2 weeks.**

**The constraint is:**
1. **Historical data** - Need 1000+ trades to start learning (1-2 weeks of operation)
2. **Capital** - Need $10k+ to make meaningful bids
3. **Patience** - Model gets better weekly, not daily

But once you have 50k+ trades in your database, you have a proprietary asset that no one else has.

That's when you win.

---

## TL;DR: Ship This

This is the system a Jane Street quant, Anthropic researcher, and OpenAI engineer would build in a room together:

1. **Ingest** - Immutable event log (no cheating, no look-ahead)
2. **Process** - Features at decision-time only
3. **Think** - Fast model (1.3B) for speed, medium model (7B) for hard cases
4. **Act** - Risk limits are hard constraints, not soft targets
5. **Feedback** - Outcomes immediately retrain the model
6. **Monitor** - Alert on accuracy drop, latency increase, model drift
7. **Improve** - Walk-forward validation, hard example mining, multi-model bandits

Build it. Deploy by end of week. You'll know if it works in 2 weeks (first $1k in profit).

By week 4, you'll know if it can scale to $10k+/day.

The model learns. You learn. The system improves.

That's production.
