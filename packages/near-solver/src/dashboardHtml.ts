/**
 * THE DASHBOARD — single embedded file, zero build step (X16 lesson).
 *
 * Design system (panel-reviewed principles):
 *  - Calm by default: deep neutral surface, ONE accent, color reserved for
 *    meaning (green=flow, amber=caution, red=stop). A quiet screen means a
 *    healthy system; alarm states take the screen over.
 *  - Numbers are the interface: tabular monospace, exact raw value on hover
 *    (quant rule — formatting is presentation, truth is exact).
 *  - Composer-like feel: one focused decision stream under a sticky summary,
 *    generous spacing, no chrome for chrome's sake.
 */

export const DASHBOARD_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CavalRe Sentinel</title>
<style>
  :root {
    --bg: #0e1014; --panel: #151920; --border: #232a35;
    --text: #e7eaf0; --muted: #8a93a5; --accent: #5b9dff;
    --ok: #35c98e; --warn: #f0b13c; --danger: #ff5c5c;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; margin: 0; }
  body { background: var(--bg); color: var(--text);
         font: 15px/1.5 -apple-system, "Segoe UI", Inter, sans-serif; }
  .wrap { max-width: 860px; margin: 0 auto; padding: 24px 20px 80px; }
  .num { font-family: var(--mono); font-variant-numeric: tabular-nums; }

  header { position: sticky; top: 0; background: color-mix(in srgb, var(--bg) 88%, transparent);
           backdrop-filter: blur(8px); border-bottom: 1px solid var(--border);
           padding: 14px 0 12px; margin-bottom: 20px; z-index: 5; }
  .row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  h1 { font-size: 17px; font-weight: 600; letter-spacing: .2px; }
  h1 span { color: var(--muted); font-weight: 400; }
  .pill { padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;
          letter-spacing: .4px; }
  .pill.dry { background: #3a2f14; color: var(--warn); }
  .pill.live { background: #123527; color: var(--ok); }
  .uptime { color: var(--muted); font-size: 13px; margin-left: auto; }

  #kill { display: none; background: #3a1518; border: 1px solid var(--danger);
          color: var(--danger); border-radius: 12px; padding: 14px 16px;
          font-weight: 600; margin-bottom: 20px; }
  #kill.on { display: block; }

  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 14px; margin-bottom: 26px; }
  .card { background: var(--panel); border: 1px solid var(--border);
          border-radius: 14px; padding: 14px 16px; }
  .card h2 { font-size: 12px; font-weight: 600; color: var(--muted);
             text-transform: uppercase; letter-spacing: .8px; margin-bottom: 10px; }
  .kv { display: flex; justify-content: space-between; padding: 3px 0; font-size: 14px; }
  .kv .k { color: var(--muted); }
  .health-ok { color: var(--ok); } .health-warn { color: var(--warn); }

  .stream h2 { font-size: 12px; font-weight: 600; color: var(--muted);
               text-transform: uppercase; letter-spacing: .8px; margin-bottom: 12px; }
  .entry { background: var(--panel); border: 1px solid var(--border);
           border-radius: 12px; padding: 10px 14px; margin-bottom: 8px;
           display: flex; align-items: baseline; gap: 10px; font-size: 14px; }
  .entry .t { color: var(--muted); font-size: 12px; min-width: 62px; }
  .entry .pair { font-weight: 600; }
  .chip { padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 600;
          margin-left: auto; white-space: nowrap; }
  .chip.quote { background: #123527; color: var(--ok); }
  .chip.reject { background: #2a2417; color: var(--warn); }
  .chip.hard { background: #3a1518; color: var(--danger); }
  .chip.info { background: #1a2233; color: var(--accent); }
  .empty { color: var(--muted); text-align: center; padding: 28px 0; font-size: 14px; }
  .amount[title] { cursor: help; border-bottom: 1px dotted var(--muted); }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="row">
      <h1>CavalRe Sentinel <span>· NEAR Intents solver</span></h1>
      <span id="mode" class="pill dry">…</span>
      <span id="uptime" class="uptime num"></span>
    </div>
  </header>

  <div id="kill"></div>

  <div class="grid">
    <div class="card"><h2>Solver bus</h2><div id="bus"></div></div>
    <div class="card"><h2>Inventory</h2><div id="inv"></div></div>
    <div class="card"><h2>Decisions</h2><div id="counters"></div></div>
  </div>

  <div class="stream">
    <h2>Decision stream</h2>
    <div id="stream"><div class="empty">Waiting for quote traffic…</div></div>
  </div>
</div>

<script>
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function fmtAmount(raw, decimals) {
  // exact bigint math for display; full raw value goes in the hover title
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

async function tick() {
  try {
    const [status, journal] = await Promise.all([
      fetch('/api/status').then((r) => r.json()),
      fetch('/api/journal/recent').then((r) => r.json()),
    ]);
    render(status, journal);
  } catch { /* server restarting; keep last paint */ }
}

function render(s, journal) {
  const mode = $('mode');
  mode.textContent = s.mode === 'dry-run' ? 'DRY-RUN' : 'LIVE';
  mode.className = 'pill ' + (s.mode === 'dry-run' ? 'dry' : 'live');
  $('uptime').textContent = fmtUptime(s.uptimeMs);

  const kill = $('kill');
  if (s.killSwitch) { kill.className = 'on'; kill.textContent = '⛔ KILL SWITCH — ' + s.killSwitch + ' · quoting halted, see runbook'; }
  else kill.className = '';

  const r = s.relay || { framesReceived: 0, reconnects: 0, malformedFrames: 0 };
  const health = r.framesReceived > 0
    ? '<span class="health-ok">receiving</span>'
    : r.reconnects > 0
      ? '<span class="health-warn">connection failing</span>'
      : '<span class="health-warn">connected · no frames (API key?)</span>';
  $('bus').innerHTML =
    kv('frames', r.framesReceived) + kv('reconnects', r.reconnects) +
    kv('malformed', r.malformedFrames) + kv('health', health);

  $('inv').innerHTML = s.inventory.map((l) =>
    kv(esc(l.symbol), '<span class="amount num" title="raw: ' + esc(l.availableRaw) + '">' +
      fmtAmount(l.availableRaw, l.decimals) + '</span>')
  ).join('') + kv('reserved', s.activeReservations);

  const entries = Object.entries(s.counters).sort();
  $('counters').innerHTML = entries.length
    ? entries.map(([k, v]) => kv(esc(k.replace('quote_decision:', '')), '<span class="num">' + v + '</span>')).join('')
    : '<div class="kv"><span class="k">none yet</span></div>';

  const rows = journal.slice(-40).reverse().map((e) => {
    if (e.type === 'quote_decision') {
      const d = e.decision, ev = e.event;
      const pair = shortAsset(ev.assetIn) + ' → ' + shortAsset(ev.assetOut);
      const reason = d.shouldQuote ? (s.mode === 'dry-run' ? 'would_quote_dry_run' : 'quoted_live') : d.reason;
      const detail = d.shouldQuote ? ('spread ' + d.totalSpreadBps + ' bps') : '';
      return row(e.tMs, pair, detail, reason);
    }
    if (e.type === 'inferred_fill') return row(e.tMs, 'fill settled', e.quoteId, 'fill');
    if (e.type === 'reconcile') return row(e.tMs, 'reconcile', e.status, e.status === 'ok' ? 'quote' : 'kill_switch');
    return '';
  }).join('');
  $('stream').innerHTML = rows || '<div class="empty">Waiting for quote traffic…</div>';
}

const kv = (k, v) => '<div class="kv"><span class="k">' + k + '</span><span>' + v + '</span></div>';
const row = (tMs, pair, detail, reason) =>
  '<div class="entry"><span class="t num">' + new Date(tMs).toISOString().slice(11, 19) + '</span>' +
  '<span class="pair">' + esc(pair) + '</span><span class="num" style="color:var(--muted)">' + esc(detail) + '</span>' +
  '<span class="chip ' + chipClass(reason) + '">' + esc(reason) + '</span></div>';

tick();
setInterval(tick, 2000);
</script>
</body>
</html>`;
