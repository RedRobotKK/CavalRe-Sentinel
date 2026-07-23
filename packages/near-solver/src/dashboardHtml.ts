/**
 * INTENT HUD — suit-grade data surface for NEAR Intents solver.
 * Single file, zero build. Served localhost GET-only (X18).
 *
 * Design brief: if an intent network had a cockpit, it would read like a
 * flight suit HUD — reticles, arcs, resource bars, threat/clear chips —
 * not a generic admin table and not a copy of the Base amber pipeline.
 */

export const DASHBOARD_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>INTENT HUD · CavalRe</title>
<style>
  :root {
    --void: #03060a;
    --hud: #061018;
    --panel: rgba(8, 22, 28, 0.82);
    --line: rgba(0, 220, 180, 0.28);
    --line-bright: rgba(0, 255, 200, 0.55);
    --cyan: #00f0c8;
    --cyan-dim: #0a4a40;
    --ice: #7ef0ff;
    --warn: #ffc14a;
    --danger: #ff4d6a;
    --text: #d8f6f0;
    --muted: #5a8a82;
    --mono: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
    --sans: system-ui, "Segoe UI", Inter, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; }
  html, body { height: 100%; }
  body {
    background: var(--void);
    color: var(--text);
    font: 13px/1.45 var(--sans);
    overflow-x: hidden;
  }

  /* suit backdrop: radial HUD + grid */
  .stage {
    min-height: 100vh;
    position: relative;
    background:
      radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0, 80, 70, 0.25), transparent 60%),
      radial-gradient(circle at 50% 120%, rgba(0, 40, 60, 0.35), transparent 50%),
      var(--void);
  }
  .stage::before {
    content: "";
    position: absolute; inset: 0; pointer-events: none; opacity: 0.12;
    background-image:
      linear-gradient(rgba(0, 240, 200, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 240, 200, 0.06) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse at center, black 20%, transparent 75%);
  }
  .reticle {
    position: absolute; left: 50%; top: 42%; width: min(72vw, 520px); height: min(72vw, 520px);
    transform: translate(-50%, -50%); pointer-events: none; opacity: 0.18;
  }
  .reticle svg { width: 100%; height: 100%; }

  .shell {
    position: relative; z-index: 2;
    max-width: 1100px; margin: 0 auto; padding: 16px 16px 40px;
  }

  /* top beam */
  .beam {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    padding: 10px 14px;
    border: 1px solid var(--line);
    background: linear-gradient(90deg, rgba(0, 40, 36, 0.9), rgba(6, 16, 24, 0.95));
    clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px));
    margin-bottom: 14px;
  }
  .sigil {
    width: 32px; height: 32px; border-radius: 4px;
    border: 1px solid var(--cyan);
    box-shadow: 0 0 16px rgba(0, 240, 200, 0.35), inset 0 0 12px rgba(0, 240, 200, 0.15);
    display: grid; place-items: center;
    font: 700 10px var(--mono); color: var(--cyan); letter-spacing: 0.5px;
  }
  .title { font: 650 14px var(--mono); letter-spacing: 1.2px; text-transform: uppercase; }
  .title span { color: var(--muted); font-weight: 500; letter-spacing: 0.8px; }
  .tag {
    font: 700 10px var(--mono); letter-spacing: 1px; text-transform: uppercase;
    padding: 3px 10px; border: 1px solid;
  }
  .tag.dry { color: var(--warn); border-color: rgba(255, 193, 74, 0.45); background: rgba(60, 40, 0, 0.4); }
  .tag.live { color: var(--cyan); border-color: var(--line-bright); background: rgba(0, 60, 50, 0.5); }
  .tag.canon { color: var(--ice); border-color: rgba(126, 240, 255, 0.3); opacity: 0.85; }
  .beam-right { margin-left: auto; display: flex; gap: 14px; align-items: center; font: 12px var(--mono); color: var(--muted); }
  .beam-right strong { color: var(--cyan); font-weight: 600; }

  #kill {
    display: none; margin-bottom: 12px; padding: 12px 16px;
    border: 1px solid var(--danger); background: rgba(60, 8, 18, 0.85);
    color: var(--danger); font: 650 13px var(--mono); letter-spacing: 0.6px;
    box-shadow: 0 0 30px rgba(255, 77, 106, 0.2);
  }
  #kill.on { display: block; }

  /* arc row: three hexagonal-ish panels */
  .arc {
    display: grid; grid-template-columns: 1.1fr 1fr 1fr; gap: 12px; margin-bottom: 14px;
  }
  @media (max-width: 840px) { .arc { grid-template-columns: 1fr; } }
  .pod {
    background: var(--panel);
    border: 1px solid var(--line);
    padding: 12px 14px 14px;
    position: relative;
    backdrop-filter: blur(6px);
  }
  .pod::before {
    content: ""; position: absolute; top: 0; left: 12px; right: 12px; height: 1px;
    background: linear-gradient(90deg, transparent, var(--cyan), transparent);
    opacity: 0.7;
  }
  .pod h2 {
    font: 650 10px var(--mono); letter-spacing: 1.4px; text-transform: uppercase;
    color: var(--cyan); margin-bottom: 10px; opacity: 0.9;
  }
  .metric {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 4px 0; border-bottom: 1px solid rgba(0, 80, 70, 0.35);
    font-size: 12.5px;
  }
  .metric:last-child { border-bottom: 0; }
  .metric .k { color: var(--muted); font-family: var(--mono); font-size: 11px; letter-spacing: 0.3px; }
  .metric .v { font-family: var(--mono); font-variant-numeric: tabular-nums; color: var(--text); }
  .metric .v.warn { color: var(--warn); }
  .metric .v.ok { color: var(--cyan); }
  .metric .v.bad { color: var(--danger); }

  /* resource bars for inventory */
  .bar-wrap { margin-top: 4px; }
  .bar-row { margin-bottom: 8px; }
  .bar-lab { display: flex; justify-content: space-between; font: 11px var(--mono); color: var(--muted); margin-bottom: 3px; }
  .bar-lab strong { color: var(--text); }
  .bar {
    height: 4px; background: rgba(0, 40, 36, 0.8); border: 1px solid var(--line);
    position: relative; overflow: hidden;
  }
  .bar > i {
    display: block; height: 100%;
    background: linear-gradient(90deg, var(--cyan-dim), var(--cyan));
    box-shadow: 0 0 8px rgba(0, 240, 200, 0.5);
  }

  /* center ring status */
  .core {
    display: grid; grid-template-columns: 200px 1fr; gap: 12px; margin-bottom: 14px;
  }
  @media (max-width: 840px) { .core { grid-template-columns: 1fr; } }
  .ring-pod {
    background: var(--panel); border: 1px solid var(--line);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 16px; min-height: 180px; position: relative;
  }
  .ring {
    width: 120px; height: 120px; position: relative;
  }
  .ring svg { transform: rotate(-90deg); }
  .ring-center {
    position: absolute; inset: 0; display: grid; place-items: center; text-align: center;
    font-family: var(--mono);
  }
  .ring-center .big { font-size: 22px; font-weight: 700; color: var(--cyan); line-height: 1; }
  .ring-center .sub { font-size: 9px; letter-spacing: 1px; color: var(--muted); text-transform: uppercase; margin-top: 4px; }
  .ring-caption { margin-top: 10px; font: 10px var(--mono); color: var(--muted); letter-spacing: 1px; text-transform: uppercase; }

  .flow-pod {
    background: var(--panel); border: 1px solid var(--line); padding: 12px 14px;
  }
  .flow-pod h2 {
    font: 650 10px var(--mono); letter-spacing: 1.4px; text-transform: uppercase;
    color: var(--cyan); margin-bottom: 12px;
  }
  .flow {
    display: flex; align-items: center; justify-content: space-between; gap: 4px; flex-wrap: wrap;
  }
  .node {
    flex: 1; min-width: 64px; text-align: center; padding: 10px 6px;
    border: 1px solid rgba(0, 220, 180, 0.2); background: rgba(0, 30, 28, 0.5);
    font-family: var(--mono);
  }
  .node .n { font-size: 9px; letter-spacing: 1px; color: var(--muted); text-transform: uppercase; }
  .node .c { font-size: 16px; font-weight: 700; color: var(--ice); margin-top: 4px; }
  .node.active { border-color: var(--cyan); box-shadow: 0 0 12px rgba(0, 240, 200, 0.2); }
  .node.hot .c { color: var(--cyan); }
  .arrow { color: var(--line-bright); font-size: 14px; opacity: 0.6; }

  /* decision tape */
  .tape {
    border: 1px solid var(--line); background: rgba(2, 10, 12, 0.9);
    min-height: 240px;
  }
  .tape-head {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 12px; border-bottom: 1px solid var(--line);
    background: rgba(0, 30, 28, 0.5);
  }
  .tape-head h2 {
    font: 650 10px var(--mono); letter-spacing: 1.6px; text-transform: uppercase; color: var(--cyan);
  }
  .tape-head .hint { font: 10px var(--mono); color: var(--muted); }
  #stream {
    padding: 6px 8px 12px; max-height: 320px; overflow: auto;
    font-family: var(--mono); font-size: 12px;
  }
  .entry {
    display: grid; grid-template-columns: 54px 1fr auto auto;
    gap: 10px; align-items: baseline;
    padding: 6px 8px; margin-bottom: 2px;
    border-left: 2px solid transparent;
  }
  .entry:hover { background: rgba(0, 240, 200, 0.04); }
  .entry.q { border-left-color: var(--cyan); }
  .entry.r { border-left-color: var(--warn); }
  .entry.h { border-left-color: var(--danger); background: rgba(255, 77, 106, 0.05); }
  .entry .t { color: var(--muted); }
  .entry .pair { color: var(--text); font-weight: 600; }
  .entry .det { color: var(--muted); }
  .chip {
    font-size: 9px; font-weight: 700; letter-spacing: 0.4px; padding: 2px 7px;
    text-transform: uppercase;
  }
  .chip.q { color: var(--cyan); border: 1px solid var(--line-bright); background: rgba(0, 60, 50, 0.4); }
  .chip.r { color: var(--warn); border: 1px solid rgba(255, 193, 74, 0.4); }
  .chip.h { color: var(--danger); border: 1px solid rgba(255, 77, 106, 0.5); }
  .chip.i { color: var(--ice); border: 1px solid rgba(126, 240, 255, 0.35); }
  .empty {
    text-align: center; padding: 56px 16px; color: var(--muted);
    font: 12px var(--mono); letter-spacing: 0.5px;
  }
  .empty .pulse {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    background: var(--cyan); margin-right: 8px; vertical-align: middle;
    box-shadow: 0 0 10px var(--cyan); animation: pulse 1.6s ease-in-out infinite;
  }
  @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }

  footer {
    margin-top: 12px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;
    font: 10px var(--mono); color: var(--muted); letter-spacing: 0.4px;
  }
  .amount[title] { cursor: help; border-bottom: 1px dotted var(--muted); }
