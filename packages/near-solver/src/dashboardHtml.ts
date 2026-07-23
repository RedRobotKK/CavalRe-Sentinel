/**
 * NEAR SOLVER DESK — desktop WebGL-first.
 * Hero: animated pipeline (ingest → decide → out). Overlay: live numbers.
 */

export const DASHBOARD_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NEAR SOLVER DESK · CavalRe</title>
<style>
:root{
  --cyan:#00f0c8; --warn:#ffc14a; --bad:#ff5a78; --text:#e8fff8; --muted:#5a8a82;
  --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
}
*{box-sizing:border-box;margin:0}
html,body{height:100%;overflow:hidden;background:#03060a;color:var(--text);font:13px/1.4 system-ui,sans-serif}
#gl{position:fixed;inset:0;z-index:0}
.hud{position:fixed;inset:0;z-index:2;pointer-events:none;display:grid;
  grid-template-rows:auto 1fr auto;padding:14px 16px}
.hud *{pointer-events:none}
.top{display:flex;align-items:center;gap:12px}
.logo{width:32px;height:32px;border:1px solid var(--cyan);display:grid;place-items:center;
  font:700 10px var(--mono);color:var(--cyan);box-shadow:0 0 16px rgba(0,240,200,.4)}
.title{font:650 13px var(--mono);letter-spacing:1.5px;text-transform:uppercase}
.title span{color:var(--muted);font-weight:500}
.pill{font:700 9px var(--mono);padding:4px 10px;border:1px solid;text-transform:uppercase}
.pill.dry{color:var(--warn);border-color:rgba(255,193,74,.45);background:rgba(30,22,0,.5)}
.pill.live{color:var(--cyan);border-color:var(--cyan);background:rgba(0,40,34,.5)}
.sp{flex:1}
.meta{font:11px var(--mono);color:var(--muted)}.meta b{color:var(--cyan)}
.mid{display:grid;grid-template-columns:200px 1fr 200px;gap:12px;align-items:stretch;min-height:0;padding:12px 0}
.side{display:flex;flex-direction:column;gap:10px}
.panel{background:rgba(4,12,16,.72);border:1px solid rgba(0,240,200,.2);padding:12px 14px;backdrop-filter:blur(8px)}
.panel h2{font:650 9px var(--mono);letter-spacing:1.4px;text-transform:uppercase;color:var(--cyan);margin-bottom:8px}
.row{display:flex;justify-content:space-between;padding:3px 0;font:12px var(--mono);border-bottom:1px solid rgba(0,40,36,.4)}
.row:last-child{border:0}.k{color:var(--muted);font-size:10px}.v.ok{color:var(--cyan)}.v.warn{color:var(--warn)}.v.bad{color:var(--bad)}
.hero{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-height:0;padding-bottom:8px}
.hero-label{font:650 10px var(--mono);letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;
  background:rgba(0,0,0,.35);padding:4px 12px;border:1px solid rgba(0,240,200,.15)}
.intent{width:min(520px,90%);background:rgba(4,14,18,.85);border:1px solid rgba(0,240,200,.3);
  padding:14px 16px;backdrop-filter:blur(10px);box-shadow:0 0 40px rgba(0,240,200,.08)}
.intent .pair{display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:10px}
.intent .sym{font:700 22px var(--mono)}.intent .arrow{color:var(--cyan);font-size:18px}
.intent .sub{text-align:center;font:12px var(--mono);color:var(--muted);margin-bottom:8px}
.intent .gates{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-items:center}
.gate{font:700 8px var(--mono);padding:2px 7px;border:1px solid rgba(0,80,70,.5);color:var(--muted);text-transform:uppercase}
.gate.pass{color:var(--cyan);border-color:rgba(0,240,200,.45)}.gate.fail{color:var(--bad);border-color:rgba(255,90,120,.45)}.gate.wait{color:var(--warn);border-color:rgba(255,193,74,.4)}
.verdict{font:700 10px var(--mono);padding:3px 10px;border:1px solid;text-transform:uppercase;margin-left:8px}
.verdict.q{color:var(--cyan);border-color:var(--cyan)}.verdict.r{color:var(--warn);border-color:rgba(255,193,74,.45)}.verdict.h{color:var(--bad);border-color:rgba(255,90,120,.5)}
.bottom{display:grid;grid-template-columns:1fr;max-height:28vh}
.tape{background:rgba(2,8,12,.85);border:1px solid rgba(0,240,200,.18);padding:8px 10px;overflow:auto;font:11.5px var(--mono)}
.tape h2{font:650 9px var(--mono);letter-spacing:1.4px;text-transform:uppercase;color:var(--cyan);margin-bottom:6px;display:flex;justify-content:space-between}
.tape h2 span{color:var(--muted);font-weight:500}
.line{display:grid;grid-template-columns:52px 1fr auto auto;gap:8px;padding:3px 4px;border-left:2px solid transparent}
.line.q{border-left-color:var(--cyan)}.line.r{border-left-color:var(--warn)}.line.h{border-left-color:var(--bad)}
.line .t{color:var(--muted)}.chip{font:700 8px var(--mono);padding:2px 6px;border:1px solid;text-transform:uppercase}
.chip.q{color:var(--cyan);border-color:rgba(0,240,200,.4)}.chip.r{color:var(--warn);border-color:rgba(255,193,74,.4)}.chip.h{color:var(--bad);border-color:rgba(255,90,120,.45)}
#kill{display:none;position:fixed;top:56px;left:50%;transform:translateX(-50%);z-index:5;
  padding:10px 18px;border:1px solid var(--bad);background:rgba(40,6,12,.95);color:var(--bad);font:650 13px var(--mono)}
