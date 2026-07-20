/**
 * SENTINEL DASHBOARD + AI CHAT
 *
 * Interactive dashboard with OpenWebUI-style chat interface
 * Query the SLM about:
 * - Trading decisions
 * - Signal interpretation
 * - Risk analysis
 * - Model reasoning
 * - Historical performance
 */

import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Settings, Menu, X, Zap } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, ResponsiveContainer } from 'recharts';

export default function SentinelDashboardWithAI() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showChat, setShowChat] = useState(true);
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'ai',
      text: 'Hey! I\'m your Sentinel AI assistant. I can help you understand trading decisions, market signals, risk calculations, and model reasoning. Ask me anything about the system!',
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Simulate AI response (in production, call Ollama/LLM)
    setTimeout(() => {
      const responses = {
        'signal': 'Based on current signals: Volume Score is 75 (healthy), Volatility at 60 (moderate). DEX volumes up $250M showing strong capital flow. The stablecoin supply is up, indicating risk-on sentiment. Model confidence at 94% for current market regime.',
        'decision': 'The last WETH→USDC trade executed with 98.8% confidence because: (1) Strong historical surplus (393.1 ETH), (2) High DEX volume, (3) Positive stablecoin supply trend, (4) No leverage concerns. Risk check: Position at 3.2% of capital (under 5% limit). Profit margin justified.',
        'risk': 'Current risk profile: Max drawdown 0%, Position sizing enforced at 5% per order, Leverage limits active, Daily loss cap at 10%. FloatLib precision prevents rounding errors. All hard limits respected. System is in safe operating range.',
        'model': 'Model v2 (enhanced) is 72.86% accurate. Precision: 100% (never recommends losers), Recall: 63.85% (room to improve with signals). Last retrain 1h ago with enriched signal features. Drift check passed - no accuracy degradation detected.',
        'capital': 'Starting capital: $10,000. Current: $10,890 (+8.9% ROI). 46 trades executed on $10k capital. Win rate: 100% on recommended orders. Projected monthly: $50k+ with scaling. Gas costs: ~$0.01 ETH per trade.',
        'signals': 'Live signals: WETH $2,500.32 (↑$15.32), Stablecoin supply $150B (↑$500M risk-on), DEX volume $5.2B, OI $5B. All signals integrated into model. Volume score 75%, Volatility 60%, Regime detection 94% confident in current market state.',
        'default': 'I can help with: (1) Signal explanation, (2) Trade decisions, (3) Risk analysis, (4) Model reasoning, (5) Capital performance, (6) System status. What would you like to know?'
      };

      const key = Object.keys(responses).find(k => input.toLowerCase().includes(k)) || 'default';
      const response = responses[key];

      const aiMessage = {
        id: userMessage.id + 1,
        type: 'ai',
        text: response,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, aiMessage]);
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white flex">
      {/* Main Dashboard */}
      <div className={`flex-1 transition-all ${showChat ? 'lg:mr-96' : ''}`}>
        <DashboardContent activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* Chat Sidebar */}
      {showChat && (
        <div className="w-96 bg-slate-900 border-l border-slate-700 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <MessageCircle className="text-cyan-400" size={20} />
              <h3 className="font-bold">Sentinel AI</h3>
            </div>
            <button
              onClick={() => setShowChat(false)}
              className="p-2 hover:bg-slate-800 rounded transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))}
            {loading && (
              <div className="flex justify-center py-4">
                <div className="animate-pulse flex gap-1">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animation-delay-100"></div>
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animation-delay-200"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {messages.length === 1 && (
            <div className="px-4 py-2 space-y-2 border-t border-slate-700">
              <p className="text-xs text-slate-400">Quick questions:</p>
              <div className="space-y-2">
                {[
                  'Explain current signals',
                  'Why was last trade executed?',
                  'Current risk profile',
                  'Model accuracy details'
                ].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(q);
                      setTimeout(() => handleSendMessage(), 0);
                    }}
                    className="w-full text-left text-xs p-2 bg-slate-800 hover:bg-slate-700 rounded transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-slate-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask about trades, signals, risk..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || loading}
                className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 rounded px-3 py-2 transition flex items-center gap-2"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Chat Button */}
      {!showChat && (
        <button
          onClick={() => setShowChat(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-cyan-600 hover:bg-cyan-700 rounded-full flex items-center justify-center transition shadow-lg"
          title="Open AI Chat"
        >
          <MessageCircle size={24} />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// CHAT MESSAGE COMPONENT
// ============================================================================

function ChatMessage({ message }) {
  const isAI = message.type === 'ai';

  return (
    <div className={`flex ${isAI ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-xs px-4 py-2 rounded-lg ${
          isAI
            ? 'bg-slate-800 border border-slate-700 text-slate-200'
            : 'bg-cyan-600 text-white'
        }`}
      >
        <p className="text-sm leading-relaxed">{message.text}</p>
        <p className={`text-xs mt-1 ${isAI ? 'text-slate-500' : 'text-cyan-100'}`}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// DASHBOARD CONTENT
// ============================================================================

function DashboardContent({ activeTab, setActiveTab }) {
  const [pipelineState] = React.useState({
    status: 'running',
    modelAccuracy: 72.86,
    modelVersion: 2
  });

  const [chartData] = React.useState([
    { time: '00:00', accuracy: 72.86, capital: 10000 },
    { time: '01:00', accuracy: 73.2, capital: 10165 },
    { time: '02:00', accuracy: 73.5, capital: 10325 },
    { time: '03:00', accuracy: 73.8, capital: 10512 },
    { time: '04:00', accuracy: 74.1, capital: 10687 },
    { time: '05:00', accuracy: 74.4, capital: 10890 }
  ]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
              Sentinel Autonomous Pipeline
            </h1>
            <p className="text-slate-400">With AI-powered insights & guidance</p>
          </div>
          <div className={`text-sm px-3 py-1 rounded-full font-medium inline-block ${
            pipelineState.status === 'running'
              ? 'bg-green-900 text-green-300'
              : 'bg-yellow-900 text-yellow-300'
          }`}>
            🟢 LIVE
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Model Accuracy" value={`${pipelineState.modelAccuracy}%`} />
          <MetricCard label="Capital" value="$10,890" />
          <MetricCard label="Win Rate" value="100%" />
          <MetricCard label="Model v" value={pipelineState.modelVersion} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-slate-700">
        {['overview', 'performance', 'signals'].map(tab => (
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
      {activeTab === 'overview' && <OverviewContent />}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4">Capital Growth</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <Area type="monotone" dataKey="capital" stroke="#10b981" fill="#10b98133" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {activeTab === 'signals' && <SignalsContent />}
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-cyan-500 transition">
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}

function OverviewContent() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <PriorityCard
        title="Priority 1"
        description="Signals & Training"
        interval="Every 1 hour"
        items={['✓ DefiLlama signals', '✓ Data enriched', '→ Retraining model']}
      />
      <PriorityCard
        title="Priority 2"
        description="Real Data Validation"
        interval="Every 7 days"
        items={['✓ CoW data ready', '→ Backtest scheduled', '→ Pattern validation']}
      />
      <PriorityCard
        title="Priority 3"
        description="Drift Detection"
        interval="Every 24 hours"
        items={['✓ Accuracy: 72.86%', '✓ No drift', '→ Report generation']}
      />
    </div>
  );
}

function PriorityCard({ title, description, interval, items }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      <p className="text-xs text-slate-400 mb-4">{description}</p>
      <div className="bg-slate-900 rounded p-3 mb-4 text-xs space-y-2">
        {items.map((item, i) => (
          <div key={i} className={item.startsWith('✓') ? 'text-green-400' : 'text-cyan-400'}>
            {item}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">{interval}</p>
    </div>
  );
}

function SignalsContent() {
  return (
    <div className="space-y-4">
      <SignalBox label="Volume Score" value={75} />
      <SignalBox label="Volatility Score" value={60} />
      <SignalBox label="WETH Price" value={2500.32} unit="$" />
    </div>
  );
}

function SignalBox({ label, value, unit = '' }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <p className="text-sm text-slate-400 mb-2">{label}</p>
      <p className="text-3xl font-bold text-cyan-400">{unit}{value}</p>
    </div>
  );
}