</style>
</head>
<body>
<div class="stage">
  <div class="reticle" aria-hidden="true">
    <svg viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="100" r="92" stroke="#00f0c8" stroke-width="0.4" opacity="0.5"/>
      <circle cx="100" cy="100" r="70" stroke="#00f0c8" stroke-width="0.3" stroke-dasharray="4 6" opacity="0.4"/>
      <circle cx="100" cy="100" r="48" stroke="#7ef0ff" stroke-width="0.3" opacity="0.3"/>
      <path d="M100 8 L100 28 M100 172 L100 192 M8 100 L28 100 M172 100 L192 100" stroke="#00f0c8" stroke-width="0.6" opacity="0.5"/>
      <path d="M35 35 L50 50 M165 35 L150 50 M35 165 L50 150 M165 165 L150 150" stroke="#7ef0ff" stroke-width="0.5" opacity="0.4"/>
    </svg>
  </div>

  <div class="shell">
    <div class="beam">
      <div class="sigil">IH</div>
      <div class="title">Intent HUD <span>· Near Solver</span></div>
      <span id="mode" class="tag dry">…</span>
      <span class="tag canon">CANON · VIEW</span>
      <div class="beam-right">
        <span>UP <strong id="uptime">—</strong></span>
        <span id="clock">—</span>
      </div>
    </div>

    <div id="kill"></div>

    <div class="arc">
      <div class="pod">
        <h2>Bus link</h2>
        <div id="bus"></div>
      </div>
      <div class="pod">
        <h2>Inventory power</h2>
        <div id="inv" class="bar-wrap"></div>
      </div>
      <div class="pod">
        <h2>Decision mass</h2>
        <div id="counters"></div>
      </div>
    </div>

    <div class="core">
      <div class="ring-pod">
        <div class="ring">
          <svg id="ringSvg" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(0,80,70,0.6)" stroke-width="2"/>
            <circle id="ringArc" cx="18" cy="18" r="15.5" fill="none" stroke="#00f0c8" stroke-width="2.2"
              stroke-linecap="round" stroke-dasharray="0 100" pathLength="100"
              style="filter: drop-shadow(0 0 3px #00f0c8)"/>
          </svg>
          <div class="ring-center">
            <div class="big" id="ringBig">0</div>
            <div class="sub">frames</div>
          </div>
        </div>
        <div class="ring-caption" id="ringCap">bus silent</div>
      </div>
      <div class="flow-pod">
        <h2>Intent path · fail-closed</h2>
        <div class="flow" id="flow">
          <div class="node" data-k="bus"><div class="n">Bus</div><div class="c" id="nBus">0</div></div>
          <span class="arrow">›</span>
          <div class="node" data-k="see"><div class="n">See</div><div class="c" id="nSee">0</div></div>
          <span class="arrow">›</span>
          <div class="node" data-k="price"><div class="n">Mark</div><div class="c" id="nPrice">—</div></div>
          <span class="arrow">›</span>
          <div class="node" data-k="decide"><div class="n">Decide</div><div class="c" id="nDecide">0</div></div>
          <span class="arrow">›</span>
          <div class="node" data-k="risk"><div class="n">Risk</div><div class="c" id="nRisk">0</div></div>
          <span class="arrow">›</span>
          <div class="node hot" data-k="quote"><div class="n">Quote</div><div class="c" id="nQuote">0</div></div>
        </div>
      </div>
    </div>

    <div class="tape">
      <div class="tape-head">
        <h2>Live tape · intent signals</h2>
        <span class="hint">localhost · GET · 2s scan</span>
      </div>
      <div id="stream"><div class="empty"><span class="pulse"></span>scanning for intent traffic…</div></div>
    </div>

    <footer>
      <span>127.0.0.1 · read-only · no keys · no mutations</span>
      <span>NEAR INTENTS · FLOATLIB · LEDGER · FAIL-CLOSED</span>
    </footer>
  </div>
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
function sumCounters(c, pred) {
  let n = 0;
  for (const [k, v] of Object.entries(c || {})) if (pred(k)) n += v;
  return n;
}