#kill.on{display:block}
.hint{position:fixed;bottom:10px;right:14px;z-index:3;font:10px var(--mono);color:var(--muted)}
</style>
</head>
<body>
<canvas id="gl"></canvas>
<div id="kill"></div>
<div class="hud">
  <div class="top">
    <div class="logo">NS</div>
    <div class="title">Near Solver Desk <span>· CavalRe</span></div>
    <span id="mode" class="pill dry">…</span>
    <span class="sp"></span>
    <span class="meta">UP <b id="uptime">—</b> · <span id="clock">—</span></span>
  </div>
  <div class="mid">
    <div class="side">
      <div class="panel"><h2>Bus</h2><div id="bus"></div></div>
      <div class="panel"><h2>Inventory</h2><div id="inv"></div></div>
    </div>
    <div class="hero">
      <div class="hero-label">Pipeline · ingest → decide → out</div>
      <div class="intent" id="intentCard"></div>
    </div>
    <div class="side">
      <div class="panel"><h2>Scoreboard</h2><div id="counters"></div></div>
      <div class="panel"><h2>Path</h2>
        <div class="row"><span class="k">seen</span><span class="v" id="nSee">0</span></div>
        <div class="row"><span class="k">rejected</span><span class="v" id="nRisk">0</span></div>
        <div class="row"><span class="k">would quote</span><span class="v ok" id="nQuote">0</span></div>
        <div class="row"><span class="k">frames</span><span class="v" id="nBus">0</span></div>
      </div>
    </div>
  </div>
  <div class="bottom">
    <div class="tape"><h2><span>Decision tape</span><span id="intentHint">—</span></h2><div id="stream"></div></div>
  </div>
</div>
<div class="hint">WebGL pipeline · dry-run · /metrics</div>
<script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.160.0/build/three.module.js"}}</script>
<script type="module">
import * as THREE from 'three';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ========== WebGL hero pipeline ========== */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x03060a, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 2, 0.1, 80);
camera.position.set(0, 5.5, 12.5);
camera.lookAt(0, 0.8, 0);

scene.add(new THREE.AmbientLight(0x142828, 1.1));
const key = new THREE.DirectionalLight(0x00f0c8, 1.0);
key.position.set(4, 10, 6); scene.add(key);
const fill = new THREE.PointLight(0x4488ff, 0.4, 40);
fill.position.set(-6, 3, 4); scene.add(fill);

const grid = new THREE.GridHelper(32, 64, 0x0a3a32, 0x061818);
grid.position.y = -1.5; scene.add(grid);

