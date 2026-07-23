/**
 * NEAR SOLVER DESK — Three.js scene + sharp CSS overlay.
 * Zero build; Three from CDN. Data only from /api/*.
 */

export const DASHBOARD_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NEAR SOLVER DESK · CavalRe</title>
<style>
:root{
  --bg:#03060c;--panel:rgba(6,14,22,.78);--line:rgba(0,220,200,.28);
  --cyan:#00e8c8;--ice:#6ee7ff;--warn:#ffb020;--danger:#ff3d5a;
  --text:#e8fff9;--muted:#3d6a62;--mono:"SF Mono",ui-monospace,Menlo,monospace;
}
*{box-sizing:border-box;margin:0}
html,body{height:100%;overflow:hidden;background:var(--bg);color:var(--text);font:12.5px/1.4 system-ui,sans-serif}
#c{position:fixed;inset:0;z-index:0}
.ui{position:relative;z-index:2;height:100%;display:grid;grid-template-rows:auto auto 1fr auto;pointer-events:none}
.ui>*{pointer-events:auto}
.topbar{display:flex;align-items:center;gap:10px;padding:10px 16px;background:linear-gradient(180deg,rgba(0,18,16,.95),rgba(0,10,14,.55));border-bottom:1px solid var(--line);backdrop-filter:blur(12px)}
.mark{width:28px;height:28px;border:1px solid var(--cyan);display:grid;place-items:center;font:700 9px var(--mono);color:var(--cyan);box-shadow:0 0 16px rgba(0,232,200,.35)}
.ttl{font:650 12px var(--mono);letter-spacing:1.2px;text-transform:uppercase}
.ttl em{font-style:normal;color:var(--muted);font-weight:500}
.tag{font:700 8px var(--mono);letter-spacing:.9px;text-transform:uppercase;padding:3px 8px;border:1px solid}
.tag.dry{color:var(--warn);border-color:rgba(255,176,32,.45);background:rgba(40,28,0,.5)}
.tag.live{color:var(--cyan);border-color:var(--cyan);background:rgba(0,40,36,.5)}
.tag.dim{color:var(--ice);border-color:rgba(110,231,255,.3)}
.spacer{flex:1}
.meta{font:11px var(--mono);color:var(--muted)}.meta b{color:var(--cyan);font-weight:600}
#kill{display:none;margin:0 16px;padding:10px 12px;border:1px solid var(--danger);background:rgba(40,4,12,.9);color:var(--danger);font:650 12px var(--mono)}
#kill.on{display:block}
.main{display:grid;grid-template-columns:210px 1fr 230px;gap:12px;padding:12px 16px;min-height:0}
@media(max-width:960px){.main{grid-template-columns:1fr;overflow:auto}}
.panel{background:var(--panel);border:1px solid var(--line);backdrop-filter:blur(14px);padding:10px 12px;position:relative}
.panel::before{content:"";position:absolute;left:8px;right:8px;top:0;height:1px;background:linear-gradient(90deg,transparent,var(--cyan),transparent);opacity:.7}
.panel h2{font:650 8px var(--mono);letter-spacing:1.4px;text-transform:uppercase;color:var(--cyan);margin-bottom:8px}
.row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(0,50,45,.35);font:11.5px var(--mono)}
.row:last-child{border:0}.k{color:var(--muted);font-size:10px}.v.ok{color:var(--cyan)}.v.warn{color:var(--warn)}.v.bad{color:var(--danger)}
.center{display:flex;flex-direction:column;gap:10px;min-height:0}
.intent-body{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;padding:12px 4px}
.leg{padding:12px;border:1px solid rgba(0,200,170,.22);background:rgba(0,20,18,.45)}
.leg .d{font:700 8px var(--mono);letter-spacing:1px;color:var(--muted);margin-bottom:4px}
.leg .s{font:700 18px var(--mono)}.leg .a{font:12px var(--mono);color:var(--cyan);margin-top:4px}
.leg .r{font:9px var(--mono);color:var(--muted);margin-top:2px;word-break:break-all}
.orb{width:52px;height:52px;border-radius:50%;border:1px solid var(--cyan);display:grid;place-items:center;font:700 16px var(--mono);color:var(--cyan);
  box-shadow:0 0 24px rgba(0,232,200,.4),inset 0 0 16px rgba(0,232,200,.15);background:radial-gradient(circle at 35% 30%,rgba(0,80,70,.9),rgba(0,20,18,.95))}
