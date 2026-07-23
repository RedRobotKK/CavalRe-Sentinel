/**
 * NEAR SOLVER DESK — data bars + funnel + center hero pipeline canvas.
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
.shell{height:100%;display:grid;grid-template-rows:48px 1fr 150px;gap:0}
header{display:flex;align-items:center;gap:12px;padding:0 16px;border-bottom:1px solid var(--line);background:#0e1316}
.logo{width:28px;height:28px;background:var(--cyan);color:#042;display:grid;place-items:center;font:700 11px var(--mono);border-radius:4px}
h1{font:600 14px var(--sans)}.h1sub{color:var(--muted);font-weight:400;font-size:12px;margin-left:6px}
.badge{font:600 10px var(--mono);padding:3px 8px;border-radius:3px;text-transform:uppercase}
.badge.dry{background:#422006;color:#fbbf24}.badge.live{background:#064e3b;color:#5eead4}
.right{margin-left:auto;font:12px var(--mono);color:var(--muted)}.right b{color:var(--text)}
#kill{display:none;background:#4c0519;color:#fda4af;padding:8px 16px;font:600 12px var(--mono)}
#kill.on{display:block}
.main{display:grid;grid-template-columns:1fr 1.35fr 1fr;gap:12px;padding:12px 16px;min-height:0;overflow:hidden}
.card{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:14px 16px;min-height:0;display:flex;flex-direction:column}
.card h2{font:600 11px var(--sans);color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;flex:0 0 auto}
.muted{color:var(--muted);font-size:12px;line-height:1.45;margin-bottom:10px}
.kv{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--line);font:12px var(--mono)}
.kv:last-child{border:0}.kv .k{color:var(--muted)}.kv .v.warn{color:var(--warn)}.kv .v.ok{color:var(--cyan)}.kv .v.bad{color:var(--bad)}
.bars{flex:1;display:flex;flex-direction:column;gap:7px;min-height:0;overflow:auto}
.bar-row{display:grid;grid-template-columns:100px 1fr 32px;gap:8px;align-items:center;font:12px var(--mono)}
.bar-row .label{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}
.bar-track{height:13px;background:#0a0e11;border-radius:2px;overflow:hidden;border:1px solid var(--line)}
.bar-fill{height:100%;border-radius:2px;min-width:2px;transition:width .3s ease}
.bar-fill.reject{background:var(--warn)}.bar-fill.quote{background:var(--cyan)}
.bar-n{text-align:right;font-weight:600}
.funnel{display:flex;flex-direction:column;gap:5px}
.funnel-step{display:grid;grid-template-columns:64px 1fr 36px;gap:8px;align-items:center}
.funnel-step .name{font:600 11px var(--mono);color:var(--muted)}
.funnel-step .track{height:22px;background:#0a0e11;border-radius:3px;border:1px solid var(--line);overflow:hidden}
.funnel-step .fill{height:100%;background:linear-gradient(90deg,#0f766e,var(--cyan));transition:width .35s ease}
.funnel-step .n{font:700 12px var(--mono);text-align:right}
.funnel-step.active .name{color:var(--cyan)}

/* HERO */
.hero-wrap{flex:1;min-height:0;display:flex;flex-direction:column;gap:10px}
#hero{width:100%;flex:1;min-height:160px;background:#070b0e;border:1px solid var(--line);border-radius:6px;display:block}
.req-pair{display:flex;align-items:center;justify-content:center;gap:12px;padding:10px;background:#0a0e11;border:1px solid var(--line);border-radius:6px}
.req-pair .sym{font:700 20px var(--sans)}.req-pair .arrow{color:var(--cyan);font-size:18px}
.req-meta{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;font:11px var(--mono);color:var(--muted)}
.req-meta b{color:var(--text)}
.gates{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;align-items:center;margin-top:8px}
.gate{font:600 9px var(--mono);padding:3px 7px;border-radius:3px;background:#0a0e11;border:1px solid var(--border);color:var(--muted);text-transform:uppercase}
.gate.pass{color:var(--cyan);border-color:#115e59;background:#042f2e}
.gate.fail{color:var(--bad);border-color:#9f1239;background:#4c0519}
.gate.wait{color:var(--warn);border-color:#854d0e;background:#422006}
.verdict{font:700 10px var(--mono);padding:4px 9px;border-radius:3px;text-transform:uppercase;border:1px solid}
.verdict.q{color:var(--cyan);border-color:#115e59;background:#042f2e}
.verdict.r{color:var(--warn);border-color:#854d0e;background:#422006}
.verdict.h{color:var(--bad);border-color:#9f1239;background:#4c0519}

.tape-wrap{border-top:1px solid var(--line);background:var(--panel);padding:8px 16px;display:flex;flex-direction:column;min-height:0}
.tape-wrap h2{font:600 11px var(--sans);color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;display:flex;justify-content:space-between}
.tape-wrap h2 span{font:11px var(--mono);font-weight:500;text-transform:none;letter-spacing:0}
#stream{flex:1;overflow:auto;font:12px var(--mono)}
.line{display:grid;grid-template-columns:56px 1fr auto auto;gap:10px;padding:3px 0;border-bottom:1px solid var(--line);align-items:center}
.line .t{color:var(--muted)}.line .pair{font-weight:600}
.chip{font:700 10px var(--mono);padding:2px 6px;border-radius:3px;text-transform:uppercase}
.chip.q{background:#042f2e;color:var(--cyan)}.chip.r{background:#422006;color:var(--warn)}.chip.h{background:#4c0519;color:var(--bad)}
.empty{color:var(--muted);padding:12px;text-align:center}
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
      <p class="muted">Longer bar = more of that decide() reason.</p>
      <div class="bars" id="bars"></div>
    </div>
    <div class="card">
      <h2>Pipeline · ingest → decide → out</h2>
      <div class="hero-wrap">
        <canvas id="hero"></canvas>
        <div id="intentCard"></div>
      </div>
    </div>
    <div class="card">
      <h2>Path funnel</h2>
      <div class="funnel" id="funnel"></div>
      <div style="margin-top:12px">
        <h2>Bus &amp; inventory</h2>
        <div id="bus"></div>
        <div id="inv" style="margin-top:6px"></div>
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

/* ---- HERO canvas: packets through labeled stages ---- */
const hero = $('hero');
const hctx = hero.getContext('2d');
const STAGES = ['BUS', 'SEE', 'MARK', 'DECIDE', 'RISK', 'QUOTE'];
const packets = [];
let heroFlash = 0; // 0..1 burst intensity

function resizeHero() {
  const r = hero.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  hero.width = Math.max(1, Math.floor(r.width * dpr));
  hero.height = Math.max(1, Math.floor(r.height * dpr));
  hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeHero();
addEventListener('resize', resizeHero);

function spawnPacket(ok) {
  packets.push({
    t: 0,
    speed: 0.28 + Math.random() * 0.2,
    ok,
    yOff: (Math.random() - 0.5) * 16,
  });
}

function drawHero(ts) {
  const w = hero.getBoundingClientRect().width;
  const h = hero.getBoundingClientRect().height;
  if (w < 10 || h < 10) { requestAnimationFrame(drawHero); return; }
  hctx.clearRect(0, 0, w, h);

  // background grid
  hctx.strokeStyle = 'rgba(45,212,191,0.06)';
  hctx.lineWidth = 1;
  for (let x = 0; x < w; x += 24) {
    hctx.beginPath(); hctx.moveTo(x, 0); hctx.lineTo(x, h); hctx.stroke();
  }
  for (let y = 0; y < h; y += 24) {
    hctx.beginPath(); hctx.moveTo(0, y); hctx.lineTo(w, y); hctx.stroke();
  }

  const pad = 28;
  const midY = h * 0.48;
  const span = w - pad * 2;
  const n = STAGES.length;

  // conduit
  hctx.strokeStyle = 'rgba(45,212,191,0.25)';
  hctx.lineWidth = 3;
  hctx.beginPath();
  hctx.moveTo(pad, midY);
  hctx.lineTo(pad + span, midY);
  hctx.stroke();

  // stage nodes
  for (let i = 0; i < n; i++) {
    const x = pad + (span * i) / (n - 1);
    const pulse = 0.55 + 0.2 * Math.sin(ts * 0.003 + i);
    const r = 9 + (heroFlash > 0 ? heroFlash * 3 : 0);
    hctx.beginPath();
    hctx.arc(x, midY, r, 0, Math.PI * 2);
    hctx.fillStyle = 'rgba(45,212,191,' + (0.15 + pulse * 0.2) + ')';
    hctx.fill();
    hctx.strokeStyle = '#2dd4bf';
    hctx.lineWidth = 2;
    hctx.stroke();
    hctx.fillStyle = '#7a8b94';
    hctx.font = '600 10px ui-monospace, monospace';
    hctx.textAlign = 'center';
    hctx.fillText(STAGES[i], x, midY + 28);
  }

  // packets
  for (let i = packets.length - 1; i >= 0; i--) {
    const p = packets[i];
    p.t += p.speed * 0.016;
    if (p.t >= 1) { packets.splice(i, 1); continue; }
    const x = pad + span * p.t;
    const y = midY + p.yOff * Math.sin(p.t * Math.PI);
    const alpha = 0.35 + 0.65 * Math.sin(p.t * Math.PI);
    hctx.beginPath();
    hctx.arc(x, y, 5, 0, Math.PI * 2);
    hctx.fillStyle = p.ok
      ? 'rgba(45,212,191,' + alpha + ')'
      : 'rgba(234,179,8,' + alpha + ')';
    hctx.fill();
    // trail
    hctx.beginPath();
    hctx.moveTo(x - 14, y);
    hctx.lineTo(x, y);
    hctx.strokeStyle = p.ok
      ? 'rgba(45,212,191,' + (alpha * 0.4) + ')'
      : 'rgba(234,179,8,' + (alpha * 0.4) + ')';
    hctx.lineWidth = 2;
    hctx.stroke();
  }

  if (heroFlash > 0) heroFlash = Math.max(0, heroFlash - 0.02);

  // idle trickle so fullscreen never dies
  if (Math.random() < 0.012) spawnPacket(Math.random() > 0.4);

  requestAnimationFrame(drawHero);
}
requestAnimationFrame(drawHero);

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
  if (!entries.length) {
    $('bars').innerHTML = '<div class="empty">No decisions yet</div>';
    return;
  }
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
      '<div class="track"><div class="fill" style="width:' + pct + '%"></div></div>' +
      '<span class="n">' + s.n + '</span></div>';
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

  if (would > lastWould) {
    for (let i = 0; i < Math.min(6, would - lastWould); i++) spawnPacket(true);
    heroFlash = 1;
  }
  if (rejects > lastReject) {
    for (let i = 0; i < Math.min(6, rejects - lastReject); i++) spawnPacket(false);
    heroFlash = 1;
  }
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

  const rows = j.slice(-36).reverse().map(e => {
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
setTimeout(resizeHero, 100);
</script>
</body>
</html>`;