const LABELS = ['BUS', 'SEE', 'MARK', 'DECIDE', 'RISK', 'QUOTE'];
const nodeMeshes = [];
const nodePositions = [];
const pathGroup = new THREE.Group();
scene.add(pathGroup);

for (let i = 0; i < LABELS.length; i++) {
  const x = (i - 2.5) * 1.7;
  const pos = new THREE.Vector3(x, 1.2, 0);
  nodePositions.push(pos.clone());
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 24, 24),
    new THREE.MeshStandardMaterial({
      color: 0x007a66, emissive: 0x003028, emissiveIntensity: 0.5,
      metalness: 0.4, roughness: 0.35,
    })
  );
  core.position.copy(pos);
  pathGroup.add(core);
  nodeMeshes.push(core);
  // outer ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.03, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0x00f0c8, transparent: true, opacity: 0.25 })
  );
  ring.position.copy(pos);
  ring.rotation.x = Math.PI / 2;
  pathGroup.add(ring);
  if (i > 0) {
    const a = nodePositions[i - 1], b = pos;
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 12, 0.04, 6, false),
      new THREE.MeshBasicMaterial({ color: 0x00a080, transparent: true, opacity: 0.4 })
    );
    pathGroup.add(tube);
  }
}

// floating label sprites via canvas textures
function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.clearRect(0, 0, 128, 32);
  ctx.font = 'bold 18px monospace';
  ctx.fillStyle = '#00f0c8';
  ctx.textAlign = 'center';
  ctx.fillText(text, 64, 22);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.85 });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(1.4, 0.35, 1);
  return sp;
}
LABELS.forEach((lab, i) => {
  const sp = makeLabel(lab);
  sp.position.copy(nodePositions[i]);
  sp.position.y += 0.85;
  pathGroup.add(sp);
});

// inventory pillars
const invBars = {};
['USDC', 'wNEAR', 'USDT'].forEach((sym, i) => {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 1, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x00a888, emissive: 0x002820, metalness: 0.35, roughness: 0.4 })
  );
  m.position.set(-6.2 + i * 0.8, -0.5, 2);
  scene.add(m);
  invBars[sym] = m;
});

// energy torus around pipeline
const torus = new THREE.Mesh(
  new THREE.TorusGeometry(5.2, 0.04, 10, 100),
  new THREE.MeshBasicMaterial({ color: 0x00f0c8, transparent: true, opacity: 0.18 })
);
torus.rotation.x = Math.PI / 2.5;
torus.position.y = 1.2;
scene.add(torus);

// flowing packets along path
const packets = [];
const pGeo = new THREE.SphereGeometry(0.12, 10, 10);

function spawnPacket(ok) {
  const mat = new THREE.MeshBasicMaterial({
    color: ok ? 0x00f0c8 : 0xffc14a,
    transparent: true,
  });
  const m = new THREE.Mesh(pGeo, mat);
  m.userData = { t: 0, speed: 0.35 + Math.random() * 0.2, ok, trail: [] };
  m.position.copy(nodePositions[0]);
  scene.add(m);
  packets.push(m);
}

// ambient idle packets (slow, dim) so fullscreen never feels dead
let idleAcc = 0;

let lastWould = 0, lastReject = 0, lastTotal = 0;

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

function posOnPath(t) {
  // t in [0,1] along node chain
  const n = nodePositions.length - 1;
  const x = Math.max(0, Math.min(0.999, t)) * n;
  const i = Math.floor(x);
  const f = x - i;
  const a = nodePositions[i], b = nodePositions[Math.min(i + 1, n)];
  return new THREE.Vector3().lerpVectors(a, b, f);
}

