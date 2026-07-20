/**
 * AUTONOMOUS TRADING DASHBOARD
 *
 * Real-time visualization of:
 * - Pipeline execution (P1, P2, P3)
 * - Model training & inference
 * - Trading metrics & performance
 * - Signal integration
 * - Risk calculations (FloatLib)
 * - All primitives in action
 */

import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, TrendingUp, Zap, AlertCircle, CheckCircle, Clock, Database, Cpu } from 'lucide-react';

export default function AutonomousDashboard() {
  const [pipelineState, setPipelineState] = useState({
    status: 'initializing',
    uptime: '0d 0h',
    modelVersion: 0,
    modelAccuracy: 72.86,
    tradesExecutedTotal: 0,
    profitTotal: 0,
    lastSignalFetch: 0,
    lastModelTrain: 0,
    lastBacktest: 0,
    lastDriftCheck: 0
  });

  const [metrics, setMetrics] = useState({
    capital: 10000,
    roi: 16.5,
    winRate: 100,
    precision: 100,
    recall: 63.85,
    sharpe: 1.86,
    maxDrawdown: 0
  });

  const [signals, setSignals] = useState({
    stablecoinSupply: 150e9,
    dexVolume24h: 5e9,
    wethPrice: 2500,
    openInterest: 5e9,
    volumeScore: 75,
    volatilityScore: 60
  });

  const [trades, setTrades] = useState([
    { id: 1, pair: 'WETH→USDC', surplus: 393.1, markup: 0.5, confidence: 98.8, status: 'executed', timestamp: Date.now() },
    { id: 2, pair: 'DAI→USDC', surplus: 0.547, markup: 0.3, confidence: 100, status: 'executed', timestamp: Date.now() - 60000 },
    { id: 3, pair: 'USDT→USDC', surplus: 0.110, markup: 0.3, confidence: 100, status: 'pending', timestamp: Date.now() - 120000 }
  ]);

  const [primitives, setPrimitives] = useState({
    floatMath: { add: 124, subtract: 98, multiply: 156, divide: 42, calls: 420 },
    riskEngine: { positionChecks: 46, drawdownChecks: 46, leverage: 46 },
    ledger: { records: 1024, transitions: 156 },
    gasManager: { estimates: 234, optimizations: 56 }
  });

  const [chartData, setChartData] = useState([
    { time: '00:00', accuracy: 72.86, recall: 63.85, capital: 10000 },
    { time: '01:00', accuracy: 73.2, recall: 64.1, capital: 10165 },
    { time: '02:00', accuracy: 73.5, recall: 64.8, capital: 10325 },
    { time: '03:00', accuracy: 73.8, recall: 65.2, capital: 10512 },
    { time: '04:00', accuracy: 74.1, recall: 66.1, capital: 10687 },
    { time: '05:00', accuracy: 74.4, recall: 66.9, capital: 10890 }
  ]);

  const [activeTab, setActiveTab] = useState('overview');
  const [p1Status, setP1Status] = useState('fetching');
  const [p2Status, setP2Status] = useState('waiting');
  const [p3Status, setP3Status] = useState('monitoring');

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Update random metrics slightly
      setPipelineState(prev => ({
        ...prev,
        modelAccuracy: Math.min(100, Math.max(60, prev.modelAccuracy + (Math.random() - 0.5) * 2))
      }));

      // Simulate P1 progress
      if (Math.random() > 0.7) {
        setP1Status(s => s === 'fetching' ? 'training' : s === 'training' ? 'complete' : 'fetching');
      }

      // Random signal update
      setSignals(prev => ({
        ...prev,
        wethPrice: prev.wethPrice + (Math.random() - 0.5) * 50,
        dexVolume24h: prev.dexVolume24h + (Math.random() - 0.5) * 100e6,
        volumeScore: Math.max(0, Math.min(100, prev.volumeScore + (Math.random() - 0.5) * 10)))
      }));

      // Random trades
      if (Math.random() > 0.85) {
        const pairs = ['WETH→USDC', 'DAI→USDC', 'USDT→USDC', 'USDC→WETH'];
        setTrades(prev => [{
          id: prev[0].id + 1,
          pair: pairs[Math.floor(Math.random() * pairs.length)],
          surplus: Math.random() * 1000,
          markup: 0.1 + Math.random() * 0.9,
          confidence: 65 + Math.random() * 35,
          status: Math.random() > 0.2 ? 'executed' : 'pending',
          timestamp: Date.now()
        }, ...prev.slice(0, 9)]);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
              Sentinel Autonomous Pipeline
            </h1>
            <p className="text-slate-400">Real-time trading system orchestration & primitives</p>
          </div>
          <div className="text-right">
            <div className={`text-sm px-3 py-1 rounded-full font-medium inline-block ${
              pipelineState.status === 'running'
                ? 'bg-green-900 text-green-300'
                : 'bg-yellow-900 text-yellow-300'
            }`}>
              <Zap className="inline mr-1" size={14} />
              {pipelineState.status === 'running' ? '🟢 LIVE' : '🟡 STARTING'}
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Model Accuracy"
            value={`${pipelineState.modelAccuracy.toFixed(1)}%`}
            trend="+1.5%"
            icon={<Cpu className="text-cyan-400" />}
          />
          <MetricCard
            label="Capital"
            value={`$${(metrics.capital).toLocaleString()}`}
            trend={`+${metrics.roi.toFixed(1)}%`}
            icon={<TrendingUp className="text-green-400" />}
          />
          <MetricCard
            label="Win Rate"
            value={`${metrics.winRate}%`}
            trend="Precision"
            icon={<CheckCircle className="text-blue-400" />}
          />
          <MetricCard
            label="Model v"
            value={pipelineState.modelVersion}
            trend="Enhanced"
            icon={<Activity className="text-purple-400" />}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-slate-700">
        {['overview', 'primitives', 'signals', 'trades', 'performance'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 capitalize transition ${
              activeTab === tab
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'overview' && <OverviewTab pipelineState={pipelineState} p1Status={p1Status} p2Status={p2Status} p3Status={p3Status} />}
      {activeTab === 'primitives' && <PrimitivesTab primitives={primitives} />}
      {activeTab === 'signals' && <SignalsTab signals={signals} />}
      {activeTab === 'trades' && <TradesTab trades={trades} />}
      {activeTab === 'performance' && <PerformanceTab chartData={chartData} metrics={metrics} />}
    </div>
  );
}

// ============================================================================
// COMPONENTS
// ============================================================================

function MetricCard({ label, value, trend, icon }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-cyan-500 transition">
      <div className="flex justify-between items-start mb-2">
        <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
        <div className="text-cyan-400">{icon}</div>
      </div>
      <p className="text-2xl font-bold mb-1">{value}</p>
      <p className="text-xs text-green-400">{trend}</p>
    </div>
  );
}