.meta-grid{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid rgba(0,70,60,.4)}
.meta-grid .c{padding:8px;border-right:1px solid rgba(0,70,60,.35)}.meta-grid .c:last-child{border:0}
.meta-grid .l{font:8px var(--mono);color:var(--muted);letter-spacing:1px;text-transform:uppercase}
.meta-grid .x{font:11px var(--mono);margin-top:2px}
.foot{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;border-top:1px solid rgba(0,70,60,.4);background:rgba(0,16,14,.4)}
.gate{font:700 8px var(--mono);padding:2px 7px;border:1px solid var(--line);color:var(--muted);text-transform:uppercase}
.gate.pass{color:var(--cyan);border-color:rgba(0,232,200,.5)}.gate.fail{color:var(--danger);border-color:rgba(255,61,90,.5)}.gate.wait{color:var(--warn);border-color:rgba(255,176,32,.4)}
.verdict{margin-left:auto;font:700 10px var(--mono);letter-spacing:1px;padding:4px 10px;border:1px solid;text-transform:uppercase}
.verdict.q{color:var(--cyan);border-color:var(--cyan);background:rgba(0,40,36,.5)}
.verdict.r{color:var(--warn);border-color:rgba(255,176,32,.45);background:rgba(40,28,0,.4)}
.verdict.h{color:var(--danger);border-color:rgba(255,61,90,.5)}
.tape{flex:1;min-height:120px;display:flex;flex-direction:column;border:1px solid var(--line);background:rgba(2,8,12,.85)}
.tape h2{padding:7px 12px;border-bottom:1px solid var(--line);font:650 8px var(--mono);letter-spacing:1.4px;text-transform:uppercase;color:var(--cyan);display:flex;justify-content:space-between}
.tape h2 span{color:var(--muted);font-weight:500}
#stream{flex:1;overflow:auto;padding:6px;font:11px var(--mono)}
.entry{display:grid;grid-template-columns:52px 1fr auto auto;gap:8px;padding:4px 8px;border-left:2px solid transparent}
.entry.q{border-left-color:var(--cyan)}.entry.r{border-left-color:var(--warn)}.entry.h{border-left-color:var(--danger)}
.entry .t{color:var(--muted)}.chip{font:700 8px var(--mono);padding:2px 6px;border:1px solid;text-transform:uppercase}
.chip.q{color:var(--cyan);border-color:rgba(0,232,200,.45)}.chip.r{color:var(--warn);border-color:rgba(255,176,32,.4)}.chip.h{color:var(--danger);border-color:rgba(255,61,90,.45)}
footer{padding:6px 16px;font:9px var(--mono);color:var(--muted);display:flex;justify-content:space-between;border-top:1px solid rgba(0,50,45,.4);background:rgba(0,8,10,.6)}
.hint{color:var(--muted);font-size:10px}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div class="ui">
  <div class="topbar">
    <div class="mark">NS</div>
    <div class="ttl">Near Solver Desk <em>· CavalRe</em></div>
    <span id="mode" class="tag dry">…</span>
    <span class="tag dim">CANON · VIEW</span>
    <span class="spacer"></span>
    <span class="meta">UP <b id="uptime">—</b></span>
    <span class="meta" id="clock">—</span>
  </div>
  <div id="kill"></div>
  <div class="main">
    <div>
      <div class="panel" style="margin-bottom:10px"><h2>Bus</h2><div id="bus"></div></div>
      <div class="panel"><h2>Inventory</h2><div id="inv"></div></div>
    </div>
    <div class="center">
      <div class="panel">
        <h2 style="display:flex;justify-content:space-between"><span>Active quote request</span><span class="hint" id="intentHint">—</span></h2>
        <div id="intentCard"></div>
      </div>
      <div class="tape">
        <h2><span>Decision tape</span><span>2s poll</span></h2>
        <div id="stream"></div>
      </div>
    </div>
    <div>
      <div class="panel" style="margin-bottom:10px"><h2>Decision mass</h2><div id="counters"></div></div>
      <div class="panel"><h2>Path mass</h2>
        <div class="row"><span class="k">see</span><span class="v" id="nSee">0</span></div>
        <div class="row"><span class="k">decide</span><span class="v" id="nDecide">0</span></div>
        <div class="row"><span class="k">risk reject</span><span class="v" id="nRisk">0</span></div>
        <div class="row"><span class="k">would quote</span><span class="v ok" id="nQuote">0</span></div>
        <div class="row"><span class="k">frames</span><span class="v" id="nBus">0</span></div>
      </div>
    </div>
  </div>
  <footer>
    <span>127.0.0.1 · read-only · /metrics</span>
    <span>Three.js · exact raw on /api/status</span>
  </footer>