async function tick() {
  try {
    const [status, journal] = await Promise.all([
      fetch('/api/status').then((r) => r.json()),
      fetch('/api/journal/recent').then((r) => r.json()),
    ]);
    render(status, journal);
  } catch { /* keep last frame */ }
  $('clock').textContent = new Date().toISOString().slice(11, 19) + 'Z';
}

function render(s, journal) {
  const mode = $('mode');
  const dry = s.mode === 'dry-run';
  mode.textContent = dry ? 'DRY-RUN' : 'LIVE';
  mode.className = 'tag ' + (dry ? 'dry' : 'live');
  $('uptime').textContent = fmtUptime(s.uptimeMs);

  const kill = $('kill');
  if (s.killSwitch) {
    kill.className = 'on';
    kill.textContent = '◈ KILL — ' + s.killSwitch + ' — QUOTING HALTED';
  } else kill.className = '';

  const r = s.relay || { framesReceived: 0, reconnects: 0, malformedFrames: 0 };
  const frames = r.framesReceived || 0;
  let healthCls = 'warn', healthTxt = 'no frames · partner key?';
  if (frames > 0) { healthCls = 'ok'; healthTxt = 'link up'; }
  else if (r.reconnects > 0) { healthCls = 'bad'; healthTxt = 'reconnect storm'; }

  $('bus').innerHTML =
    m('frames', frames) +
    m('reconnects', r.reconnects) +
    m('malformed', r.malformedFrames) +
    m('health', '<span class="v ' + healthCls + '">' + healthTxt + '</span>', true);

  // inventory as power bars (relative to max in set)
  const inv = s.inventory || [];
  let maxN = 1;
  const parsed = inv.map((l) => {
    const n = Number(fmtAmount(l.availableRaw, l.decimals).replace(/,/g, ''));
    if (n > maxN) maxN = n;
    return { ...l, n };
  });
  $('inv').innerHTML = parsed.map((l) => {
    const pct = Math.min(100, Math.round((l.n / maxN) * 100));
    return '<div class="bar-row"><div class="bar-lab"><span>' + esc(l.symbol) + '</span><strong class="amount" title="raw: ' +
      esc(l.availableRaw) + '">' + fmtAmount(l.availableRaw, l.decimals) + '</strong></div>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div></div>';
  }).join('') + m('reserved', s.activeReservations);

  const c = s.counters || {};
  const would = sumCounters(c, (k) => /would_quote|quoted_live|quoted/.test(k));
  const rejects = sumCounters(c, (k) => k.startsWith('quote_decision:') && !/would_quote|quoted/.test(k));
  const totalDec = would + rejects;
  const entries = Object.entries(c).sort();
  $('counters').innerHTML = entries.length
    ? entries.map(([k, v]) => m(k.replace(/^quote_decision:/, ''), v)).join('')
    : m('awaiting', '—');

  // ring
  const ringPct = Math.min(100, frames > 0 ? 12 + Math.min(88, frames) : 0);
  $('ringArc').setAttribute('stroke-dasharray', ringPct + ' ' + (100 - ringPct));
  $('ringBig').textContent = frames > 999 ? (Math.round(frames / 100) / 10) + 'k' : String(frames);
  $('ringCap').textContent = frames > 0 ? 'bus receiving' : 'bus silent';

  $('nBus').textContent = frames;
  $('nSee').textContent = totalDec;
  $('nDecide').textContent = totalDec;
  $('nRisk').textContent = rejects;
  $('nQuote').textContent = would;
  document.querySelectorAll('.node').forEach((el) => el.classList.toggle('active', frames > 0));

  const rows = (journal || []).slice(-50).reverse().map((e) => {
    if (e.type === 'quote_decision') {
      const d = e.decision, ev = e.event;
      const pair = shortAsset(ev.assetIn) + ' → ' + shortAsset(ev.assetOut);
      const reason = d.shouldQuote ? (dry ? 'would_quote' : 'quoted') : d.reason;
      const detail = d.shouldQuote ? (d.totalSpreadBps + ' bps') : '';
      return row(e.tMs, pair, detail, reason, d.shouldQuote);
    }
    if (e.type === 'inferred_fill') return row(e.tMs, 'FILL', e.quoteId, 'fill', true);
    if (e.type === 'reconcile') return row(e.tMs, 'RECON', e.status, e.status === 'ok' ? 'ok' : 'kill', e.status === 'ok');
    return '';
  }).join('');
  $('stream').innerHTML = rows || '<div class="empty"><span class="pulse"></span>scanning for intent traffic…</div>';
}

function m(k, v, raw) {
  return '<div class="metric"><span class="k">' + k + '</span><span class="v">' +
    (raw ? v : esc(String(v))) + '</span></div>';
}
function row(tMs, pair, detail, reason, ok) {
  let kind = 'r', chip = 'r';
  if (ok || reason === 'fill' || reason === 'ok') { kind = 'q'; chip = reason === 'fill' || reason === 'ok' ? 'i' : 'q'; }
  if (/kill|daily_loss/.test(reason)) { kind = 'h'; chip = 'h'; }
  return '<div class="entry ' + kind + '">' +
    '<span class="t">' + new Date(tMs).toISOString().slice(11, 19) + '</span>' +
    '<span class="pair">' + esc(pair) + '</span>' +
    '<span class="det">' + esc(detail) + '</span>' +
    '<span class="chip ' + chip + '">' + esc(reason) + '</span></div>';
}

tick();
setInterval(tick, 2000);
</script>
</body>
</html>`;
