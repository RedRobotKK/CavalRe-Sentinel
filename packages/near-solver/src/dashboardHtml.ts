/**
 * NEAR SOLVER DESK — vertical product layout (2026 console).
 * Single column flow: status → request → scoreboard → tape.
 * WebGL stays background atmosphere only.
 */

export const DASHBOARD_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NEAR SOLVER DESK · CavalRe</title>
<style>
:root{
  --bg:#070b0f; --card:rgba(12,18,24,.88); --line:rgba(0,230,190,.18);
  --cyan:#1ce8c8; --text:#eef8f5; --muted:#7a9a94; --warn:#f0b429; --bad:#f05d78;
  --radius:16px; --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
*{box-sizing:border-box;margin:0}
html,body{min-height:100%;background:var(--bg);color:var(--text);font:15px/1.5 var(--sans)}
#gl{position:fixed;inset:0;z-index:0;opacity:.55}
.scan{position:fixed;inset:0;z-index:1;pointer-events:none;
  background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.06) 3px,rgba(0,0,0,.06) 6px);opacity:.4}
.page{position:relative;z-index:2;max-width:560px;margin:0 auto;padding:20px 18px 48px}

/* top */
.nav{display:flex;align-items:center;gap:12px;margin-bottom:28px}
.mark{width:36px;height:36px;border-radius:10px;border:1px solid var(--cyan);
  display:grid;place-items:center;font:700 11px var(--mono);color:var(--cyan);
  box-shadow:0 0 20px rgba(28,232,200,.25);background:rgba(0,30,28,.6)}
.nav h1{font:600 15px var(--sans);letter-spacing:-.01em}
.nav h1 span{display:block;font:12px var(--sans);color:var(--muted);font-weight:400;margin-top:2px}
.nav-right{margin-left:auto;text-align:right;font:12px var(--mono);color:var(--muted)}
.nav-right b{color:var(--cyan);font-weight:600}

.pills{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}
.pill{font:600 11px var(--mono);padding:6px 12px;border-radius:999px;border:1px solid;text-transform:uppercase;letter-spacing:.04em}
.pill.dry{color:var(--warn);border-color:rgba(240,180,41,.35);background:rgba(40,30,0,.4)}
.pill.live{color:var(--cyan);border-color:rgba(28,232,200,.4);background:rgba(0,40,36,.4)}
.pill.mute{color:var(--muted);border-color:rgba(122,154,148,.3);background:rgba(0,0,0,.2)}

#kill{display:none;padding:14px 16px;border-radius:var(--radius);border:1px solid var(--bad);
  background:rgba(40,8,14,.9);color:var(--bad);font:600 14px var(--sans);margin-bottom:16px}
#kill.on{display:block}

/* cards */
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);
  padding:20px;margin-bottom:14px;backdrop-filter:blur(16px);
  box-shadow:0 8px 32px rgba(0,0,0,.25), inset 0 1px 0 rgba(28,232,200,.06)}
.card h2{font:600 12px var(--sans);color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px}
.lead{font:15px/1.55 var(--sans);color:var(--muted);margin-bottom:16px}
.lead strong{color:var(--text);font-weight:600}

.stat{display:flex;justify-content:space-between;align-items:baseline;padding:8px 0;
  border-bottom:1px solid rgba(255,255,255,.04);font:14px var(--mono)}
.stat:last-child{border:0}
.stat .k{color:var(--muted);font:13px var(--sans)}.stat .v{font-weight:600}
.stat .v.warn{color:var(--warn)}.stat .v.ok{color:var(--cyan)}.stat .v.bad{color:var(--bad)}

