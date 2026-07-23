/**
 * NEAR SOLVER DESK — bars + funnel + particle-math hero.
 */

export const DASHBOARD_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NEAR SOLVER DESK · CavalRe</title>
<style>
:root{
  --bg:#0b0f12;--panel:#12181c;--line:#1c262c;--border:#2a363c;
  --text:#e6edf0;--muted:#7a8b94;--cyan:#2dd4bf;--warn:#eab308;--bad:#f43f5e;
  --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
  --sans:system-ui,-apple-system,"Segoe UI",sans-serif;
}
*{box-sizing:border-box;margin:0}
html,body{height:100%;background:var(--bg);color:var(--text);font:13px/1.4 var(--sans);overflow:hidden}
.shell{height:100%;display:grid;grid-template-rows:48px 1fr 140px;gap:0}
header{display:flex;align-items:center;gap:12px;padding:0 16px;border-bottom:1px solid var(--line);background:#0e1316}
.logo{width:28px;height:28px;background:var(--cyan);color:#042;display:grid;place-items:center;font:700 11px var(--mono);border-radius:4px}
h1{font:600 14px var(--sans)}.h1sub{color:var(--muted);font-weight:400;font-size:12px;margin-left:6px}
.badge{font:600 10px var(--mono);padding:3px 8px;border-radius:3px;text-transform:uppercase}
.badge.dry{background:#422006;color:#fbbf24}.badge.live{background:#064e3b;color:#5eead4}
.right{margin-left:auto;font:12px var(--mono);color:var(--muted)}.right b{color:var(--text)}
#kill{display:none;background:#4c0519;color:#fda4af;padding:8px 16px;font:600 12px var(--mono)}
#kill.on{display:block}
.main{display:grid;grid-template-columns:1fr 1.4fr 1fr;gap:12px;padding:12px 16px;min-height:0;overflow:hidden}
.card{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px 14px;min-height:0;display:flex;flex-direction:column}
.card h2{font:600 11px var(--sans);color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.muted{color:var(--muted);font-size:12px;margin-bottom:8px}
.kv{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--line);font:12px var(--mono)}
.kv:last-child{border:0}.kv .k{color:var(--muted)}.kv .v.warn{color:var(--warn)}.kv .v.ok{color:var(--cyan)}.kv .v.bad{color:var(--bad)}
.bars{flex:1;overflow:auto;display:flex;flex-direction:column;gap:6px}
.bar-row{display:grid;grid-template-columns:96px 1fr 28px;gap:6px;align-items:center;font:11px var(--mono)}
.bar-row .label{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{height:12px;background:#0a0e11;border-radius:2px;overflow:hidden;border:1px solid var(--line)}
.bar-fill{height:100%;min-width:2px;transition:width .3s ease}.bar-fill.quote{background:var(--cyan)}.bar-fill.reject{background:var(--warn)}
.bar-n{text-align:right;font-weight:600}
.funnel{display:flex;flex-direction:column;gap:4px}
.funnel-step{display:grid;grid-template-columns:58px 1fr 32px;gap:6px;align-items:center}
.funnel-step .name{font:600 10px var(--mono);color:var(--muted)}
.funnel-step .track{height:18px;background:#0a0e11;border-radius:2px;border:1px solid var(--line);overflow:hidden}
.funnel-step .fill{height:100%;background:linear-gradient(90deg,#0f766e,var(--cyan));transition:width .3s}
.funnel-step .n{font:700 11px var(--mono);text-align:right}
.funnel-step.active .name{color:var(--cyan)}
.hero-wrap{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px}
#hero{width:100%;flex:1;min-height:180px;background:#05080c;border:1px solid var(--line);border-radius:6px;display:block}
.req-pair{display:flex;align-items:center;justify-content:center;gap:10px;padding:8px;background:#0a0e11;border:1px solid var(--line);border-radius:6px}
.req-pair .sym{font:700 18px var(--sans)}.req-pair .arrow{color:var(--cyan)}
.req-meta{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;font:11px var(--mono);color:var(--muted)}
.req-meta b{color:var(--text)}
.gates{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;align-items:center;margin-top:6px}
.gate{font:600 9px var(--mono);padding:2px 6px;border-radius:3px;border:1px solid var(--border);color:var(--muted);text-transform:uppercase}
.gate.pass{color:var(--cyan);border-color:#115e59;background:#042f2e}
.gate.fail{color:var(--bad);border-color:#9f1239;background:#4c0519}
.gate.wait{color:var(--warn);border-color:#854d0e;background:#422006}
.verdict{font:700 10px var(--mono);padding:3px 8px;border-radius:3px;text-transform:uppercase;border:1px solid}
.verdict.q{color:var(--cyan);border-color:#115e59;background:#042f2e}
.verdict.r{color:var(--warn);border-color:#854d0e;background:#422006}
.verdict.h{color:var(--bad);border-color:#9f1239;background:#4c0519}
.tape-wrap{border-top:1px solid var(--line);background:var(--panel);padding:6px 16px;display:flex;flex-direction:column;min-height:0}
.tape-wrap h2{font:600 11px var(--sans);color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;display:flex;justify-content:space-between}
.tape-wrap h2 span{font:11px var(--mono);font-weight:500;text-transform:none;letter-spacing:0}
#stream{flex:1;overflow:auto;font:12px var(--mono)}
.line{display:grid;grid-template-columns:52px 1fr auto auto;gap:8px;padding:2px 0;border-bottom:1px solid var(--line);align-items:center}
.line .t{color:var(--muted)}.line .pair{font-weight:600}
.chip{font:700 9px var(--mono);padding:2px 5px;border-radius:3px;text-transform:uppercase}
.chip.q{background:#042f2e;color:var(--cyan)}.chip.r{background:#422006;color:var(--warn)}.chip.h{background:#4c0519;color:var(--bad)}
.empty{color:var(--muted);padding:10px;text-align:center}
</style>
</head>
<body>
<div class="shell">
  <header>
    <div class="logo">NS</div>
    <h1>Near Solver Desk<span class="h1sub">CavalRe · dry-run ops</span></h1>
    <span id="mode" class="badge dry">…</span>
    <div class="right">uptime <b id="uptime">—</b> · <span id="clock">—</span></div>
  </header>
  <div id="kill"></div>
  <div class="main">
    <div class="card">
      <h2>Decision mix</h2>
      <p class="muted">Bar length ∝ decide() count.</p>
      <div class="bars" id="bars"></div>
    </div>
    <div class="card">
      <h2>Particle pipeline</h2>
      <div class="hero-wrap">
        <canvas id="hero"></canvas>
        <div id="intentCard"></div>
      </div>
    </div>
    <div class="card">
      <h2>Path funnel</h2>
      <div class="funnel" id="funnel"></div>
      <div style="margin-top:10px">
        <h2>Bus &amp; inventory</h2>
        <div id="bus"></div>
        <div id="inv" style="margin-top:4px"></div>
      </div>
    </div>
  </div>
  <div class="tape-wrap">
    <h2>Decision tape <span id="intentHint">—</span></h2>
    <div id="stream"></div>
  </div>
</div>
<script>
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ============================================================
   Particle system — flow field along stages + decide bursts
   ============================================================ */
const canvas = $('hero');
const ctx = canvas.getContext('2d');
const STAGES = ['BUS', 'SEE', 'MARK', 'DECIDE', 'RISK', 'QUOTE'];
const MAX_P = 420;
const particles = [];
let W = 0, H = 0, dpr = 1;
let lastTs = 0;
let burstUntil = 0;

function resize() {
  const r = canvas.getBoundingClientRect();
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = r.width; H = r.height;
  canvas.width = Math.max(1, Math.floor(W * dpr));
  canvas.height = Math.max(1, Math.floor(H * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
addEventListener('resize', resize);

function stageX(i) {
  const pad = 36;
  return pad + ((W - pad * 2) * i) / (STAGES.length - 1);
}
function midY() { return H * 0.42; }

function hash(n) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function makeParticle(kind, burst) {
  // kind: 1 quote, 0 reject, 2 ambient
  const stage = burst ? 0 : Math.floor(Math.random() * 2);
  const x0 = stageX(stage) + (Math.random() - 0.5) * 20;
  const y0 = midY() + (Math.random() - 0.5) * (burst ? 40 : 80);
  return {
    x: x0, y: y0,
    vx: 40 + Math.random() * 50 + (burst ? 30 : 0),
    vy: (Math.random() - 0.5) * (burst ? 60 : 20),
    life: 1,
    decay: burst ? 0.25 + Math.random() * 0.2 : 0.12 + Math.random() * 0.1,
    r: burst ? 2.2 + Math.random() * 2.5 : 1.2 + Math.random() * 1.8,
    kind,
    trail: [],
    phase: Math.random() * Math.PI * 2,
    seed: Math.random() * 1000,
  };
}

function emit(kind, n) {
  for (let i = 0; i < n && particles.length < MAX_P; i++) {
    particles.push(makeParticle(kind, true));
  }
  burstUntil = performance.now() + 400;
}

function ambientTick(dt) {
  // continuous field density
  const rate = 18; // particles / sec baseline
  const n = Math.floor(rate * dt + Math.random());
  for (let i = 0; i < n && particles.length < MAX_P * 0.7; i++) {
    particles.push(makeParticle(2, false));
  }
}

function integrate(p, dt, t) {
  // target along path: progress by x
  const pad = 36;
  const span = W - pad * 2;
  const u = Math.max(0, Math.min(0.999, (p.x - pad) / span));
  const si = Math.floor(u * (STAGES.length - 1));
  const targetY = midY();

  // attract to conduit + soft lateral noise (curl-ish)
  const noise = Math.sin(p.seed + t * 2.1 + p.x * 0.02) * 28
    + Math.cos(p.seed * 0.7 + t * 1.3) * 12;
  const ay = (targetY + noise - p.y) * 3.5;
  const ax = 8 + Math.sin(t + p.phase) * 4;

  // stage wells: slight slowdown near nodes
  const nodeX = stageX(si);
  const dist = p.x - nodeX;
  if (Math.abs(dist) < 24) {
    p.vx *= 0.97;
    p.vy += Math.sin(t * 6 + p.phase) * 15 * dt;
  }

  p.vx += ax * dt;
  p.vy += ay * dt;
  // damping
  p.vx *= 0.992;
  p.vy *= 0.96;
  // clamp speed
  const spd = Math.hypot(p.vx, p.vy);
  const maxS = p.kind === 2 ? 90 : 140;
  if (spd > maxS) {
    p.vx = (p.vx / spd) * maxS;
    p.vy = (p.vy / spd) * maxS;
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.life -= p.decay * dt;

  // trail
  p.trail.push({ x: p.x, y: p.y });
  if (p.trail.length > 12) p.trail.shift();

  // recycle past QUOTE
  if (p.x > W - 20 || p.life <= 0) return false;
  return true;
}

function colorFor(kind, a) {
  if (kind === 1) return 'rgba(45,212,191,' + a + ')';
  if (kind === 0) return 'rgba(234,179,8,' + a + ')';
  return 'rgba(45,212,191,' + (a * 0.45) + ')';
}

function draw(ts) {
  const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  if (W < 10) { resize(); requestAnimationFrame(draw); return; }

  ambientTick(dt);

  // fade backdrop (motion blur feel)
  ctx.fillStyle = 'rgba(5,8,12,0.22)';
  ctx.fillRect(0, 0, W, H);

  // grid
  ctx.strokeStyle = 'rgba(45,212,191,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 20) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  const my = midY();
  // conduit glow
  const g = ctx.createLinearGradient(0, my - 20, 0, my + 20);
  g.addColorStop(0, 'rgba(45,212,191,0)');
  g.addColorStop(0.5, 'rgba(45,212,191,0.08)');
  g.addColorStop(1, 'rgba(45,212,191,0)');
  ctx.fillStyle = g;
  ctx.fillRect(20, my - 20, W - 40, 40);

  ctx.strokeStyle = 'rgba(45,212,191,0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(36, my);
  ctx.lineTo(W - 36, my);
  ctx.stroke();

  // stages
  const burst = performance.now() < burstUntil;
  for (let i = 0; i < STAGES.length; i++) {
    const x = stageX(i);
    const pulse = 0.5 + 0.5 * Math.sin(ts * 0.004 + i * 0.9);
    const rad = 8 + pulse * 3 + (burst ? 2 : 0);
    ctx.beginPath();
    ctx.arc(x, my, rad + 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(45,212,191,' + (0.05 + pulse * 0.06) + ')';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, my, rad, 0, Math.PI * 2);
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#5a7a74';
    ctx.font = '600 10px ui-monospace,monospace';
    ctx.textAlign = 'center';
    ctx.fillText(STAGES[i], x, my + 26);
  }

  // particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (!integrate(p, dt, ts * 0.001)) {
      particles.splice(i, 1);
      continue;
    }
    // trail
    if (p.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(p.trail[0].x, p.trail[0].y);
      for (let t = 1; t < p.trail.length; t++) ctx.lineTo(p.trail[t].x, p.trail[t].y);
      ctx.strokeStyle = colorFor(p.kind, 0.15 * p.life);
      ctx.lineWidth = p.r * 0.8;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = colorFor(p.kind, Math.max(0.1, p.life));
    ctx.fill();
  }

  // density readout
  ctx.fillStyle = 'rgba(122,139,148,0.7)';
  ctx.font = '10px ui-monospace,monospace';
  ctx.textAlign = 'left';
  ctx.fillText('n=' + particles.length, 10, H - 8);

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

let lastWould = 0, lastReject = 0;

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
function kv(k, v, cls) {
  return '<div class="kv"><span class="k">' + esc(k) + '</span><span class="v ' + (cls || '') + '">' + esc(String(v)) + '</span></div>';
}

function renderBars(counters) {
  const entries = Object.entries(counters || {})
    .map(([k, v]) => [k.replace(/^quote_decision:/, ''), v])
    .sort((a, b) => b[1] - a[1]);
  if (!entries.length) { $('bars').innerHTML = '<div class="empty">No decisions yet</div>'; return; }
  const max = Math.max(...entries.map(([, v]) => v), 1);
  $('bars').innerHTML = entries.map(([k, v]) => {
    const pct = Math.round((v / max) * 100);
    const cls = /would_quote|quoted/.test(k) ? 'quote' : 'reject';
    return '<div class="bar-row"><span class="label" title="' + esc(k) + '">' + esc(k) + '</span>' +
      '<div class="bar-track"><div class="bar-fill ' + cls + '" style="width:' + pct + '%"></div></div>' +
      '<span class="bar-n">' + v + '</span></div>';
  }).join('');
}

function renderFunnel(seen, rejected, quoted, frames) {
  const steps = [
    { name: 'BUS', n: frames, max: Math.max(frames, seen, 1) },
    { name: 'SEE', n: seen, max: Math.max(seen, 1) },
    { name: 'DECIDE', n: seen, max: Math.max(seen, 1) },
    { name: 'REJECT', n: rejected, max: Math.max(seen, 1) },
    { name: 'QUOTE', n: quoted, max: Math.max(seen, 1) },
  ];
  $('funnel').innerHTML = steps.map(s => {
    const pct = Math.max(4, Math.round((s.n / s.max) * 100));
    return '<div class="funnel-step' + (s.n > 0 ? ' active' : '') + '"><span class="name">' + s.name + '</span>' +
      '<div class="track"><div class="fill" style="width:' + pct + '%"></div></div><span class="n">' + s.n + '</span></div>';
  }).join('');
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
  return '<div class="req-pair"><span class="sym">' + esc(o.symIn) + '</span><span class="arrow">→</span><span class="sym">' + esc(o.symOut) + '</span></div>' +
    '<div class="req-meta"><span>Side <b>' + esc(o.side) + '</b></span><span>Deadline ≥ <b>' + (o.minDeadlineMs / 1000) + 's</b></span><span>Spread <b>' + esc(o.spread || '—') + '</b></span></div>' +
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
    ok, verdict: ok ? (dry ? 'Would quote' : 'Quoted') : (d.reason || 'Reject'), sample: false,
  };
}

const SAMPLE = {
  symIn: 'USDC', symOut: 'wNEAR', minDeadlineMs: 60000, side: 'EXACT_IN', spread: null,
  gates: { listed: 'pass', priced: 'wait', inv: 'pass', risk: 'wait' },
  verdict: null, sample: true, ok: false,
};

function render(s, journal) {
  const dry = s.mode === 'dry-run';
  $('mode').textContent = dry ? 'Dry-run' : 'Live';
  $('mode').className = 'badge ' + (dry ? 'dry' : 'live');
  $('uptime').textContent = fmtUptime(s.uptimeMs);
  const kill = $('kill');
  if (s.killSwitch) { kill.className = 'on'; kill.textContent = 'KILL SWITCH — ' + s.killSwitch; }
  else kill.className = '';

  const r = s.relay || {}, frames = r.framesReceived || 0;
  let hc = 'warn', ht = 'No frames (partner key)';
  if (frames > 0) { hc = 'ok'; ht = 'Receiving'; }
  else if (r.reconnects > 0) { hc = 'bad'; ht = 'Reconnect storm'; }
  $('bus').innerHTML = kv('Frames', frames) + kv('Reconnects', r.reconnects || 0) + kv('Status', ht, hc);
  const inv = s.inventory || [];
  $('inv').innerHTML = inv.map(l => kv(l.symbol, fmtAmount(l.availableRaw, l.decimals))).join('') +
    kv('Reserved', s.activeReservations);

  const c = s.counters || {};
  renderBars(c);
  const would = Object.entries(c).filter(([k]) => /would_quote|quoted/.test(k)).reduce((a, [, v]) => a + v, 0);
  const rejects = Object.entries(c).filter(([k]) => k.startsWith('quote_decision:') && !/would_quote|quoted/.test(k)).reduce((a, [, v]) => a + v, 0);
  renderFunnel(would + rejects, rejects, would, frames);

  if (would > lastWould) emit(1, Math.min(40, 12 * (would - lastWould)));
  if (rejects > lastReject) emit(0, Math.min(40, 12 * (rejects - lastReject)));
  lastWould = would; lastReject = rejects;

  const j = journal || [];
  let card = null;
  for (let i = j.length - 1; i >= 0; i--) { card = fromJournal(j[i], dry); if (card) break; }
  if (card) {
    $('intentHint').textContent = card.quoteId || '';
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
    let chip = 'r';
    if (d.shouldQuote) chip = 'q';
    if (/kill|daily_loss/.test(reason || '')) chip = 'h';
    return '<div class="line"><span class="t">' + new Date(e.tMs).toISOString().slice(11, 19) +
      '</span><span class="pair">' + esc(pair) + '</span><span style="color:var(--muted)">' + esc(det) +
      '</span><span class="chip ' + chip + '">' + esc(reason) + '</span></div>';
  }).join('');
  $('stream').innerHTML = rows || '<div class="empty">npm run solver:cover</div>';
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
setTimeout(resize, 50);
</script>
</body>
</html>`;