</div>
<script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.160.0/build/three.module.js"}}</script>
<script type="module">
import * as THREE from 'three';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x03060c, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 2, 0.1, 80);
camera.position.set(0, 3.2, 9.5);
camera.lookAt(0, 0.4, 0);

scene.add(new THREE.AmbientLight(0x1a3030, 0.9));
const key = new THREE.DirectionalLight(0x00e8c8, 1.15);
key.position.set(4, 8, 6);
scene.add(key);
const fill = new THREE.PointLight(0x6ee7ff, 0.5, 30);
fill.position.set(-5, 2, 3);
scene.add(fill);

const grid = new THREE.GridHelper(24, 48, 0x0a3a34, 0x061818);
grid.position.y = -1.2;
scene.add(grid);

const PATH_N = 6;
const nodeMeshes = [];
const nodeGroup = new THREE.Group();
scene.add(nodeGroup);
for (let i = 0; i < PATH_N; i++) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0x006656, emissive: 0x003830, emissiveIntensity: 0.45, metalness: 0.35, roughness: 0.35 })
  );
  const x = (i - 2.5) * 1.35;
  m.position.set(x, 0.9, 0);
  nodeGroup.add(m);
  nodeMeshes.push(m);
  if (i > 0) {
    const a = new THREE.Vector3((i - 3.5) * 1.35, 0.9, 0);
    const b = new THREE.Vector3(x, 0.9, 0);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 8, 0.03, 6, false),
      new THREE.MeshBasicMaterial({ color: 0x00a080, transparent: true, opacity: 0.5 })
    );
    nodeGroup.add(tube);
  }
}

const invBars = {};
const invGroup = new THREE.Group();
invGroup.position.set(-4.2, -0.4, -1.5);
scene.add(invGroup);
['USDC', 'wNEAR', 'USDT'].forEach((sym, i) => {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 1, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x00b89a, emissive: 0x002820, metalness: 0.4, roughness: 0.4 })
  );
  m.position.set(i * 0.85, 0.5, 0);
  invGroup.add(m);
  invBars[sym] = m;
});

const particles = [];
const pGeo = new THREE.SphereGeometry(0.06, 8, 8);
function spawnParticle(ok) {
  const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: ok ? 0x00e8c8 : 0xffb020, transparent: true }));
  m.position.set((Math.random() - 0.5) * 6, 2.2 + Math.random(), (Math.random() - 0.5) * 2);
  m.userData = { vy: 0.012 + Math.random() * 0.02, life: 1 };
  scene.add(m);
  particles.push(m);
}

const torus = new THREE.Mesh(
  new THREE.TorusGeometry(2.8, 0.035, 12, 96),
  new THREE.MeshBasicMaterial({ color: 0x00e8c8, transparent: true, opacity: 0.32 })
);
torus.rotation.x = Math.PI / 2.4;
torus.position.y = 0.9;
scene.add(torus);

let lastWould = 0, lastReject = 0;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