function OverviewTab({ pipelineState, p1Status, p2Status, p3Status }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Priority 1 */}
      <PriorityCard
        title="Priority 1: Signals"
        description="Collection & Model Enhancement"
        interval="Every 1 hour"
        status={p1Status}
        lastRun="1m ago"
        items={[
          '✓ DefiLlama signals fetched',
          '✓ Training data enriched',
          '→ Model retraining...'
        ]}
      />

      {/* Priority 2 */}
      <PriorityCard
        title="Priority 2: Real Data"
        description="Backtest & Validation"
        interval="Every 7 days"
        status={p2Status}
        lastRun="6d 18h ago"
        items={[
          '✓ CoW Protocol data ready',
          '→ Backtest scheduled (3d)",
          '→ Pattern validation pending'
        ]}
      />

      {/* Priority 3 */}
      <PriorityCard
        title="Priority 3: Monitoring"
        description="Drift Detection & Recovery"
        interval="Every 24 hours"
        status={p3Status}
        lastRun="3h ago"
        items={[
          '✓ Accuracy: 72.86%',
          '✓ No drift detected',
          '→ Daily report generation'
        ]}
      />

      {/* System Health */}
      <div className="lg:col-span-3 bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Clock className="text-cyan-400" size={20} />
          System Health
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <HealthItem label="Uptime" value="7d 14h" status="good" />
          <HealthItem label="Memory" value="128MB" status="good" />
          <HealthItem label="CPU" value="2.3%" status="good" />
          <HealthItem label="Processes" value="3 active" status="good" />
        </div>
      </div>
    </div>
  );
}