(function animate() {
  requestAnimationFrame(animate);
  const dt = 0.016;
  const t = performance.now() * 0.001;
  pathGroup.rotation.y = Math.sin(t * 0.1) * 0.05;
  torus.rotation.z = t * 0.08;
  // pulse nodes
  nodeMeshes.forEach((m, i) => {
    const pulse = 0.5 + 0.15 * Math.sin(t * 2 + i * 0.7);
    m.material.emissiveIntensity = m.userData.active ? 1.2 : pulse;
  });
  // idle trickle
  idleAcc += dt;
  if (idleAcc > 2.2) {
    idleAcc = 0;
    spawnPacket(Math.random() > 0.45);
  }
  for (let i = packets.length - 1; i >= 0; i--) {
    const p = packets[i];
    p.userData.t += p.userData.speed * dt;
    if (p.userData.t >= 1) {
      scene.remove(p);
      packets.splice(i, 1);
      continue;
    }
    p.position.copy(posOnPath(p.userData.t));
    p.position.y += Math.sin(p.userData.t * Math.PI) * 0.15;
    p.material.opacity = 0.4 + 0.6 * Math.sin(p.userData.t * Math.PI);
  }
  renderer.render(scene, camera);
})();

/* ========== data layer ========== */
function fmtAmount(raw, decimals) {
  const v = BigInt(raw), d = BigInt(decimals), scale = 10n ** d;
  const whole = v / scale, frac = d >= 2n ? ((v % scale) * 100n) / scale : 0n;
  return whole.toLocaleString() + '.' + frac.toString().padStart(2, '0');
}
function shortAsset(id) {
  const name = String(id).replace(/^nep\\d+:/, '');
  return name.length > 16 ? name.slice(0, 8) + '…' + name.slice(-4) : name;
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
  const gh = ['listed', 'priced', 'inv', 'risk'].map(k => {
    const st = gates[k] || 'wait';
    return '<span class="gate ' + st + '">' + k + '</span>';
  }).join('');
  let verdict = o.verdict, vc = 'r';
  if (!verdict && o.sample) verdict = 'WAITING';
  else if (o.ok) { verdict = o.verdict || 'WOULD QUOTE'; vc = 'q'; }
  else if (verdict && /kill|daily_loss/.test(verdict)) vc = 'h';
  return '<div class="pair"><span class="sym">' + esc(o.symIn) + '</span><span class="arrow">→</span><span class="sym">' + esc(o.symOut) + '</span></div>' +
    '<div class="sub">' + esc(o.side) + ' · deadline ≥ ' + (o.minDeadlineMs / 1000) + 's · ' + esc(o.spread || 'no spread') + '</div>' +
    '<div class="gates">' + gh + '<span class="verdict ' + vc + '">' + esc(verdict || '—') + '</span></div>';
}

function fromJournal(e, dry) {
  if (!e || e.type !== 'quote_decision') return null;
  const d = e.decision, ev = e.event, ok = !!d.shouldQuote;
  const side = ev.exactAmountIn != null ? 'EXACT_IN' : 'EXACT_OUT';
  return {
    quoteId: ev.quoteId || d.quoteId,
    symIn: symOf(ev.assetIn), symOut: symOf(ev.assetOut),
    minDeadlineMs: ev.minDeadlineMs || 60000, side,
    spread: ok ? d.totalSpreadBps + ' bps' : null,
    gates: {
      listed: d.reason === 'asset_not_listed' ? 'fail' : 'pass',
      priced: d.reason === 'no_price' ? 'fail' : 'pass',
      inv: d.reason === 'insufficient_inventory' ? 'fail' : 'pass',
      risk: /kill|daily_loss|notional|below_min/.test(d.reason || '') ? 'fail' : (ok ? 'pass' : 'wait'),
    },
    ok, verdict: ok ? (dry ? 'WOULD QUOTE' : 'QUOTED') : (d.reason || 'REJECT'), sample: false,
  };
}

const SAMPLE = {
  symIn: 'USDC', symOut: 'wNEAR', minDeadlineMs: 60000, side: 'EXACT_IN', spread: null,
  gates: { listed: 'pass', priced: 'wait', inv: 'pass', risk: 'wait' },
  verdict: null, sample: true, ok: false,
};

