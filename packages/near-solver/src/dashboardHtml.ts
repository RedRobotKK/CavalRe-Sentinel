/**
 * NEAR SOLVER DESK — circuit-breaker hero with pass-stream background + glow.
 */

export const DASHBOARD_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NEAR SOLVER DESK · CavalRe</title>
<style>
:root{
  --bg:#07090c;--panel:#0e1318;--line:#1a2228;
  --text:#e8eef0;--muted:#6b7c86;--cyan:#2dd4bf;--amber:#f5a623;--bad:#f43f5e;
  --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
  --sans:system-ui,-apple-system,"Segoe UI",sans-serif;
}
*{box-sizing:border-box;margin:0}
html,body{height:100%;background:var(--bg);color:var(--text);font:13px/1.4 var(--sans);overflow:hidden}
.shell{height:100%;display:grid;grid-template-rows:44px 1fr 128px;gap:0}
header{display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid var(--line);background:#0a0e12}
.logo{width:26px;height:26px;background:var(--amber);color:#1a0a00;display:grid;place-items:center;font:700 10px var(--mono);border-radius:3px;
  box-shadow:0 0 12px rgba(245,166,35,.5);animation:logoPulse 2.4s ease-in-out infinite}
@keyframes logoPulse{0%,100%{box-shadow:0 0 8px rgba(245,166,35,.35)}50%{box-shadow:0 0 18px rgba(245,166,35,.7)}}
h1{font:600 13px var(--sans)}.h1sub{color:var(--muted);font-weight:400;font-size:11px;margin-left:6px}
.badge{font:600 9px var(--mono);padding:2px 7px;border-radius:3px;text-transform:uppercase}
.badge.dry{background:#3d2a00;color:#f5a623;box-shadow:0 0 8px rgba(245,166,35,.25)}.badge.live{background:#064e3b;color:#5eead4}
.right{margin-left:auto;font:11px var(--mono);color:var(--muted)}.right b{color:var(--text)}
#kill{display:none;background:#4c0519;color:#fda4af;padding:6px 14px;font:600 12px var(--mono)}
#kill.on{display:block}
.main{display:grid;grid-template-columns:230px 1fr 230px;gap:10px;padding:10px 12px;min-height:0;overflow:hidden}
.card{background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:10px 12px;min-height:0;display:flex;flex-direction:column}
.card h2{font:600 10px var(--sans);color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px}
.kv{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--line);font:11px var(--mono)}
.kv:last-child{border:0}.kv .k{color:var(--muted)}.kv .v.warn{color:var(--amber)}.kv .v.ok{color:var(--cyan)}.kv .v.bad{color:var(--bad)}
.bars{flex:1;overflow:auto;display:flex;flex-direction:column;gap:5px}
.bar-row{display:grid;grid-template-columns:86px 1fr 24px;gap:5px;align-items:center;font:11px var(--mono)}
.bar-row .label{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}
.bar-track{height:11px;background:#080b0e;border-radius:2px;overflow:hidden;border:1px solid var(--line)}
.bar-fill{height:100%;min-width:2px;transition:width .3s}.bar-fill.quote{background:var(--cyan);box-shadow:0 0 6px rgba(45,212,191,.5)}.bar-fill.reject{background:var(--amber);box-shadow:0 0 6px rgba(245,166,35,.4)}
.bar-n{text-align:right;font-weight:600;font-size:11px}
.funnel{display:flex;flex-direction:column;gap:4px}
.funnel-step{display:grid;grid-template-columns:50px 1fr 26px;gap:5px;align-items:center}
.funnel-step .name{font:600 10px var(--mono);color:var(--muted)}
.funnel-step .track{height:15px;background:#080b0e;border-radius:2px;border:1px solid var(--line);overflow:hidden}
.funnel-step .fill{height:100%;background:linear-gradient(90deg,#7c4a00,var(--amber));box-shadow:0 0 8px rgba(245,166,35,.35);transition:width .3s}
.funnel-step .n{font:700 11px var(--mono);text-align:right}
.funnel-step.active .name{color:var(--amber);text-shadow:0 0 8px rgba(245,166,35,.5)}
.hero-card{background:#05070a;border:1px solid var(--line);border-radius:4px;padding:0;min-height:0;display:flex;flex-direction:column;overflow:hidden;
  box-shadow:inset 0 0 40px rgba(245,166,35,.04),0 0 20px rgba(0,0,0,.4)}
.hero-card h2{padding:8px 12px 0;margin:0;font:600 10px var(--sans);color:var(--muted);text-transform:uppercase;letter-spacing:.07em}
.hero-stage{position:relative;flex:1;min-height:200px}
#hero{position:absolute;inset:0;width:100%;height:100%;display:block}
.pass-bg{position:absolute;inset:0;overflow:hidden;pointer-events:none;opacity:.22;z-index:0}
.pass-bg .col{position:absolute;top:0;font:10px/1.35 var(--mono);color:#f5a623;white-space:pre;animation:scrollUp linear infinite}
@keyframes scrollUp{0%{transform:translateY(0)}100%{transform:translateY(-50%)}}
.intent-bar{position:relative;z-index:2;padding:8px 12px;border-top:1px solid var(--line);background:rgba(14,19,24,.92);backdrop-filter:blur(6px)}
.req-pair{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:4px}
.req-pair .sym{font:700 16px var(--sans)}.req-pair .arrow{color:var(--amber);text-shadow:0 0 10px rgba(245,166,35,.6)}
.req-meta{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;font:10px var(--mono);color:var(--muted)}
.req-meta b{color:var(--text)}
.gates{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;align-items:center;margin-top:6px}
.gate{font:600 9px var(--mono);padding:2px 6px;border-radius:2px;border:1px solid #2a3238;color:var(--muted);text-transform:uppercase}
.gate.pass{color:var(--cyan);border-color:#115e59;background:#042f2e;box-shadow:0 0 8px rgba(45,212,191,.25)}
.gate.fail{color:var(--bad);border-color:#9f1239;background:#4c0519;box-shadow:0 0 8px rgba(244,63,94,.25)}
.gate.wait{color:var(--amber);border-color:#7c4a00;background:#3d2a00}
.verdict{font:700 9px var(--mono);padding:2px 7px;border-radius:2px;text-transform:uppercase;border:1px solid}
.verdict.q{color:var(--cyan);border-color:#115e59;background:#042f2e;box-shadow:0 0 12px rgba(45,212,191,.35)}
.verdict.r{color:var(--amber);border-color:#7c4a00;background:#3d2a00;box-shadow:0 0 12px rgba(245,166,35,.3)}
.verdict.h{color:var(--bad);border-color:#9f1239;background:#4c0519}
.tape-wrap{border-top:1px solid var(--line);background:var(--panel);padding:6px 14px;display:flex;flex-direction:column;min-height:0}
.tape-wrap h2{font:600 10px var(--sans);color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;display:flex;justify-content:space-between}
.tape-wrap h2 span{font:11px var(--mono);font-weight:500;text-transform:none;letter-spacing:0}
#stream{flex:1;overflow:auto;font:11px var(--mono)}
.line{display:grid;grid-template-columns:50px 1fr auto auto;gap:8px;padding:2px 0;border-bottom:1px solid var(--line);align-items:center}
.line .t{color:var(--muted)}.line .pair{font-weight:600}
.chip{font:700 9px var(--mono);padding:1px 5px;border-radius:2px;text-transform:uppercase}
.chip.q{background:#042f2e;color:var(--cyan)}.chip.r{background:#3d2a00;color:var(--amber)}.chip.h{background:#4c0519;color:var(--bad)}
.empty{color:var(--muted);padding:8px;text-align:center}
</style>
</head>
<body>
<div class="shell">
  <header>
    <div class="logo">NS</div>
    <h1>Near Solver Desk<span class="h1sub">CavalRe · circuit path</span></h1>
    <span id="mode" class="badge dry">…</span>
    <div class="right">uptime <b id="uptime">—</b> · <span id="clock">—</span></div>
  </header>
  <div id="kill"></div>
  <div class="main">
    <div class="card">
      <h2>Decision mix</h2>
      <div class="bars" id="bars"></div>
    </div>
    <div class="hero-card">
      <h2>Circuit breaker · edge lights with flow</h2>
      <div class="hero-stage">
        <div class="pass-bg" id="passBg"></div>
        <canvas id="hero"></canvas>
      </div>
      <div class="intent-bar" id="intentCard"></div>
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

/* Pass-stream background — what actually ran through decide() */
const passLines = [];
const MAX_PASS = 80;
function pushPass(line) {
  passLines.unshift(line);
  if (passLines.length > MAX_PASS) passLines.pop();
  renderPassBg();
}
function renderPassBg() {
  const el = $('passBg');
  if (!el) return;
  // 5 scrolling columns of recent pass/reject text
  const cols = 5;
  const per = Math.ceil(passLines.length / cols) || 8;
  let html = '';
  for (let c = 0; c < cols; c++) {
    const slice = passLines.filter((_, i) => i % cols === c);
    while (slice.length < 12) slice.push('· · ·');
    const text = (slice.concat(slice)).join('\n');
    const dur = 18 + c * 3;
    const left = 4 + c * 19;
    html += '<div class="col" style="left:' + left + '%;animation-duration:' + dur + 's">' + esc(text) + '</div>';
  }
  el.innerHTML = html;
}

/* Circuit canvas */
const canvas = $('hero');
const ctx = canvas.getContext('2d');
const STAGES = ['BUS', 'SEE', 'MARK', 'DECIDE', 'RISK', 'QUOTE'];
let counts = { bus: 0, see: 0, mark: 0, decide: 0, risk: 0, quote: 0, drop: 0 };
let stageHeat = STAGES.map(() => 0);
const linkParticles = [];
const MAX_LP = 320;
let W = 0, H = 0, dpr = 1, lastTs = 0;
let floatingTags = [];
let bloomPulse = 0;

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

function boxLayout() {
  const n = STAGES.length;
  const padX = 24;
  const boxW = Math.min(76, (W - padX * 2) / n - 10);
  const boxH = 62;
  const gap = (W - padX * 2 - boxW * n) / Math.max(1, n - 1);
  const y = H * 0.40 - boxH / 2;
  return STAGES.map((_, i) => ({
    x: padX + i * (boxW + gap),
    y, w: boxW, h: boxH,
    cx: padX + i * (boxW + gap) + boxW / 2,
    cy: y + boxH / 2,
  }));
}

function spawnLink(from, to, ok) {
  if (linkParticles.length >= MAX_LP) return;
  linkParticles.push({
    a: from, b: to, t: 0,
    speed: 0.5 + Math.random() * 0.4,
    ok, amp: 6 + Math.random() * 16,
    phase: Math.random() * Math.PI * 2,
  });
}

function emitFlow(ok) {
  bloomPulse = 1;
  for (let i = 0; i < STAGES.length - 1; i++) {
    setTimeout(() => {
      for (let k = 0; k < 4; k++) spawnLink(i, i + 1, ok);
      stageHeat[i] = 1;
      if (i === STAGES.length - 2) stageHeat[i + 1] = 1;
    }, i * 60);
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function draw(ts) {
  const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  if (W < 10) { resize(); requestAnimationFrame(draw); return; }

  ctx.fillStyle = 'rgba(5,7,10,0.55)';
  ctx.fillRect(0, 0, W, H);

  // soft vignette
  const vg = ctx.createRadialGradient(W/2, H*0.45, 20, W/2, H*0.45, Math.max(W,H)*0.7);
  vg.addColorStop(0, 'rgba(245,166,35,0.03)');
  vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // floor grid
  ctx.strokeStyle = 'rgba(245,166,35,0.05)';
  ctx.lineWidth = 1;
  const hz = H * 0.7;
  for (let i = 0; i < 10; i++) {
    const y = hz + i * i * 2;
    if (y > H) break;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(W/2 + i*36, hz);
    ctx.lineTo(W/2 + i*80, H);
    ctx.stroke();
  }

  // rings
  ctx.strokeStyle = 'rgba(245,166,35,' + (0.08 + bloomPulse * 0.12) + ')';
  ctx.beginPath(); ctx.ellipse(W/2, H*0.46, W*0.4, H*0.2, 0, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(W/2, H*0.46, W*0.3, H*0.14, 0, 0, Math.PI*2); ctx.stroke();

  const boxes = boxLayout();
  for (let i = 0; i < stageHeat.length; i++) stageHeat[i] = Math.max(0, stageHeat[i] - dt * 0.5);
  bloomPulse = Math.max(0, bloomPulse - dt * 0.4);

  // particles on sine links
  for (let i = linkParticles.length - 1; i >= 0; i--) {
    const p = linkParticles[i];
    p.t += p.speed * dt;
    if (p.t >= 1) { linkParticles.splice(i, 1); continue; }
    const A = boxes[p.a], B = boxes[p.b];
    const x = A.cx + (B.cx - A.cx) * p.t;
    const y = A.cy + (B.cy - A.cy) * p.t + Math.sin(p.t * Math.PI * 2 + p.phase) * p.amp * Math.sin(p.t * Math.PI);
    const a = Math.sin(p.t * Math.PI);
    // glow core
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = p.ok ? 'rgba(45,212,191,' + (0.3*a) + ')' : 'rgba(245,166,35,' + (0.3*a) + ')';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = p.ok ? 'rgba(45,212,191,' + (0.6+0.4*a) + ')' : 'rgba(255,200,80,' + (0.6+0.4*a) + ')';
    ctx.fill();
  }
  if (Math.random() < 0.1) {
    const i = Math.floor(Math.random() * (STAGES.length - 1));
    spawnLink(i, i + 1, Math.random() > 0.35);
  }

  const vals = [counts.bus, counts.see, counts.mark, counts.decide, counts.risk, counts.quote];
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const heat = stageHeat[i];
    const live = vals[i] > 0;

    // bloom halo
    if (heat > 0.05) {
      ctx.save();
      ctx.shadowColor = 'rgba(245,166,35,' + (0.45 + heat * 0.5) + ')';
      ctx.shadowBlur = 24 + heat * 30;
      roundRect(b.x, b.y, b.w, b.h, 4);
      ctx.fillStyle = 'rgba(245,166,35,0.08)';
      ctx.fill();
      ctx.restore();
    }

    const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    if (heat > 0.25) {
      grad.addColorStop(0, '#6b450c'); grad.addColorStop(1, '#2e1a00');
    } else if (live) {
      grad.addColorStop(0, '#3d2a00'); grad.addColorStop(1, '#1a1200');
    } else {
      grad.addColorStop(0, '#18140e'); grad.addColorStop(1, '#0c0a08');
    }
    roundRect(b.x, b.y, b.w, b.h, 4);
    ctx.fillStyle = grad;
    ctx.fill();

    // circuit edge
    ctx.strokeStyle = heat > 0.08
      ? 'rgba(255,200,80,' + (0.55 + heat * 0.45) + ')'
      : live ? 'rgba(245,166,35,0.6)' : 'rgba(245,166,35,0.22)';
    ctx.lineWidth = heat > 0.08 ? 2.4 : 1.2;
    roundRect(b.x, b.y, b.w, b.h, 4);
    ctx.stroke();

    // top phosphor line
    ctx.strokeStyle = 'rgba(255,220,120,' + (0.2 + heat * 0.5) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x + 5, b.y + 1.5);
    ctx.lineTo(b.x + b.w - 5, b.y + 1.5);
    ctx.stroke();

    ctx.fillStyle = heat > 0.2 ? '#ffe099' : '#c4892a';
    ctx.font = '700 10px ui-monospace,monospace';
    ctx.textAlign = 'center';
    ctx.fillText(STAGES[i], b.cx, b.y + 17);

    ctx.fillStyle = '#fff0c8';
    ctx.font = '700 17px ui-monospace,monospace';
    ctx.fillText(String(vals[i]), b.cx, b.y + 38);

    ctx.font = '600 8px ui-monospace,monospace';
    if (i === 3 && counts.drop > 0) {
      ctx.fillStyle = '#f43f5e';
      ctx.fillText('DROP -' + counts.drop, b.cx, b.y + b.h - 7);
    } else if (vals[i] > 0) {
      ctx.fillStyle = 'rgba(45,212,191,0.75)';
      ctx.fillText('PASS', b.cx, b.y + b.h - 7);
    } else {
      ctx.fillStyle = 'rgba(107,124,134,0.45)';
      ctx.fillText('—', b.cx, b.y + b.h - 7);
    }
  }

  // floating tags
  for (let i = floatingTags.length - 1; i >= 0; i--) {
    const t = floatingTags[i];
    t.life -= dt; t.y -= 14 * dt;
    if (t.life <= 0) { floatingTags.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, t.life);
    const tw = ctx.measureText(t.text).width + 12;
    roundRect(t.x - tw/2, t.y - 9, tw, 16, 3);
    ctx.fillStyle = 'rgba(20,14,8,0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(245,166,35,0.5)';
    ctx.lineWidth = 1;
    roundRect(t.x - tw/2, t.y - 9, tw, 16, 3);
    ctx.stroke();
    ctx.fillStyle = '#f5a623';
    ctx.font = '600 10px ui-monospace,monospace';
    ctx.textAlign = 'center';
    ctx.fillText(t.text, t.x, t.y + 2);
    ctx.globalAlpha = 1;
  }

  // scanline overlay
  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

function pushTag(text) {
  floatingTags.push({ text, life: 3.5, x: 70 + Math.random()*50, y: 36 + Math.random()*24 });
}

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
  if (!entries.length) { $('bars').innerHTML = '<div class="empty">—</div>'; return; }
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
  const seen = would + rejects;
  renderFunnel(seen, rejects, would, frames);

  counts.bus = frames || seen;
  counts.see = seen; counts.mark = seen; counts.decide = seen; counts.risk = seen;
  counts.quote = would; counts.drop = rejects;

  if (would > lastWould) emitFlow(true);
  if (rejects > lastReject) {
    emitFlow(false);
    const top = Object.entries(c)
      .filter(([k]) => k.startsWith('quote_decision:') && !/would_quote|quoted/.test(k))
      .sort((a, b) => b[1] - a[1])[0];
    if (top) pushTag(top[0].replace(/^quote_decision:/, ''));
  }
  lastWould = would; lastReject = rejects;

  const j = journal || [];
  // feed pass-stream from journal
  const recent = j.filter(e => e.type === 'quote_decision').slice(-40);
  if (recent.length) {
    passLines.length = 0;
    recent.forEach(e => {
      const d = e.decision, ev = e.event;
      const pair = symOf(ev.assetIn) + '→' + symOf(ev.assetOut);
      const reason = d.shouldQuote ? (dry ? 'WOULD_QUOTE' : 'QUOTED') : (d.reason || 'REJECT');
      const det = d.shouldQuote ? (d.totalSpreadBps + 'bps') : '';
      pushPass(pair + '  ' + reason + (det ? '  ' + det : ''));
    });
  }

  let card = null;
  for (let i = j.length - 1; i >= 0; i--) { card = fromJournal(j[i], dry); if (card) break; }
  if (card) {
    $('intentHint').textContent = card.quoteId || '';
    $('intentCard').innerHTML = renderIntent(card);
  } else {
    $('intentHint').textContent = 'idle';
    $('intentCard').innerHTML = renderIntent(SAMPLE);
  }

  const rows = j.slice(-28).reverse().map(e => {
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
