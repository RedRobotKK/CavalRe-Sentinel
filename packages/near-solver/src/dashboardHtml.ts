/**
 * NEAR SOLVER DESK — single embedded HTML, zero build step.
 *
 * Security (X18): served only by statusServer on 127.0.0.1 GET-only.
 * Quant: amounts shown formatted; hover title keeps exact raw bigint string.
 * Product: calm by default; kill takes the screen; DRY-RUN vs LIVE unmissable.
 * Aesthetic: NEAR green on deep charcoal + phosphor decision wire (desk lineage).
 */

export const DASHBOARD_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CavalRe · Near Solver Desk</title>
<style>
  :root {
    --bg: #070b0a;
    --bg2: #0c1210;
    --panel: #0f1614;
    --panel2: #121c19;
    --border: #1c2a26;
    --border2: #243832;
    --text: #e6f2ee;
    --muted: #7a948a;
    --near: #00c08b;
    --near-dim: #0a3d2e;
    --near-glow: rgba(0, 192, 139, 0.35);
    --ok: #00c08b;
    --warn: #e6b84d;
    --danger: #ff5c6a;
    --accent: #6ec8ff;
    --mono: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
    --sans: "Segoe UI", system-ui, -apple-system, Inter, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; }
  html, body { min-height: 100%; }
  body {
    background:
      radial-gradient(1200px 600px at 10% -10%, #0a2a22 0%, transparent 55%),
      radial-gradient(900px 500px at 100% 0%, #0a1a22 0%, transparent 50%),
      var(--bg);
    color: var(--text);
    font: 14px/1.5 var(--sans);
  }
  .wrap { max-width: 980px; margin: 0 auto; padding: 20px 18px 72px; position: relative; }
  .num { font-family: var(--mono); font-variant-numeric: tabular-nums; }

  /* phosphor scan feel behind stream */
  .wire-bg {
    pointer-events: none; position: fixed; inset: 0; opacity: 0.07;
    background:
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0, 192, 139, 0.15) 3px
      );
    z-index: 0;
  }
  .wrap > * { position: relative; z-index: 1; }

  header {
    position: sticky; top: 0; z-index: 10;
    background: color-mix(in srgb, var(--bg) 86%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border);
    margin: 0 -18px 18px; padding: 14px 18px 12px;
  }
  .brand-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .logo {
    width: 28px; height: 28px; border-radius: 8px;
    background: linear-gradient(145deg, var(--near), #007a58);
    box-shadow: 0 0 20px var(--near-glow);
    display: grid; place-items: center;
    font: 700 11px var(--mono); color: #04140f;
  }
  h1 { font-size: 16px; font-weight: 650; letter-spacing: 0.2px; }
  h1 em { font-style: normal; color: var(--muted); font-weight: 450; }
  .pill {
    padding: 3px 11px; border-radius: 999px; font-size: 11px; font-weight: 700;
    letter-spacing: 0.5px; text-transform: uppercase;
  }
  .pill.dry { background: #2a2410; color: var(--warn); border: 1px solid #4a3c14; }
  .pill.live { background: var(--near-dim); color: var(--near); border: 1px solid #1a5c45; }
  .meta { margin-left: auto; color: var(--muted); font-size: 12px; display: flex; gap: 14px; align-items: center; }
  .canon {
    font-size: 10px; letter-spacing: 0.6px; text-transform: uppercase;
    color: var(--muted); border: 1px solid var(--border2); border-radius: 6px; padding: 2px 8px;
  }

  #kill {
    display: none; margin-bottom: 16px; padding: 14px 16px; border-radius: 12px;
    background: #2a1014; border: 1px solid var(--danger); color: var(--danger);
    font-weight: 650; box-shadow: 0 0 24px rgba(255, 92, 106, 0.15);
  }
  #kill.on { display: block; }

  .grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px; margin-bottom: 18px;
  }
  .card {
    background: linear-gradient(180deg, var(--panel2), var(--panel));
    border: 1px solid var(--border); border-radius: 14px; padding: 13px 14px;
  }
  .card h2 {
    font-size: 11px; font-weight: 650; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.85px; margin-bottom: 10px;
  }
  .kv { display: flex; justify-content: space-between; gap: 10px; padding: 3px 0; font-size: 13px; }
  .kv .k { color: var(--muted); }
  .health-ok { color: var(--ok); }
  .health-warn { color: var(--warn); }

  .stream-panel {
    border: 1px solid var(--border); border-radius: 14px; overflow: hidden;
    background: #050908;
    box-shadow: inset 0 0 40px rgba(0, 192, 139, 0.04);
  }
  .stream-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px; border-bottom: 1px solid var(--border);
    background: var(--bg2);
  }
  .stream-head h2 {
    font-size: 11px; font-weight: 650; color: var(--near);
    text-transform: uppercase; letter-spacing: 0.9px;
  }
  .stream-head .hint { font-size: 11px; color: var(--muted); }
  #stream {
    padding: 8px 10px 12px; min-height: 220px; max-height: 420px; overflow: auto;
    font-family: var(--mono); font-size: 12.5px;
  }
  .entry {
    display: flex; align-items: baseline; gap: 10px; padding: 7px 8px;
    border-radius: 8px; margin-bottom: 4px;
    border-left: 2px solid transparent;
  }
  .entry:hover { background: rgba(0, 192, 139, 0.05); }
  .entry.quote { border-left-color: var(--near); }
  .entry.reject { border-left-color: var(--warn); }
  .entry.hard { border-left-color: var(--danger); background: rgba(255, 92, 106, 0.06); }
  .entry .t { color: #4d6b60; min-width: 58px; }
  .entry .pair { color: var(--text); font-weight: 600; }
  .entry .detail { color: var(--muted); flex: 1; }
  .chip {
    margin-left: auto; padding: 1px 8px; border-radius: 999px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.3px; white-space: nowrap;
  }
  .chip.quote { background: var(--near-dim); color: var(--near); }
  .chip.reject { background: #2a2410; color: var(--warn); }
  .chip.hard { background: #3a1518; color: var(--danger); }
  .chip.info { background: #122030; color: var(--accent); }
  .empty {
    color: #3d5a50; text-align: center; padding: 48px 12px;
    font-family: var(--mono); font-size: 12px;
  }
  .amount[title] { cursor: help; border-bottom: 1px dotted #3d5a50; }
  footer {
    margin-top: 16px; color: var(--muted); font-size: 11px;
    display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap;
  }
  footer code { color: #9bb5aa; }
</style>
</head>
<body>
<div class="wire-bg" aria-hidden="true"></div>
<div class="wrap">
  <header>
    <div class="brand-row">
      <div class="logo">N</div>
      <h1>CavalRe <em>· Near Solver Desk</em></h1>
      <span id="mode" class="pill dry">…</span>
      <span class="canon" title="docs/CANON.md">CANON · VIEW</span>
      <div class="meta">
        <span id="uptime" class="num"></span>
        <span id="clock" class="num"></span>
      </div>
    </div>
  </header>

  <div id="kill"></div>

  <div class="grid">
    <div class="card"><h2>Solver bus</h2><div id="bus"></div></div>
    <div class="card"><h2>Inventory</h2><div id="inv"></div></div>
    <div class="card"><h2>Decisions</h2><div id="counters"></div></div>
  </div>

  <div class="stream-panel">
    <div class="stream-head">
      <h2>Phosphor · decision wire</h2>
      <span class="hint">read-only · localhost · poll 2s</span>
    </div>
    <div id="stream"><div class="empty">awaiting quote traffic on the bus…</div></div>
  </div>

  <footer>
    <span>GET-only · <code>127.0.0.1</code> · no mutations · no keys</span>
    <span>NEAR Intents · fail-closed · never trust / always verify</span>
  </footer>
</div>

<script>
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function fmtAmount(raw, decimals) {
  const v = BigInt(raw), d = BigInt(decimals);
  const scale = 10n ** d;
  const whole = v / scale;
  const frac = d >= 2n ? ((v % scale) * 100n) / scale : 0n;
  return whole.toLocaleString() + '.' + frac.toString().padStart(2, '0');
}
function shortAsset(id) {
  const name = id.replace(/^nep\\d+:/, '');
  return name.length > 14 ? name.slice(0, 6) + '…' + name.slice(-4) : name;
}
function fmtUptime(ms) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm ' + (s % 60) + 's';
}
function chipClass(reason) {
  if (reason === 'quoted' || reason === 'would_quote_dry_run' || reason === 'quoted_live') return 'quote';
  if (reason.startsWith('kill_switch') || reason === 'daily_loss_exceeded') return 'hard';
  if (reason === 'fill') return 'info';
  return 'reject';
}
function entryClass(reason) {
  const c = chipClass(reason);
  return c === 'quote' || c === 'info' ? 'quote' : c === 'hard' ? 'hard' : 'reject';
}

async function tick() {
  try {
    const [status, journal] = await Promise.all([
      fetch('/api/status').then((r) => r.json()),
      fetch('/api/journal/recent').then((r) => r.json()),
    ]);
    render(status, journal);
  } catch { /* keep last paint */ }
  $('clock').textContent = new Date().toISOString().slice(11, 19) + 'Z';
}

function render(s, journal) {
  const mode = $('mode');
  mode.textContent = s.mode === 'dry-run' ? 'DRY-RUN' : 'LIVE';
  mode.className = 'pill ' + (s.mode === 'dry-run' ? 'dry' : 'live');
  $('uptime').textContent = 'up ' + fmtUptime(s.uptimeMs);

  const kill = $('kill');
  if (s.killSwitch) {
    kill.className = 'on';
    kill.textContent = 'KILL SWITCH — ' + s.killSwitch + ' · quoting halted · see runbook';
  } else kill.className = '';

  const r = s.relay || { framesReceived: 0, reconnects: 0, malformedFrames: 0 };
  const health = r.framesReceived > 0
    ? '<span class="health-ok">receiving</span>'
    : r.reconnects > 0
      ? '<span class="health-warn">connection failing</span>'
      : '<span class="health-warn">no frames (partner key?)</span>';
  $('bus').innerHTML =
    kv('frames', r.framesReceived) + kv('reconnects', r.reconnects) +
    kv('malformed', r.malformedFrames) + kv('health', health);

  $('inv').innerHTML = (s.inventory || []).map((l) =>
    kv(esc(l.symbol), '<span class="amount num" title="raw: ' + esc(l.availableRaw) + '">' +
      fmtAmount(l.availableRaw, l.decimals) + '</span>')
  ).join('') + kv('reserved', s.activeReservations);

  const entries = Object.entries(s.counters || {}).sort();
  $('counters').innerHTML = entries.length
    ? entries.map(([k, v]) => kv(esc(k.replace('quote_decision:', '')), '<span class="num">' + v + '</span>')).join('')
    : '<div class="kv"><span class="k">none yet</span></div>';

  const rows = (journal || []).slice(-50).reverse().map((e) => {
    if (e.type === 'quote_decision') {
      const d = e.decision, ev = e.event;
      const pair = shortAsset(ev.assetIn) + ' → ' + shortAsset(ev.assetOut);
      const reason = d.shouldQuote ? (s.mode === 'dry-run' ? 'would_quote_dry_run' : 'quoted_live') : d.reason;
      const detail = d.shouldQuote ? ('spread ' + d.totalSpreadBps + ' bps') : '';
      return row(e.tMs, pair, detail, reason);
    }
    if (e.type === 'inferred_fill') return row(e.tMs, 'fill settled', e.quoteId, 'fill');
    if (e.type === 'reconcile') return row(e.tMs, 'reconcile', e.status, e.status === 'ok' ? 'quoted_live' : 'kill_switch');
    return '';
  }).join('');
  $('stream').innerHTML = rows || '<div class="empty">awaiting quote traffic on the bus…</div>';
}

const kv = (k, v) => '<div class="kv"><span class="k">' + k + '</span><span>' + v + '</span></div>';
const row = (tMs, pair, detail, reason) =>
  '<div class="entry ' + entryClass(reason) + '">' +
  '<span class="t num">' + new Date(tMs).toISOString().slice(11, 19) + '</span>' +
  '<span class="pair">' + esc(pair) + '</span>' +
  '<span class="detail num">' + esc(detail) + '</span>' +
  '<span class="chip ' + chipClass(reason) + '">' + esc(reason) + '</span></div>';

tick();
setInterval(tick, 2000);
</script>
</body>
</html>`;