/* intent */
.swap{display:flex;flex-direction:column;gap:10px;margin:4px 0 16px}
.leg{padding:16px;border-radius:12px;background:rgba(0,0,0,.28);border:1px solid rgba(28,232,200,.12)}
.leg .dir{font:600 11px var(--sans);color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.leg .sym{font:700 22px var(--sans);letter-spacing:-.02em}
.leg .amt{font:14px var(--mono);color:var(--cyan);margin-top:4px}
.leg .raw{font:12px var(--mono);color:var(--muted);margin-top:4px;word-break:break-all}
.arrow-down{text-align:center;color:var(--cyan);font:600 18px var(--mono);opacity:.7}
.meta-row{display:flex;flex-wrap:wrap;gap:8px 16px;font:13px var(--sans);color:var(--muted);margin-bottom:14px}
.meta-row b{color:var(--text);font-weight:600;font-family:var(--mono);font-size:12px}
.gates{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.gate{font:600 11px var(--mono);padding:5px 10px;border-radius:999px;border:1px solid rgba(122,154,148,.25);color:var(--muted);text-transform:uppercase}
.gate.pass{color:var(--cyan);border-color:rgba(28,232,200,.35);background:rgba(0,40,36,.35)}
.gate.fail{color:var(--bad);border-color:rgba(240,93,120,.4);background:rgba(40,8,14,.4)}
.gate.wait{color:var(--warn);border-color:rgba(240,180,41,.35);background:rgba(40,30,0,.35)}
.verdict{margin-left:auto;font:700 12px var(--mono);padding:6px 12px;border-radius:999px;border:1px solid;text-transform:uppercase}
.verdict.q{color:var(--cyan);border-color:rgba(28,232,200,.45);background:rgba(0,40,36,.5)}
.verdict.r{color:var(--warn);border-color:rgba(240,180,41,.4);background:rgba(40,30,0,.45)}
.verdict.h{color:var(--bad);border-color:rgba(240,93,120,.45);background:rgba(40,8,14,.5)}

/* tape */
.tape-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.tape-head h2{margin:0}
.tape-head span{font:12px var(--mono);color:var(--muted)}
#stream{max-height:min(42vh,360px);overflow:auto;-webkit-overflow-scrolling:touch}
.line{display:grid;grid-template-columns:56px 1fr auto;gap:10px;padding:10px 4px;
  border-bottom:1px solid rgba(255,255,255,.04);font:13px var(--mono);align-items:center}
.line .t{color:var(--muted);font-size:12px}
.line .pair{font-weight:600;font-size:13px}
.line .det{color:var(--muted);font-size:12px;grid-column:2}
.chip{justify-self:end;font:700 10px var(--mono);padding:4px 8px;border-radius:999px;border:1px solid;text-transform:uppercase;white-space:nowrap}
.chip.q{color:var(--cyan);border-color:rgba(28,232,200,.35);background:rgba(0,40,36,.3)}
.chip.r{color:var(--warn);border-color:rgba(240,180,41,.35);background:rgba(40,30,0,.3)}
.chip.h{color:var(--bad);border-color:rgba(240,93,120,.4);background:rgba(40,8,14,.35)}
.empty{padding:28px 12px;text-align:center;color:var(--muted);font:14px var(--sans)}

footer{margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,.06);
  font:12px var(--mono);color:var(--muted);display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}

@media(min-width:720px){
  .page{max-width:640px;padding:28px 24px 64px}
  .nav h1{font-size:17px}
}
</style>
</head>
<body>
<canvas id="gl"></canvas>
<div class="scan"></div>
<div class="page">
  <div class="nav">
    <div class="mark">NS</div>
    <h1>Near Solver<span>CavalRe · local desk</span></h1>
    <div class="nav-right">up <b id="uptime">—</b><br><span id="clock">—</span></div>
  </div>

  <div class="pills">
    <span id="mode" class="pill dry">…</span>
    <span class="pill mute">view only</span>
  </div>

  <div id="kill"></div>

  <div class="card">
    <h2>What you’re looking at</h2>
    <p class="lead">This is a <strong>dry-run</strong> of the NEAR Intents solver. Every row is one <strong>decide()</strong>: would we quote, or reject, and why. Nothing is signed or broadcast from this page.</p>
    <div id="bus"></div>
  </div>

  <div class="card">
    <h2>Active request · <span id="intentHint" style="font-weight:500;text-transform:none;letter-spacing:0;color:var(--muted)">—</span></h2>
    <div id="intentCard"></div>
  </div>

  <div class="card">
    <h2>Inventory</h2>
    <div id="inv"></div>
  </div>

  <div class="card">
    <h2>Scoreboard</h2>
    <div id="counters"></div>
  </div>

  <div class="card">
    <div class="tape-head">
      <h2>Decision tape</h2>
      <span>newest first</span>
    </div>
    <div id="stream"></div>
  </div>

  <footer>
    <span>127.0.0.1 · /metrics</span>
    <span>WebGL stage · /api data</span>
  </footer>
</div>

<script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.160.0/build/three.module.js"}}</script>
<script type="module">
import * as THREE from 'three';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* soft WebGL backdrop */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x070b0f, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 2, 0.1, 50);
camera.position.set(0, 3.5, 10);
camera.lookAt(0, 0, 0);
scene.add(new THREE.AmbientLight(0x123028, 1));
const light = new THREE.DirectionalLight(0x1ce8c8, 0.7);
light.position.set(2, 6, 4); scene.add(light);
const grid = new THREE.GridHelper(20, 40, 0x0a3028, 0x081818);
grid.position.y = -1.2; scene.add(grid);
const nodes = [];
for (let i = 0; i < 6; i++) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x0a5a4a, emissive: 0x002820, emissiveIntensity: 0.45, metalness: 0.3, roughness: 0.5 })
  );
  m.position.set((i - 2.5) * 1.35, 0.4, -1);
  scene.add(m); nodes.push(m);
}
const ring = new THREE.Mesh(
  new THREE.TorusGeometry(3.2, 0.025, 8, 64),
  new THREE.MeshBasicMaterial({ color: 0x1ce8c8, transparent: true, opacity: 0.15 })
);
ring.rotation.x = Math.PI / 2.2; ring.position.set(0, 0.4, -1); scene.add(ring);
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
(function loop() {
  requestAnimationFrame(loop);
  const t = performance.now() * 0.001;
  ring.rotation.z = t * 0.08;
  nodes.forEach((m, i) => { m.position.y = 0.4 + Math.sin(t * 0.8 + i) * 0.06; });
  renderer.render(scene, camera);
})();