function render(s, journal) {
  const dry = s.mode === 'dry-run';
  $('mode').textContent = dry ? 'dry-run' : 'live';
  $('mode').className = 'pill ' + (dry ? 'dry' : 'live');
  $('uptime').textContent = fmtUptime(s.uptimeMs);
  const kill = $('kill');
  if (s.killSwitch) { kill.className = 'on'; kill.textContent = 'KILL — ' + s.killSwitch; }
  else kill.className = '';

  const r = s.relay || {}, frames = r.framesReceived || 0;
  let hc = 'warn', ht = 'no frames · partner key?';
  if (frames > 0) { hc = 'ok'; ht = 'up'; }
  else if (r.reconnects > 0) { hc = 'bad'; ht = 'reconnect storm'; }
  $('bus').innerHTML = row('frames', frames) + row('reconnects', r.reconnects || 0) +
    row('malformed', r.malformedFrames || 0) + row('status', ht, hc);

  const inv = s.inventory || [];
  let maxN = 1;
  const parsed = inv.map(l => {
    const n = Number(fmtAmount(l.availableRaw, l.decimals).replace(/,/g, ''));
    if (n > maxN) maxN = n;
    return { ...l, n };
  });
  $('inv').innerHTML = parsed.map(l => row(l.symbol, fmtAmount(l.availableRaw, l.decimals))).join('') +
    row('reserved', s.activeReservations);
  parsed.forEach(l => {
    const b = invBars[l.symbol];
    if (!b) return;
    const h = Math.max(0.25, (l.n / maxN) * 2.6);
    b.scale.y = h;
    b.position.y = -1.5 + h / 2;
  });

  const c = s.counters || {};
  const would = Object.entries(c).filter(([k]) => /would_quote|quoted/.test(k)).reduce((a, [, v]) => a + v, 0);
  const rejects = Object.entries(c).filter(([k]) => k.startsWith('quote_decision:') && !/would_quote|quoted/.test(k)).reduce((a, [, v]) => a + v, 0);
  const total = would + rejects;
  $('counters').innerHTML = Object.entries(c).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => row(k.replace(/^quote_decision:/, ''), v)).join('') || row('none', '—');
  $('nSee').textContent = total;
  $('nRisk').textContent = rejects;
  $('nQuote').textContent = would;
  $('nBus').textContent = frames;

  nodeMeshes.forEach((m, i) => {
    const on = (i === 0 && frames > 0) || (i > 0 && total > 0);
    m.userData.active = on;
    m.material.color.setHex(on ? 0x00f0c8 : 0x007a66);
  });

  // burst packets when new decisions
  if (would > lastWould) {
    for (let i = 0; i < Math.min(5, would - lastWould); i++) spawnPacket(true);
  }
  if (rejects > lastReject) {
    for (let i = 0; i < Math.min(5, rejects - lastReject); i++) spawnPacket(false);
  }
  if (total > lastTotal && total === lastTotal) { /* no-op */ }
  lastWould = would; lastReject = rejects; lastTotal = total;

  const j = journal || [];
  let card = null;
  for (let i = j.length - 1; i >= 0; i--) { card = fromJournal(j[i], dry); if (card) break; }
  if (card) {
    $('intentHint').textContent = card.quoteId || 'live';
    $('intentCard').innerHTML = renderIntent(card);
  } else {
    $('intentHint').textContent = 'idle';
    $('intentCard').innerHTML = renderIntent(SAMPLE);
  }

  const rows = j.slice(-30).reverse().map(e => {
    if (e.type !== 'quote_decision') return '';
    const d = e.decision, ev = e.event;
    const pair = symOf(ev.assetIn) + ' → ' + symOf(ev.assetOut);
    const reason = d.shouldQuote ? (dry ? 'would_quote' : 'quoted') : d.reason;
    const det = d.shouldQuote ? d.totalSpreadBps + ' bps' : '';
    let kind = 'r', chip = 'r';
    if (d.shouldQuote) { kind = 'q'; chip = 'q'; }
    if (/kill|daily_loss/.test(reason || '')) { kind = 'h'; chip = 'h'; }
    return '<div class="line ' + kind + '"><span class="t">' + new Date(e.tMs).toISOString().slice(11, 19) +
      '</span><span>' + esc(pair) + '</span><span style="color:var(--muted)">' + esc(det) +
      '</span><span class="chip ' + chip + '">' + esc(reason) + '</span></div>';
  }).join('');
  $('stream').innerHTML = rows || '<div style="padding:12px;color:var(--muted);text-align:center">npm run solver:cover — packets will flow the pipeline</div>';
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
