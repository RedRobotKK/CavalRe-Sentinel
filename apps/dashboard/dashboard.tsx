/**
 * SOLVER DASHBOARD - Production React Component
 *
 * Features:
 * - Wallet connection (MetaMask, WalletConnect)
 * - Real-time data streaming via WebSocket
 * - Live intent feed
 * - Capital management
 * - Model performance monitoring
 * - Trade history
 *
 * Install:
 * npm install react ethers web3modal wagmi zustand recharts
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ============================================================================
// TYPES
// ============================================================================

interface Intent {
  id: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  timestamp: number;
}

interface Decision {
  intent: Intent;
  decision: 'BID' | 'SKIP';
  bidAmount?: number;
  confidence: number;
  timestamp: number;
}

interface Outcome {
  intentId: string;
  won: boolean;
  profit: number;
  timestamp: number;
}

interface Trade {
  intentId: string;
  pair: string;
  amount: number;
  decision: string;
  outcome: 'WON' | 'LOST' | 'PENDING';
  profit: number;
  timestamp: number;
}

interface SolverStatus {
  running: boolean;
  uptime: number;
  version: string;
}

interface Capital {
  available: number;
  usdc: number;
  eth: number;
  openPositions: number;
  dailyLoss: number;
}

interface Performance {
  winRate: number;
  dailyPnL: number;
  totalProfit: number;
  modelAccuracy: number;
  lastTrade: string;
}

// ============================================================================
// ZUSTAND STORE (State Management)
// ============================================================================

interface Store {
  // Wallet
  connected: boolean;
  address: string | null;
  setConnected: (connected: boolean) => void;
  setAddress: (address: string | null) => void;

  // Data
  status: SolverStatus;
  capital: Capital;
  performance: Performance;
  intents: Decision[];
  trades: Trade[];
  chartData: any[];

  // Updates
  addIntent: (decision: Decision) => void;
  addTrade: (trade: Trade) => void;
  updateStatus: (status: SolverStatus) => void;
  updateCapital: (capital: Capital) => void;
  updatePerformance: (perf: Performance) => void;
}

const useStore = (() => {
  let store: Store = {
    connected: false,
    address: null,
    setConnected: (connected) => {
      store.connected = connected;
    },
    setAddress: (address) => {
      store.address = address;
    },

    status: { running: false, uptime: 0, version: 'v1' },
    capital: { available: 50000, usdc: 42500, eth: 5.25, openPositions: 0, dailyLoss: 0 },
    performance: { winRate: 0, dailyPnL: 0, totalProfit: 0, modelAccuracy: 0, lastTrade: '-' },
    intents: [],
    trades: [],
    chartData: [],

    addIntent: (decision) => {
      store.intents = [decision, ...store.intents].slice(0, 50);
    },
    addTrade: (trade) => {
      store.trades = [trade, ...store.trades].slice(0, 100);
    },
    updateStatus: (status) => {
      store.status = status;
    },
    updateCapital: (capital) => {
      store.capital = capital;
    },
    updatePerformance: (perf) => {
      store.performance = perf;
    },
  };

  return () => store;
})();

// ============================================================================
// WALLET HOOK
// ============================================================================

const useWallet = () => {
  const store = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      const address = accounts[0];
      store.setAddress(address);
      store.setConnected(true);

      // Get balance (simplified - use ethers.js in real app)
      console.log('Connected:', address);
    } catch (err: any) {
      setError(err.message);
      store.setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    store.setAddress(null);
    store.setConnected(false);
  }, []);

  return { connect, disconnect, loading, error, connected: store.connected, address: store.address };
};

// ============================================================================
// WEBSOCKET HOOK
// ============================================================================

const useWebSocket = (url: string) => {
  const store = useStore();
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Don't connect if solver not running (development)
    if (!url) return;

    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'intent') {
            store.addIntent(data.payload);
          } else if (data.type === 'trade') {
            store.addTrade(data.payload);
          } else if (data.type === 'status') {
            store.updateStatus(data.payload);
          } else if (data.type === 'capital') {
            store.updateCapital(data.payload);
          } else if (data.type === 'performance') {
            store.updatePerformance(data.payload);
          }
        } catch (e) {
          console.error('WebSocket message parse error:', e);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
      };
    } catch (e) {
      console.error('WebSocket connection error:', e);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [url]);

  return connected;
};

// ============================================================================
// COMPONENTS
// ============================================================================

const WalletButton: React.FC = () => {
  const { connect, disconnect, loading, connected, address } = useWallet();

  if (connected && address) {
    return (
      <button
        onClick={disconnect}
        style={{
          padding: '8px 16px',
          background: '#00ff88',
          color: '#0a0e27',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontFamily: 'monospace',
          fontWeight: 'bold',
        }}
      >
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={loading}
      style={{
        padding: '8px 16px',
        background: 'transparent',
        border: '2px solid #00ff88',
        color: '#00ff88',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: 'monospace',
        fontWeight: 'bold',
      }}
    >
      {loading ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
};

const StatusCard: React.FC = () => {
  const store = useStore();

  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>💰 CAPITAL</h3>
      <div style={styles.metric}>
        <span style={styles.label}>Available</span>
        <span style={{ ...styles.value, color: '#00ff88' }}>
          ${store.capital.available.toLocaleString()}
        </span>
      </div>
      <div style={styles.metric}>
        <span style={styles.label}>USDC Balance</span>
        <span style={styles.value}>${store.capital.usdc.toLocaleString()}</span>
      </div>
      <div style={styles.metric}>
        <span style={styles.label}>ETH Balance</span>
        <span style={styles.value}>{store.capital.eth.toFixed(2)} Ξ</span>
      </div>
      <div style={styles.metric}>
        <span style={styles.label}>Daily Loss Used</span>
        <span style={styles.value}>${store.capital.dailyLoss.toLocaleString()}</span>
      </div>
      <div style={{ ...styles.status, background: '#1a3a1a', color: '#00ff00', marginTop: '12px' }}>
        🟢 LIVE
      </div>
    </div>
  );
};

const PerformanceCard: React.FC = () => {
  const store = useStore();

  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>📊 PERFORMANCE</h3>
      <div style={styles.metric}>
        <span style={styles.label}>Win Rate</span>
        <span style={styles.value}>{(store.performance.winRate * 100).toFixed(1)}%</span>
      </div>
      <div style={styles.metric}>
        <span style={styles.label}>Daily P&L</span>
        <span style={{ ...styles.value, color: store.performance.dailyPnL >= 0 ? '#00ff00' : '#ff0000' }}>
          ${store.performance.dailyPnL.toLocaleString()}
        </span>
      </div>
      <div style={styles.metric}>
        <span style={styles.label}>Total Profit</span>
        <span style={{ ...styles.value, color: '#00ff00' }}>
          ${store.performance.totalProfit.toLocaleString()}
        </span>
      </div>
      <div style={styles.metric}>
        <span style={styles.label}>Model Accuracy</span>
        <span style={styles.value}>{(store.performance.modelAccuracy * 100).toFixed(1)}%</span>
      </div>
      <div style={styles.metric}>
        <span style={styles.label}>Last Trade</span>
        <span style={styles.value}>{store.performance.lastTrade}</span>
      </div>
    </div>
  );
};

const IntentFeed: React.FC = () => {
  const store = useStore();

  return (
    <div style={{ ...styles.card, gridColumn: '1 / -1' }}>
      <h3 style={styles.cardTitle}>📡 LIVE INTENT STREAM</h3>
      <div style={{ maxHeight: '400px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px' }}>
        {store.intents.length === 0 ? (
          <div style={{ color: '#666', padding: '20px', textAlign: 'center' }}>
            Waiting for intents...
          </div>
        ) : (
          store.intents.map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: '12px',
                borderBottom: '1px solid #333',
                animation: 'slideIn 0.3s ease-out',
              }}
            >
              <div style={{ color: '#00ffff', marginBottom: '4px' }}>
                {item.tokenIn}→{item.tokenOut} • ${item.intent.amountIn.toFixed(0)}
              </div>
              <div style={{ color: '#888', fontSize: '11px' }}>
                {item.decision === 'BID' ? (
                  <>
                    <span style={{ color: '#00ff00' }}>✓ BID</span> ${item.bidAmount?.toFixed(0)} •{' '}
                    <span style={{ color: '#fbbf24' }}>{(item.confidence * 100).toFixed(0)}%</span> confident
                  </>
                ) : (
                  <span style={{ color: '#ff0000' }}>✗ SKIP</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

const ProfitChart: React.FC = () => {
  // Mock data - in production, connect to solver
  const data = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}h`,
    profit: Math.sin(i / 4) * 500 + Math.random() * 300,
  }));

  return (
    <div style={{ ...styles.card, gridColumn: '1 / -1' }}>
      <h3 style={styles.cardTitle}>📈 PROFIT OVER TIME (24h)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="hour" stroke="#888" style={{ fontSize: '12px' }} />
          <YAxis stroke="#888" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{ background: '#1a1f3a', border: '1px solid #00ff88', borderRadius: '4px' }}
            labelStyle={{ color: '#00ff88' }}
          />
          <Line type="monotone" dataKey="profit" stroke="#00ff00" dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const TradeHistory: React.FC = () => {
  const store = useStore();

  return (
    <div style={{ ...styles.card, gridColumn: '1 / -1' }}>
      <h3 style={styles.cardTitle}>📋 TRADE HISTORY</h3>
      <div style={{ overflowX: 'auto', fontSize: '12px', fontFamily: 'monospace' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #00ff88' }}>
              <th style={{ textAlign: 'left', padding: '8px', color: '#00ffff' }}>Time</th>
              <th style={{ textAlign: 'left', padding: '8px', color: '#00ffff' }}>Pair</th>
              <th style={{ textAlign: 'left', padding: '8px', color: '#00ffff' }}>Amount</th>
              <th style={{ textAlign: 'left', padding: '8px', color: '#00ffff' }}>Decision</th>
              <th style={{ textAlign: 'left', padding: '8px', color: '#00ffff' }}>Outcome</th>
              <th style={{ textAlign: 'right', padding: '8px', color: '#00ffff' }}>P&L</th>
            </tr>
          </thead>
          <tbody>
            {store.trades.slice(0, 10).map((trade, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #333' }}>
                <td style={{ padding: '8px', color: '#888' }}>
                  {new Date(trade.timestamp).toLocaleTimeString()}
                </td>
                <td style={{ padding: '8px' }}>{trade.pair}</td>
                <td style={{ padding: '8px' }}>${trade.amount.toLocaleString()}</td>
                <td style={{ padding: '8px', color: trade.decision === 'BID' ? '#00ff00' : '#ff0000' }}>
                  {trade.decision}
                </td>
                <td style={{ padding: '8px', color: trade.outcome === 'WON' ? '#00ff00' : trade.outcome === 'LOST' ? '#ff0000' : '#888' }}>
                  {trade.outcome}
                </td>
                <td style={{ padding: '8px', textAlign: 'right', color: trade.profit >= 0 ? '#00ff00' : '#ff0000' }}>
                  {trade.profit >= 0 ? '+' : ''} ${trade.profit.toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

const Dashboard: React.FC = () => {
  const store = useStore();
  const wsConnected = useWebSocket(process.env.REACT_APP_SOLVER_WS || '');

  // Simulate data for development
  useEffect(() => {
    if (!wsConnected) {
      const interval = setInterval(() => {
        // Mock intent
        if (Math.random() > 0.7) {
          const pairs = [
            ['USDC', 'ETH'],
            ['ETH', 'USDC'],
            ['DAI', 'USDT'],
          ];
          const [tokenIn, tokenOut] = pairs[Math.floor(Math.random() * pairs.length)];

          store.addIntent({
            intent: {
              id: Math.random().toString(),
              tokenIn,
              tokenOut,
              amountIn: Math.random() * 10000 + 1000,
              timestamp: Date.now(),
            },
            decision: Math.random() > 0.3 ? 'BID' : 'SKIP',
            bidAmount: Math.random() * 500,
            confidence: Math.random() * 0.3 + 0.7,
            timestamp: Date.now(),
          });
        }

        // Mock stats update
        store.updatePerformance({
          winRate: 0.25 + Math.random() * 0.1,
          dailyPnL: Math.random() * 2000 - 500,
          totalProfit: 12450 + Math.random() * 500,
          modelAccuracy: 0.76 + Math.random() * 0.05,
          lastTrade: Math.random() > 0.5 ? '2 sec ago' : '1 min ago',
        });
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [wsConnected]);

  return (
    <div style={styles.container}>
      <style>{styles.globalCSS}</style>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🤖 SOLVER DASHBOARD</h1>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: wsConnected ? '#00ff00' : '#ff0000' }}>
            {wsConnected ? '🟢 Connected' : '🔴 Disconnected (Dev Mode)'}
          </div>
          <WalletButton />
        </div>
      </div>

      {/* Main Grid */}
      <div style={styles.grid}>
        <StatusCard />
        <PerformanceCard />
        <IntentFeed />
        <ProfitChart />
        <TradeHistory />
      </div>
    </div>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  globalCSS: `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Courier New', monospace;
      background: #0a0e27;
      color: #e0e0e0;
    }

    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: #1a1f3a;
    }

    ::-webkit-scrollbar-thumb {
      background: #00ff88;
      border-radius: 4px;
    }
  `,

  container: {
    minHeight: '100vh',
    background: '#0a0e27',
    color: '#e0e0e0',
    padding: '24px',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
    paddingBottom: '16px',
    borderBottom: '1px solid #333',
  },

  title: {
    fontSize: '32px',
    color: '#00ffff',
    fontWeight: 'bold',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
  },

  card: {
    background: '#1a1f3a',
    border: '2px solid #00ff88',
    borderRadius: '8px',
    padding: '20px',
  },

  cardTitle: {
    fontSize: '14px',
    color: '#00ffff',
    marginBottom: '16px',
    textTransform: 'uppercase' as const,
    fontWeight: 'bold',
  },

  metric: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    fontSize: '14px',
  },

  label: {
    color: '#888',
    fontSize: '12px',
  },

  value: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#00ff88',
  },

  status: {
    padding: '8px 12px',
    borderRadius: '4px',
    textAlign: 'center' as const,
    fontSize: '12px',
    fontWeight: 'bold',
    background: '#1a3a1a',
    color: '#00ff00',
  },
};

export default Dashboard;