function fmtAmount(raw, decimals) {
  const v = BigInt(raw), d = BigInt(decimals), scale = 10n ** d;
  const whole = v / scale, frac = d >= 2n ? ((v % scale) * 100n) / scale : 0n;
  return whole.toLocaleString() + '.' + frac.toString().padStart(2, '0');
}
function shortAsset(id) {
  const name = String(id).replace(/^nep\\d+:/, '');
  return name.length > 18 ? name.slice(0, 8) + '…' + name.slice(-4) : name;
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
function stat(k, v, cls) {
  return '<div class="stat"><span class="k">' + esc(k) + '</span><span class="v ' + (cls || '') + '">' + esc(String(v)) + '</span></div>';
}

function renderIntent(o) {
  const gates = o.gates || {};
  const gh = ['listed', 'priced', 'inv', 'risk'].map(k => {
    const st = gates[k] || 'wait';
    return '<span class="gate ' + st + '">' + k + '</span>';
  }).join('');
  let verdict = o.verdict, vc = 'r';
  if (!verdict && o.sample) verdict = 'Waiting';
  else if (o.ok) { verdict = o.verdict || 'Would quote'; vc = 'q'; }
  else if (verdict && /kill|daily_loss/.test(verdict)) vc = 'h';
  return '<div class="swap">' +
    '<div class="leg"><div class="dir">You pay</div><div class="sym">' + esc(o.symIn) + '</div>' +
    '<div class="amt">' + esc(o.amtInHuman) + '</div><div class="raw">' + esc(shortAsset(o.assetIn)) + '</div></div>' +
    '<div class="arrow-down">↓</div>' +
    '<div class="leg"><div class="dir">You receive</div><div class="sym">' + esc(o.symOut) + '</div>' +
    '<div class="amt">' + esc(o.amtOutHuman) + '</div><div class="raw">' + esc(shortAsset(o.assetOut)) + '</div></div></div>' +
    '<div class="meta-row"><span>Side <b>' + esc(o.side) + '</b></span>' +
    '<span>Deadline ≥ <b>' + (o.minDeadlineMs / 1000) + 's</b></span>' +
    '<span>Spread <b>' + esc(o.spread || '—') + '</b></span></div>' +
    '<div class="gates">' + gh + '<span class="verdict ' + vc + '">' + esc(verdict || '—') + '</span></div>';
}

function fromJournal(e, dry) {
  if (!e || e.type !== 'quote_decision') return null;
  const d = e.decision, ev = e.event, ok = !!d.shouldQuote;
  const side = ev.exactAmountIn != null ? 'EXACT_IN' : 'EXACT_OUT';
  return {
    quoteId: ev.quoteId || d.quoteId, assetIn: ev.assetIn, assetOut: ev.assetOut,
    minDeadlineMs: ev.minDeadlineMs || 60000, side,
    symIn: symOf(ev.assetIn), symOut: symOf(ev.assetOut),
    amtInHuman: side === 'EXACT_IN' ? 'exact in' : 'quoted in',
    amtOutHuman: ok && d.amountOutRaw != null ? String(d.amountOutRaw) : (ok ? 'quoted' : '—'),
    spread: ok ? d.totalSpreadBps + ' bps' : null,
    gates: {
      listed: d.reason === 'asset_not_listed' ? 'fail' : 'pass',
      priced: d.reason === 'no_price' ? 'fail' : 'pass',
      inv: d.reason === 'insufficient_inventory' ? 'fail' : 'pass',
      risk: /kill|daily_loss|notional|below_min/.test(d.reason || '') ? 'fail' : (ok ? 'pass' : 'wait'),
    },
    ok, verdict: ok ? (dry ? 'Would quote' : 'Quoted') : (d.reason || 'Reject'), sample: false,
  };
}

const SAMPLE = {
  quoteId: 'sample', assetIn: 'nep141:usdc', assetOut: 'nep141:wrap.near',
  minDeadlineMs: 60000, side: 'EXACT_IN', symIn: 'USDC', symOut: 'wNEAR',
  amtInHuman: '1.00', amtOutHuman: 'priced if accepted',
  gates: { listed: 'pass', priced: 'wait', inv: 'pass', risk: 'wait' },
  verdict: null, sample: true, ok: false,
};

function render(s, journal) {
  const dry = s.mode === 'dry-run';
  $('mode').textContent = dry ? 'Dry-run' : 'Live';
  $('mode').className = 'pill ' + (dry ? 'dry' : 'live');
  $('uptime').textContent = fmtUptime(s.uptimeMs);
  const kill = $('kill');
  if (s.killSwitch) { kill.className = 'on'; kill.textContent = 'Kill switch — ' + s.killSwitch; }
  else kill.className = '';

  const r = s.relay || {}, frames = r.framesReceived || 0;
  let hc = 'warn', ht = 'No frames · partner key needed for live bus';
  if (frames > 0) { hc = 'ok'; ht = 'Receiving'; }
  else if (r.reconnects > 0) { hc = 'bad'; ht = 'Reconnects without frames'; }
  $('bus').innerHTML =
    stat('Bus frames', frames) +
    stat('Reconnects', r.reconnects || 0) +
    stat('Malformed', r.malformedFrames || 0) +
    stat('Bus status', ht, hc);

  const inv = s.inventory || [];
  $('inv').innerHTML = inv.map(l =>
    stat(l.symbol, fmtAmount(l.availableRaw, l.decimals))
  ).join('') + stat('Open reservations', s.activeReservations);

  const c = s.counters || {};
  const total = Object.values(c).reduce((a, v) => a + v, 0);
  nodes.forEach((m, i) => {
    const on = (i === 0 && frames > 0) || (i > 0 && total > 0);
    m.material.emissiveIntensity = on ? 1.1 : 0.35;
    m.material.color.setHex(on ? 0x1ce8c8 : 0x0a5a4a);
  });
  $('counters').innerHTML = Object.entries(c).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => stat(k.replace(/^quote_decision:/, ''), v)).join('') || stat('None yet', '—');

  const j = journal || [];
  let card = null;
  for (let i = j.length - 1; i >= 0; i--) { card = fromJournal(j[i], dry); if (card) break; }
  if (card) { $('intentHint').textContent = card.quoteId; $('intentCard').innerHTML = renderIntent(card); }
  else { $('intentHint').textContent = 'idle'; $('intentCard').innerHTML = renderIntent(SAMPLE); }

  const rows = j.slice(-40).reverse().map(e => {
    if (e.type !== 'quote_decision') return '';
    const d = e.decision, ev = e.event;
    const pair = symOf(ev.assetIn) + ' → ' + symOf(ev.assetOut);
    const reason = d.shouldQuote ? (dry ? 'would_quote' : 'quoted') : d.reason;
    const det = d.shouldQuote ? d.totalSpreadBps + ' bps' : '';
    let chip = 'r';
    if (d.shouldQuote) chip = 'q';
    if (/kill|daily_loss/.test(reason || '')) chip = 'h';
    return '<div class="line"><span class="t">' + new Date(e.tMs).toISOString().slice(11, 19) +
      '</span><div><div class="pair">' + esc(pair) + '</div>' +
      (det ? '<div class="det">' + esc(det) + '</div>' : '') + '</div>' +
      '<span class="chip ' + chip + '">' + esc(reason) + '</span></div>';
  }).join('');
  $('stream').innerHTML = rows || '<div class="empty">Run <code>npm run solver:cover</code> to fill the tape</div>';
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
