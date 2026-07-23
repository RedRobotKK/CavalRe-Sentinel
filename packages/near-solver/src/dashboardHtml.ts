/**
 * NEAR SOLVER DESK — readable ops surface.
 * Purpose: show dry-run / live state, decision mix, active quote, tape.
 * No decorative 3D. Exact inventory still on /api/status.
 */

export const DASHBOARD_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NEAR SOLVER DESK · CavalRe</title>
<style>
:root {
  --bg:#0a0e12; --panel:#111820; --line:#1e2a32; --border:#2a3a44;
  --text:#d8e4ea; --muted:#6a7d88; --cyan:#3dd6c6; --warn:#e6a817;
  --bad:#e85d6c; --ok:#3dd6c6; --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
}
*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--text);font:13px/1.45 system-ui,sans-serif;min-height:100vh}
header{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line);background:#0d1218}
h1{font:600 14px var(--mono);letter-spacing:.04em}
h1 span{color:var(--muted);font-weight:500}
.badge{font:700 10px var(--mono);padding:3px 8px;border:1px solid;border-radius:3px;text-transform:uppercase}
.badge.dry{color:var(--warn);border-color:#5a4a18;background:#1a1608}
.badge.live{color:var(--ok);border-color:#1a4a42;background:#0a1a18}
.badge.dim{color:var(--muted);border-color:var(--border)}
.right{margin-left:auto;font:12px var(--mono);color:var(--muted)}
.right b{color:var(--text);font-weight:600}
#kill{display:none;margin:12px 16px 0;padding:10px 12px;border:1px solid var(--bad);background:#1a0a0e;color:var(--bad);font:600 13px var(--mono)}
#kill.on{display:block}
main{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding:16px;max-width:1200px}
@media(max-width:900px){main{grid-template-columns:1fr}}
section{background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:12px 14px}
section h2{font:600 11px var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px}
.row{display:flex;justify-content:space-between;padding:4px 0;font:13px var(--mono);border-bottom:1px solid #161e26}
.row:last-child{border:0}
.row .k{color:var(--muted)}.row .v.warn{color:var(--warn)}.row .v.bad{color:var(--bad)}.row .v.ok{color:var(--ok)}
.wide{grid-column:1 / -1}
.intent{display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:center;margin:8px 0 12px}
.box{background:#0c1116;border:1px solid var(--border);padding:12px;border-radius:4px}
.box .label{font:10px var(--mono);color:var(--muted);text-transform:uppercase;margin-bottom:4px}
.box .sym{font:700 20px var(--mono)}.box .amt{font:13px var(--mono);color:var(--cyan);margin-top:4px}
.box .raw{font:11px var(--mono);color:var(--muted);margin-top:2px;word-break:break-all}
.arrow{font:20px var(--mono);color:var(--cyan)}
.meta{display:flex;flex-wrap:wrap;gap:16px;font:12px var(--mono);color:var(--muted);margin-bottom:10px}
.meta b{color:var(--text);font-weight:600}
.gates{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.gate{font:700 10px var(--mono);padding:2px 7px;border:1px solid var(--border);color:var(--muted);text-transform:uppercase;border-radius:2px}
.gate.pass{color:var(--ok);border-color:#1a4a42}.gate.fail{color:var(--bad);border-color:#5a2030}.gate.wait{color:var(--warn);border-color:#5a4a18}
.verdict{margin-left:auto;font:700 11px var(--mono);padding:4px 10px;border:1px solid;text-transform:uppercase;border-radius:2px}
.verdict.q{color:var(--ok);border-color:#1a4a42;background:#0a1a18}
.verdict.r{color:var(--warn);border-color:#5a4a18;background:#1a1608}
.verdict.h{color:var(--bad);border-color:#5a2030;background:#1a0a0e}
#stream{font:12px var(--mono);max-height:280px;overflow:auto}
.line{display:grid;grid-template-columns:64px 1fr auto auto;gap:10px;padding:5px 0;border-bottom:1px solid #161e26}
.line .t{color:var(--muted)}.line .chip{font:700 10px var(--mono);padding:2px 6px;border:1px solid;text-transform:uppercase;border-radius:2px}
.line .chip.q{color:var(--ok);border-color:#1a4a42}.line .chip.r{color:var(--warn);border-color:#5a4a18}.line .chip.h{color:var(--bad);border-color:#5a2030}
footer{padding:8px 16px;font:11px var(--mono);color:var(--muted);border-top:1px solid var(--line)}
.empty{color:var(--muted);padding:20px;text-align:center}
</style>
</head>
<body>
<header>
  <h1>NEAR SOLVER DESK <span>· CavalRe</span></h1>
  <span id="mode" class="badge dry">…</span>
  <span class="badge dim">view only</span>
  <div class="right">uptime <b id="uptime">—</b> · <span id="clock">—</span></div>
</header>
<div id="kill"></div>
<main>
  <section>
    <h2>What this is</h2>
    <p style="color:var(--muted);font-size:12px;line-height:1.5;margin-bottom:10px">
      Local dry-run of the NEAR Intents solver. It decides whether it <b style="color:var(--text)">would quote</b>
      on each request. Nothing is signed or sent unless you leave dry-run (not enabled here).
    </p>
    <h2>Bus (message relay)</h2>
    <div id="bus"></div>
  </section>
  <section>
    <h2>Inventory (virtual dry-run)</h2>
    <div id="inv"></div>
  </section>
  <section>
    <h2>Decisions so far</h2>
    <div id="counters"></div>
  </section>
  <section class="wide">
    <h2>Latest quote request · <span id="intentHint" style="color:var(--muted);font-weight:500">—</span></h2>
    <div id="intentCard"></div>
  </section>
  <section class="wide">
    <h2>Decision tape (newest first)</h2>
    <div id="stream"></div>
  </section>
</main>
<footer>127.0.0.1 only · GET /api/status · GET /metrics · no keys on this page</footer>
<script>
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function fmtAmount(raw, decimals) {
  const v = BigInt(raw), d = BigInt(decimals), scale = 10n ** d;
  const whole = v / scale, frac = d >= 2n ? ((v % scale) * 100n) / scale : 0n;
  return whole.toLocaleString() + '.' + frac.toString().padStart(2, '0');
}
function shortAsset(id) {
  const name = String(id).replace(/^nep\\d+:/, '');
  return name.length > 20 ? name.slice(0, 10) + '…' + name.slice(-4) : name;
}
function symOf(id) {
  if (/wrap\\.near/i.test(id)) return 'wNEAR';
  if (/usdt/i.test(id)) return 'USDT';
  if (/usdc|17208628/i.test(id)) return 'USDC';
  return shortAsset(id);
}
function fmtUptime(ms) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm ' + (s % 60) + 's';
}
function row(k, v, cls) {
  return '<div class="row"><span class="k">' + esc(k) + '</span><span class="v ' + (cls || '') + '">' + esc(String(v)) + '</span></div>';
}

function renderIntent(o) {
  const gates = o.gates || {};
  const gh = ['listed','priced','inv','risk'].map(k => {
    const st = gates[k] || 'wait';
    return '<span class="gate ' + st + '">' + k + '</span>';
  }).join('');
  let verdict = o.verdict, vc = 'r';
  if (!verdict && o.sample) verdict = 'waiting for data';
  else if (o.ok) { verdict = o.verdict || 'WOULD QUOTE'; vc = 'q'; }
  else if (verdict && /kill|daily_loss/.test(verdict)) vc = 'h';
  return '<div class="intent">' +
    '<div class="box"><div class="label">You pay (asset in)</div><div class="sym">' + esc(o.symIn) + '</div>' +
    '<div class="amt">' + esc(o.amtInHuman) + '</div><div class="raw">' + esc(shortAsset(o.assetIn)) + '</div></div>' +
    '<div class="arrow">→</div>' +
    '<div class="box"><div class="label">You receive (asset out)</div><div class="sym">' + esc(o.symOut) + '</div>' +
    '<div class="amt">' + esc(o.amtOutHuman) + '</div><div class="raw">' + esc(shortAsset(o.assetOut)) + '</div></div></div>' +
    '<div class="meta"><span>side <b>' + esc(o.side) + '</b></span>' +
    '<span>deadline ≥ <b>' + (o.minDeadlineMs/1000) + 's</b></span>' +
    '<span>spread <b>' + esc(o.spread || '—') + '</b></span></div>' +
    '<div class="gates">' + gh + '<span class="verdict ' + vc + '">' + esc(verdict || '—') + '</span></div>';
}

function fromJournal(e, dry) {
  if (!e || e.type !== 'quote_decision') return null;
  const d = e.decision, ev = e.event;
  const ok = !!d.shouldQuote;
  const side = ev.exactAmountIn != null ? 'EXACT_IN' : 'EXACT_OUT';
  return {
    quoteId: ev.quoteId || d.quoteId,
    assetIn: ev.assetIn, assetOut: ev.assetOut,
    exactAmountIn: ev.exactAmountIn != null ? String(ev.exactAmountIn) : null,
    exactAmountOut: ev.exactAmountOut != null ? String(ev.exactAmountOut) : null,
    minDeadlineMs: ev.minDeadlineMs || 60000, side,
    symIn: symOf(ev.assetIn), symOut: symOf(ev.assetOut),
    amtInHuman: side === 'EXACT_IN' ? 'exact amount in' : 'quoted in',
    amtOutHuman: ok && d.amountOutRaw != null ? String(d.amountOutRaw) : (ok ? 'quoted out' : '—'),
    spread: ok ? d.totalSpreadBps + ' bps' : null,
    gates: {
      listed: d.reason === 'asset_not_listed' ? 'fail' : 'pass',
      priced: d.reason === 'no_price' ? 'fail' : 'pass',
      inv: d.reason === 'insufficient_inventory' ? 'fail' : 'pass',
      risk: /kill|daily_loss|notional|below_min/.test(d.reason || '') ? 'fail' : (ok ? 'pass' : 'wait'),
    },
    ok,
    verdict: ok ? (dry ? 'WOULD QUOTE' : 'QUOTED') : (d.reason || 'REJECT'),
    sample: false,
  };
}

const SAMPLE = {
  quoteId: 'sample',
  assetIn: 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
  assetOut: 'nep141:wrap.near', exactAmountIn: '1000000', exactAmountOut: null,
  minDeadlineMs: 60000, side: 'EXACT_IN', symIn: 'USDC', symOut: 'wNEAR',
  amtInHuman: '1.00 USDC', amtOutHuman: 'solver would price this',
  gates: { listed: 'pass', priced: 'wait', inv: 'pass', risk: 'wait' },
  verdict: null, sample: true, ok: false,
};

function render(s, journal) {
  const dry = s.mode === 'dry-run';
  $('mode').textContent = dry ? 'dry-run' : 'live';
  $('mode').className = 'badge ' + (dry ? 'dry' : 'live');
  $('uptime').textContent = fmtUptime(s.uptimeMs);
  const kill = $('kill');
  if (s.killSwitch) { kill.className = 'on'; kill.textContent = 'KILL SWITCH — ' + s.killSwitch; }
  else kill.className = '';

  const r = s.relay || {};
  const frames = r.framesReceived || 0;
  let hc = 'warn', ht = 'no live bus traffic (needs partner API key)';
  if (frames > 0) { hc = 'ok'; ht = 'receiving'; }
  else if (r.reconnects > 0) { hc = 'bad'; ht = 'reconnects without frames'; }
  $('bus').innerHTML =
    row('frames received', frames) +
    row('reconnects', r.reconnects || 0) +
    row('malformed', r.malformedFrames || 0) +
    row('status', ht, hc);

  const inv = s.inventory || [];
  $('inv').innerHTML = inv.map(l =>
    row(l.symbol, fmtAmount(l.availableRaw, l.decimals))
  ).join('') + row('open reservations', s.activeReservations);

  const c = s.counters || {};
  const entries = Object.entries(c).sort((a,b) => b[1]-a[1]);
  $('counters').innerHTML = entries.length
    ? entries.map(([k,v]) => row(k.replace(/^quote_decision:/,''), v)).join('')
    : row('none yet', '—');

  const j = journal || [];
  let card = null;
  for (let i = j.length - 1; i >= 0; i--) { card = fromJournal(j[i], dry); if (card) break; }
  if (card) {
    $('intentHint').textContent = card.quoteId;
    $('intentCard').innerHTML = renderIntent(card);
  } else {
    $('intentHint').textContent = 'no decisions yet';
    $('intentCard').innerHTML = renderIntent(SAMPLE);
  }

  const rows = j.slice(-40).reverse().map(e => {
    if (e.type !== 'quote_decision') return '';
    const d = e.decision, ev = e.event;
    const pair = symOf(ev.assetIn) + ' → ' + symOf(ev.assetOut);
    const reason = d.shouldQuote ? (dry ? 'would_quote' : 'quoted') : d.reason;
    const det = d.shouldQuote ? d.totalSpreadBps + ' bps' : '';
    let chip = 'r';
    if (d.shouldQuote) chip = 'q';
    if (/kill|daily_loss/.test(reason || '')) chip = 'h';
    return '<div class="line"><span class="t">' + new Date(e.tMs).toISOString().slice(11,19) +
      '</span><span>' + esc(pair) + '</span><span style="color:var(--muted)">' + esc(det) +
      '</span><span class="chip ' + chip + '">' + esc(reason) + '</span></div>';
  }).join('');
  $('stream').innerHTML = rows || '<div class="empty">Start with: npm run solver:cover — each line is one decide()</div>';
}

async function tick() {
  try {
    const [status, journal] = await Promise.all([
      fetch('/api/status').then(r => r.json()),
      fetch('/api/journal/recent').then(r => r.json()),
    ]);
    render(status, journal);
  } catch {}
  $('clock').textContent = new Date().toISOString().slice(11, 19) + 'Z';
}
tick(); setInterval(tick, 2000);
</script>
</body>
</html>`;