function PriorityCard({ title, description, interval, status, lastRun, items }) {
  const statusColor = {
    'fetching': 'text-blue-400',
    'training': 'text-purple-400',
    'complete': 'text-green-400',
    'waiting': 'text-slate-400',
    'monitoring': 'text-cyan-400'
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-cyan-500 transition">
      <div className="mb-4">
        <h3 className="text-lg font-bold mb-1">{title}</h3>
        <p className="text-xs text-slate-400">{description}</p>
      </div>

      <div className="bg-slate-900 rounded p-3 mb-4 text-xs">
        <div className="flex justify-between mb-2">
          <span className="text-slate-400">Interval</span>
          <span className="text-slate-300">{interval}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Status</span>
          <span className={`capitalize ${statusColor[status]}`}>{status}</span>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        {items.map((item, i) => (
          <div key={i} className={item.startsWith('✓') ? 'text-green-400' : item.startsWith('→') ? 'text-cyan-400' : 'text-slate-400'}>
            {item}
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 mt-4">Last run: {lastRun}</p>
    </div>
  );
}

function HealthItem({ label, value, status }) {
  const statusColor = status === 'good' ? 'text-green-400' : 'text-yellow-400';
  const statusBg = status === 'good' ? 'bg-green-900/20' : 'bg-yellow-900/20';

  return (
    <div className={`${statusBg} border border-${status === 'good' ? 'green' : 'yellow'}-800 rounded p-3`}>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`font-bold ${statusColor}`}>{value}</p>
    </div>
  );
}

function PrimitivesTab({ primitives }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* FloatMath */}
      <PrimitiveCard
        title="FloatMath"
        description="Arbitrary Precision"
        icon="🔢"
        color="cyan"
        operations={[
          { name: 'Add', count: primitives.floatMath.add },
          { name: 'Subtract', count: primitives.floatMath.subtract },
          { name: 'Multiply', count: primitives.floatMath.multiply },
          { name: 'Divide', count: primitives.floatMath.divide }
        ]}
        total={primitives.floatMath.calls}
      />

      {/* RiskEngine */}
      <PrimitiveCard
        title="RiskEngine"
        description="Position & Leverage"
        icon="⚠️"
        color="red"
        operations={[
          { name: 'Position Checks', count: primitives.riskEngine.positionChecks },
          { name: 'Drawdown Checks', count: primitives.riskEngine.drawdownChecks },
          { name: 'Leverage Limits', count: primitives.riskEngine.leverage }
        ]}
        total={primitives.riskEngine.positionChecks + primitives.riskEngine.drawdownChecks + primitives.riskEngine.leverage}
      />

      {/* Ledger */}
      <PrimitiveCard
        title="Ledger"
        description="State & Records"
        icon="📊"
        color="blue"
        operations={[
          { name: 'Records', count: primitives.ledger.records },
          { name: 'Transitions', count: primitives.ledger.transitions }
        ]}
        total={primitives.ledger.records + primitives.ledger.transitions}
      />

      {/* GasManager */}
      <PrimitiveCard
        title="GasManager"
        description="Cost Optimization"
        icon="⛽"
        color="green"
        operations={[
          { name: 'Estimates', count: primitives.gasManager.estimates },
          { name: 'Optimizations', count: primitives.gasManager.optimizations }
        ]}
        total={primitives.gasManager.estimates + primitives.gasManager.optimizations}
      />
    </div>
  );
}

function PrimitiveCard({ title, description, icon, color, operations, total }) {
  const borderColor = {
    cyan: 'border-cyan-700',
    red: 'border-red-700',
    blue: 'border-blue-700',
    green: 'border-green-700'
  };

  const textColor = {
    cyan: 'text-cyan-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    green: 'text-green-400'
  };

  return (
    <div className={`bg-slate-800 border ${borderColor[color]} rounded-lg p-6 hover:shadow-lg hover:shadow-${color}-500/20 transition`}>
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      <p className="text-xs text-slate-400 mb-4">{description}</p>

      <div className="space-y-2 mb-4 text-xs">
        {operations.map((op, i) => (
          <div key={i} className="flex justify-between text-slate-300">
            <span>{op.name}</span>
            <span className={textColor[color]} className="font-bold">{op.count}</span>
          </div>
        ))}
      </div>

      <div className={`bg-slate-900 rounded p-3 text-center border-l-2 border-${color}-500`}>
        <p className="text-xs text-slate-400">Total Calls</p>
        <p className={`text-2xl font-bold ${textColor[color]}`}>{total}</p>
      </div>
    </div>
  );
}