(function animate() {
  requestAnimationFrame(animate);
  const t = performance.now() * 0.001;
  nodeGroup.rotation.y = Math.sin(t * 0.15) * 0.08;
  torus.rotation.z = t * 0.12;
  for (let i = particles.length - 1; i >= 0; i--) {
    const m = particles[i];
    m.position.y += m.userData.vy;
    m.userData.life -= 0.008;
    m.material.opacity = Math.max(0, m.userData.life);
    if (m.userData.life <= 0) { scene.remove(m); particles.splice(i, 1); }
  }
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
function sumC(c, pred) {
  let n = 0; for (const [k, v] of Object.entries(c || {})) if (pred(k)) n += v; return n;
}
function metric(k, v, cls) {
  return '<div class="row"><span class="k">' + esc(k) + '</span><span class="v ' + (cls || '') + '">' + esc(String(v)) + '</span></div>';
}

function renderIntent(o) {
  const gates = o.gates || {};
  const gh = ['listed', 'priced', 'inv', 'risk'].map(k => {
    const st = gates[k] || 'wait';
    return '<span class="gate ' + st + '">' + k + '</span>';
  }).join('');
  let verdict = o.verdict, vc = 'r';
  if (!verdict && o.sample) verdict = 'AWAITING BUS';
  else if (o.ok) { verdict = o.verdict || 'WOULD_QUOTE'; vc = 'q'; }
  else if (verdict && /kill|daily_loss/.test(verdict)) vc = 'h';
  return '<div class="intent-body">' +
    '<div class="leg"><div class="d">Asset in</div><div class="s">' + esc(o.symIn) + '</div>' +
    '<div class="a">' + esc(o.amtInHuman) + '</div><div class="r">' + esc(shortAsset(o.assetIn)) + '</div></div>' +
    '<div class="orb">⇄</div>' +
    '<div class="leg"><div class="d">Asset out</div><div class="s">' + esc(o.symOut) + '</div>' +
    '<div class="a">' + esc(o.amtOutHuman) + '</div><div class="r">' + esc(shortAsset(o.assetOut)) + '</div></div></div>' +
    '<div class="meta-grid">' +
    '<div class="c"><div class="l">Side</div><div class="x">' + esc(o.side) + '</div></div>' +
    '<div class="c"><div class="l">Deadline</div><div class="x">≥ ' + (o.minDeadlineMs / 1000) + 's</div></div>' +
    '<div class="c"><div class="l">Spread</div><div class="x">' + esc(o.spread || '—') + '</div></div>' +
    '<div class="c"><div class="l">Raw</div><div class="x">' + esc(o.exactAmountIn || o.exactAmountOut || '—') + '</div></div></div>' +
    '<div class="foot">' + gh + '<span class="verdict ' + vc + '">' + esc(verdict || '—') + '</span></div>';
}

function fromJournal(e, dry) {
  if (!e || e.type !== 'quote_decision') return null;
  const d = e.decision, ev = e.event;
  const ok = !!d.shouldQuote;
  const side = ev.exactAmountIn != null ? 'EXACT_IN' : 'EXACT_OUT';
  return {
    quoteId: ev.quoteId || d.quoteId, assetIn: ev.assetIn, assetOut: ev.assetOut,
    exactAmountIn: ev.exactAmountIn != null ? String(ev.exactAmountIn) : null,
    exactAmountOut: ev.exactAmountOut != null ? String(ev.exactAmountOut) : null,
    minDeadlineMs: ev.minDeadlineMs || 60000, side,
    symIn: symOf(ev.assetIn), symOut: symOf(ev.assetOut),
    amtInHuman: side === 'EXACT_IN' ? 'exact in' : 'quoted in',
    amtOutHuman: ok && d.amountOutRaw != null ? String(d.amountOutRaw) : (ok ? 'quoted' : '—'),
    spread: ok ? (d.totalSpreadBps + ' bps') : null,
    gates: {
      listed: d.reason === 'asset_not_listed' ? 'fail' : 'pass',
      priced: d.reason === 'no_price' ? 'fail' : 'pass',
      inv: d.reason === 'insufficient_inventory' ? 'fail' : 'pass',
      risk: /kill|daily_loss|notional|below_min/.test(d.reason || '') ? 'fail' : (ok ? 'pass' : 'wait'),
    },
    ok, verdict: ok ? (dry ? 'WOULD_QUOTE' : 'QUOTED') : (d.reason || 'REJECT'), sample: false,
  };
}

const SAMPLE = {
  quoteId: '0xsample…docs',
  assetIn: 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
  assetOut: 'nep141:wrap.near', exactAmountIn: '1000000', exactAmountOut: null, minDeadlineMs: 60000,
  side: 'EXACT_IN', symIn: 'USDC', symOut: 'wNEAR', amtInHuman: '1.00', amtOutHuman: 'solver quotes',
  gates: { listed: 'pass', priced: 'wait', inv: 'pass', risk: 'wait' }, verdict: null, sample: true, ok: false,
};

function render(s, journal) {
  const dry = s.mode === 'dry-run';
  $('mode').textContent = dry ? 'DRY-RUN' : 'LIVE';
  $('mode').className = 'tag ' + (dry ? 'dry' : 'live');
  $('uptime').textContent = fmtUptime(s.uptimeMs);
  const kill = $('kill');
  if (s.killSwitch) { kill.className = 'on'; kill.textContent = 'KILL — ' + s.killSwitch; }
  else kill.className = '';

  const r = s.relay || {};
  const frames = r.framesReceived || 0;
  let hc = 'warn', ht = 'no frames · partner key?';
  if (frames > 0) { hc = 'ok'; ht = 'link up'; }
  else if (r.reconnects > 0) { hc = 'bad'; ht = 'reconnect storm'; }
  $('bus').innerHTML = metric('frames', frames) + metric('reconnects', r.reconnects || 0) +
    metric('malformed', r.malformedFrames || 0) + metric('health', ht, hc);

  const inv = s.inventory || [];
  let maxN = 1;
  const parsed = inv.map(l => {
    const n = Number(fmtAmount(l.availableRaw, l.decimals).replace(/,/g, ''));
    if (n > maxN) maxN = n;
    return { ...l, n };
  });
  $('inv').innerHTML = parsed.map(l => metric(l.symbol, fmtAmount(l.availableRaw, l.decimals))).join('') +
    metric('reserved', s.activeReservations);
  parsed.forEach(l => {
    const bar = invBars[l.symbol];
    if (!bar) return;
    const h = Math.max(0.15, (l.n / maxN) * 2.2);
    bar.scale.y = h;
    bar.position.y = h / 2;
  });

  const c = s.counters || {};
  const would = sumC(c, k => /would_quote|quoted/.test(k));
  const rejects = sumC(c, k => k.startsWith('quote_decision:') && !/would_quote|quoted/.test(k));
  const total = would + rejects;
  $('counters').innerHTML = Object.entries(c).sort().map(([k, v]) =>
    metric(k.replace(/^quote_decision:/, ''), v)
  ).join('') || metric('awaiting', '—');
  $('nBus').textContent = frames;
  $('nSee').textContent = total;
  $('nDecide').textContent = total;
  $('nRisk').textContent = rejects;
  $('nQuote').textContent = would;

  nodeMeshes.forEach((m, i) => {
    const on = (i === 0 && frames > 0) || (i > 0 && total > 0);
    m.material.emissiveIntensity = on ? 1.15 : 0.35;
    m.material.color.setHex(on ? 0x00e8c8 : 0x006656);
  });

  if (would > lastWould) for (let i = 0; i < Math.min(4, would - lastWould); i++) spawnParticle(true);
  if (rejects > lastReject) for (let i = 0; i < Math.min(4, rejects - lastReject); i++) spawnParticle(false);
  lastWould = would; lastReject = rejects;

  const j = journal || [];
  let card = null;
  for (let i = j.length - 1; i >= 0; i--) { card = fromJournal(j[i], dry); if (card) break; }
  if (card) { $('intentHint').textContent = card.quoteId; $('intentCard').innerHTML = renderIntent(card); }
  else { $('intentHint').textContent = 'sample schema'; $('intentCard').innerHTML = renderIntent(SAMPLE); }

  const rows = j.slice(-36).reverse().map(e => {
    if (e.type !== 'quote_decision') return '';
    const d = e.decision, ev = e.event;
    const pair = symOf(ev.assetIn) + ' → ' + symOf(ev.assetOut);
    const reason = d.shouldQuote ? (dry ? 'would_quote' : 'quoted') : d.reason;
    const det = d.shouldQuote ? d.totalSpreadBps + ' bps' : '';
    let kind = 'r', chip = 'r';
    if (d.shouldQuote) { kind = 'q'; chip = 'q'; }
    if (/kill|daily_loss/.test(reason || '')) { kind = 'h'; chip = 'h'; }
    return '<div class="entry ' + kind + '"><span class="t">' + new Date(e.tMs).toISOString().slice(11, 19) +
      '</span><span>' + esc(pair) + '</span><span style="color:var(--muted)">' + esc(det) +
      '</span><span class="chip ' + chip + '">' + esc(reason) + '</span></div>';
  }).join('');
  $('stream').innerHTML = rows || '<div style="padding:24px;color:var(--muted);text-align:center">no decisions yet</div>';
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