function SignalsTab({ signals }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Signal Gauges */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold mb-4">Market Signals</h3>

        <SignalGauge label="Volume Score" value={signals.volumeScore} max={100} color="cyan" />
        <SignalGauge label="Volatility Score" value={signals.volatilityScore} max={100} color="purple" />

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <p className="text-sm text-slate-400 mb-2">WETH Price</p>
          <p className="text-3xl font-bold text-green-400">${signals.wethPrice.toFixed(2)}</p>
          <p className="text-xs text-green-400 mt-1">↑ +$15.32 (24h)</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <p className="text-sm text-slate-400 mb-2">DEX Volume (24h)</p>
          <p className="text-3xl font-bold text-blue-400">${(signals.dexVolume24h / 1e9).toFixed(2)}B</p>
          <p className="text-xs text-blue-400 mt-1">↑ +$250M (avg)</p>
        </div>
      </div>

      {/* Signal Impact */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-4">Signal Impact on Model</h3>

        <div className="space-y-3">
          <ImpactBar label="Volume → Recall" impact={65} color="cyan" />
          <ImpactBar label="Volatility → Confidence" impact={72} color="purple" />
          <ImpactBar label="OI → Position Sizing" impact={58} color="red" />
          <ImpactBar label="Stablecoin Supply → Regime" impact={81} color="green" />
        </div>

        <div className="mt-6 p-4 bg-slate-900 rounded border-l-2 border-blue-500">
          <p className="text-xs text-slate-400 mb-2">Status</p>
          <p className="text-sm text-blue-300">✓ All signals nominal. Model confidence: 94%</p>
        </div>
      </div>
    </div>
  );
}

function SignalGauge({ label, value, max, color }) {
  const colorClasses = {
    cyan: 'bg-cyan-500',
    purple: 'bg-purple-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500'
  };

  const percentage = (value / max) * 100;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="flex justify-between mb-2">
        <p className="text-sm text-slate-400">{label}</p>
        <p className="text-sm font-bold text-slate-300">{value}/{max}</p>
      </div>
      <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

function ImpactBar({ label, impact, color }) {
  const colorClasses = {
    cyan: 'bg-cyan-500',
    purple: 'bg-purple-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500'
  };

  return (
    <div>
      <div className="flex justify-between mb-1">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-xs font-bold text-slate-300">{impact}%</p>
      </div>
      <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]}`}
          style={{ width: `${impact}%` }}
        ></div>
      </div>
    </div>
  );
}

function TradesTab({ trades }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Recent Trades (Last 10)</h3>
        <div className="text-xs text-green-400">●  {trades.filter(t => t.status === 'executed').length} Executed</div>
      </div>

      <div className="space-y-2">
        {trades.map(trade => (
          <div key={trade.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-cyan-500 transition">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-bold text-cyan-400">{trade.pair}</p>
                <p className="text-xs text-slate-400">Surplus: {trade.surplus.toFixed(4)} ETH</p>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                trade.status === 'executed' ? 'bg-green-900 text-green-300' : 'bg-blue-900 text-blue-300'
              }`}>
                {trade.status === 'executed' ? '✓ Executed' : '⏳ Pending'}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-slate-400 mb-1">Markup</p>
                <p className="font-bold text-slate-300">{trade.markup.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-slate-400 mb-1">Confidence</p>
                <p className="font-bold text-purple-400">{trade.confidence.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-slate-400 mb-1">Expected Profit</p>
                <p className="font-bold text-green-400">+{(trade.surplus * 0.005).toFixed(4)} ETH</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PerformanceTab({ chartData, metrics }) {
  return (
    <div className="space-y-6">
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accuracy Over Time */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-bold mb-4">Model Accuracy Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" domain={[60, 80]} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Line type="monotone" dataKey="accuracy" stroke="#06b6d4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Capital Growth */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-bold mb-4">Capital Growth</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Area type="monotone" dataKey="capital" stroke="#10b981" fill="#10b98133" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricBox label="Precision" value={`${metrics.precision}%`} subtext="Never wrong" color="green" />
        <MetricBox label="Recall" value={`${metrics.recall.toFixed(1)}%`} subtext="Catch 63.85% of wins" color="blue" />
        <MetricBox label="Sharpe Ratio" value={metrics.sharpe.toFixed(2)} subtext="Risk-adjusted" color="purple" />
        <MetricBox label="Max Drawdown" value={`${metrics.maxDrawdown}%`} subtext="Best case" color="cyan" />
      </div>
    </div>
  );
}

function MetricBox({ label, value, subtext, color }) {
  const bgColor = {
    green: 'bg-green-900/20 border-green-700',
    blue: 'bg-blue-900/20 border-blue-700',
    purple: 'bg-purple-900/20 border-purple-700',
    cyan: 'bg-cyan-900/20 border-cyan-700'
  };

  const textColor = {
    green: 'text-green-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    cyan: 'text-cyan-400'
  };

  return (
    <div className={`${bgColor[color]} border rounded-lg p-4`}>
      <p className="text-xs text-slate-400 mb-2">{label}</p>
      <p className={`text-2xl font-bold ${textColor[color]} mb-1`}>{value}</p>
      <p className="text-xs text-slate-500">{subtext}</p>
    </div>
  );
}
