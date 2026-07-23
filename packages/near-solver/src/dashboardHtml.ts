/**
 * INTENT HUD — suit cockpit for NEAR Intents solver.
 * Zero build, localhost GET-only. Intent is the primary visual object.
 */

export const DASHBOARD_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>INTENT HUD · CavalRe</title>
<style>
:root {
  --void:#02050a; --panel:rgba(4,18,22,.88); --line:rgba(0,230,190,.32);
  --glow:rgba(0,255,210,.45); --cyan:#00f5d0; --ice:#7af0ff; --warn:#ffc14a;
  --danger:#ff4d6a; --text:#e2fff8; --muted:#4d7a72;
  --mono:"SF Mono",ui-monospace,Menlo,monospace; --sans:system-ui,"Segoe UI",sans-serif;
}
*{box-sizing:border-box;margin:0}
html,body{height:100%;background:var(--void);color:var(--text);font:13px/1.45 var(--sans)}
.stage{min-height:100vh;position:relative;background:
  radial-gradient(ellipse 90% 55% at 50% -5%,rgba(0,90,75,.28),transparent 55%),
  radial-gradient(circle at 80% 100%,rgba(0,40,70,.25),transparent 45%),var(--void)}
.stage::before{content:"";position:absolute;inset:0;opacity:.1;pointer-events:none;
  background-image:linear-gradient(rgba(0,245,208,.07) 1px,transparent 1px),
  linear-gradient(90deg,rgba(0,245,208,.07) 1px,transparent 1px);background-size:40px 40px;
  mask-image:radial-gradient(ellipse at 50% 40%,#000 15%,transparent 70%)}
.reticle{position:absolute;left:50%;top:38%;width:min(70vw,480px);height:min(70vw,480px);
  transform:translate(-50%,-50%);opacity:.14;pointer-events:none}
.reticle svg{width:100%;height:100%}
.shell{position:relative;z-index:2;max-width:1120px;margin:0 auto;padding:14px 14px 36px}

.beam{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;margin-bottom:12px;
  border:1px solid var(--line);background:linear-gradient(90deg,rgba(0,50,42,.95),rgba(4,14,22,.95));
  clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px))}
.sigil{width:30px;height:30px;border:1px solid var(--cyan);display:grid;place-items:center;
  font:700 9px var(--mono);color:var(--cyan);box-shadow:0 0 18px var(--glow),inset 0 0 10px rgba(0,245,208,.2)}
.title{font:650 13px var(--mono);letter-spacing:1.4px;text-transform:uppercase}
.title span{color:var(--muted);font-weight:500}
.tag{font:700 9px var(--mono);letter-spacing:1px;text-transform:uppercase;padding:3px 9px;border:1px solid}
.tag.dry{color:var(--warn);border-color:rgba(255,193,74,.45);background:rgba(50,35,0,.45)}
.tag.live{color:var(--cyan);border-color:var(--glow);background:rgba(0,55,48,.5)}
.tag.canon{color:var(--ice);border-color:rgba(122,240,255,.3)}
.beam-r{margin-left:auto;display:flex;gap:12px;font:11px var(--mono);color:var(--muted)}
.beam-r strong{color:var(--cyan)}

#kill{display:none;margin-bottom:10px;padding:12px 14px;border:1px solid var(--danger);
  background:rgba(50,6,14,.9);color:var(--danger);font:650 12px var(--mono);letter-spacing:.5px;
  box-shadow:0 0 28px rgba(255,77,106,.22)}
#kill.on{display:block}

.top{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px}
@media(max-width:860px){.top{grid-template-columns:1fr}}
.pod{background:var(--panel);border:1px solid var(--line);padding:11px 12px;position:relative;backdrop-filter:blur(8px)}
.pod::before{content:"";position:absolute;top:0;left:10px;right:10px;height:1px;
  background:linear-gradient(90deg,transparent,var(--cyan),transparent);opacity:.75}
.pod h2{font:650 9px var(--mono);letter-spacing:1.5px;text-transform:uppercase;color:var(--cyan);margin-bottom:8px}
.metric{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(0,70,60,.3);font:12px var(--mono)}
.metric:last-child{border:0}.metric .k{color:var(--muted);font-size:10px}.metric .v.ok{color:var(--cyan)}
.metric .v.warn{color:var(--warn)}.metric .v.bad{color:var(--danger)}
.bar-row{margin-bottom:7px}.bar-lab{display:flex;justify-content:space-between;font:10px var(--mono);color:var(--muted);margin-bottom:2px}
.bar-lab strong{color:var(--text)}.bar{height:3px;background:rgba(0,35,32,.9);border:1px solid var(--line)}
.bar>i{display:block;height:100%;background:linear-gradient(90deg,#0a4a40,var(--cyan));box-shadow:0 0 8px var(--glow)}

/* INTENT CARD — primary object */
.intent-stage{margin-bottom:12px}
.intent-stage>h2{font:650 9px var(--mono);letter-spacing:1.6px;text-transform:uppercase;color:var(--cyan);
  margin-bottom:8px;display:flex;justify-content:space-between;align-items:center}
.intent-stage>h2 .hint{color:var(--muted);font-weight:500;letter-spacing:.6px}
.intent-grid{display:grid;grid-template-columns:1.4fr .9fr;gap:10px}
@media(max-width:860px){.intent-grid{grid-template-columns:1fr}}

.icard{
  position:relative;padding:0;border:1px solid var(--line);
  background:linear-gradient(145deg,rgba(0,40,36,.55),rgba(2,12,18,.92));
  box-shadow:0 0 40px rgba(0,245,208,.06),inset 0 0 60px rgba(0,245,208,.03);
  overflow:hidden;
}
.icard.sample{border-style:dashed;border-color:rgba(255,193,74,.35)}
.icard::after{
  content:"";position:absolute;inset:-1px;pointer-events:none;
  background:linear-gradient(105deg,transparent 40%,rgba(0,245,208,.07) 50%,transparent 60%);
  animation:sweep 4.5s ease-in-out infinite;
}
@keyframes sweep{0%,100%{transform:translateX(-30%)}50%{transform:translateX(30%)}}
.icard-top{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  padding:10px 14px;border-bottom:1px solid rgba(0,80,70,.4);
  background:rgba(0,30,28,.45);
}
.icard-top .kind{font:700 9px var(--mono);letter-spacing:1.2px;color:var(--cyan);text-transform:uppercase}
.icard-top .sample-badge{
  font:700 8px var(--mono);letter-spacing:.8px;color:var(--warn);
  border:1px solid rgba(255,193,74,.4);padding:2px 7px;background:rgba(40,30,0,.5)
}
.icard-top .qid{font:11px var(--mono);color:var(--ice);margin-left:auto}
.icard-body{padding:14px 14px 12px;display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center}
.leg{padding:10px 12px;border:1px solid rgba(0,200,170,.2);background:rgba(0,25,22,.5)}
.leg .dir{font:700 8px var(--mono);letter-spacing:1.2px;color:var(--muted);margin-bottom:4px}
.leg .sym{font:700 16px var(--mono);color:var(--text)}
.leg .amt{font:12px var(--mono);color:var(--cyan);margin-top:4px}
.leg .raw{font:9px var(--mono);color:var(--muted);margin-top:2px;word-break:break-all}
.swap-glyph{
  width:44px;height:44px;border-radius:50%;border:1px solid var(--cyan);
  display:grid;place-items:center;font:700 14px var(--mono);color:var(--cyan);
  box-shadow:0 0 20px var(--glow);background:rgba(0,40,36,.8)
}
.icard-meta{
  display:grid;grid-template-columns:repeat(4,1fr);gap:0;
  border-top:1px solid rgba(0,80,70,.4);
}
.icard-meta .cell{padding:8px 10px;border-right:1px solid rgba(0,80,70,.35)}
.icard-meta .cell:last-child{border:0}
.icard-meta .lbl{font:8px var(--mono);letter-spacing:1px;color:var(--muted);text-transform:uppercase}
.icard-meta .val{font:11px var(--mono);color:var(--text);margin-top:2px}
.icard-foot{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  padding:8px 12px;border-top:1px solid rgba(0,80,70,.4);background:rgba(0,20,18,.4)
}
.gate{font:700 8px var(--mono);letter-spacing:.6px;padding:2px 7px;border:1px solid var(--line);color:var(--muted);text-transform:uppercase}
.gate.pass{color:var(--cyan);border-color:var(--glow)}
.gate.fail{color:var(--danger);border-color:rgba(255,77,106,.5)}
.gate.wait{color:var(--warn);border-color:rgba(255,193,74,.4)}
.verdict{
  margin-left:auto;font:700 10px var(--mono);letter-spacing:1px;text-transform:uppercase;
  padding:4px 10px;border:1px solid
}
.verdict.q{color:var(--cyan);border-color:var(--glow);background:rgba(0,50,42,.5)}
.verdict.r{color:var(--warn);border-color:rgba(255,193,74,.4);background:rgba(40,30,0,.4)}
.verdict.h{color:var(--danger);border-color:rgba(255,77,106,.5)}

.side-stack{display:flex;flex-direction:column;gap:10px}
.ring-pod{flex:1;background:var(--panel);border:1px solid var(--line);display:flex;flex-direction:column;
  align-items:center;justify-content:center;padding:14px;min-height:140px}
.ring{width:100px;height:100px;position:relative}
.ring svg{transform:rotate(-90deg);width:100%;height:100%}
.ring-c{position:absolute;inset:0;display:grid;place-items:center;text-align:center;font-family:var(--mono)}
.ring-c .big{font-size:20px;font-weight:700;color:var(--cyan)}
.ring-c .sub{font-size:8px;letter-spacing:1px;color:var(--muted);text-transform:uppercase}
.ring-cap{margin-top:8px;font:9px var(--mono);color:var(--muted);letter-spacing:1px;text-transform:uppercase}
.flow-mini{background:var(--panel);border:1px solid var(--line);padding:10px}
.flow-mini h2{font:650 9px var(--mono);letter-spacing:1.4px;text-transform:uppercase;color:var(--cyan);margin-bottom:8px}
.flow{display:flex;align-items:center;gap:3px;flex-wrap:wrap}
.node{flex:1;min-width:48px;text-align:center;padding:6px 2px;border:1px solid rgba(0,200,170,.2);
  background:rgba(0,25,22,.5);font-family:var(--mono)}
.node .n{font-size:8px;letter-spacing:.8px;color:var(--muted);text-transform:uppercase}
.node .c{font-size:13px;font-weight:700;color:var(--ice);margin-top:2px}
.node.active{border-color:var(--cyan);box-shadow:0 0 10px rgba(0,245,208,.2)}
.arrow{color:var(--cyan);opacity:.5;font-size:11px}

.tape{border:1px solid var(--line);background:rgba(1,8,10,.95);min-height:180px}
.tape-head{display:flex;justify-content:space-between;padding:7px 12px;border-bottom:1px solid var(--line);
  background:rgba(0,28,26,.5);font:650 9px var(--mono);letter-spacing:1.4px;text-transform:uppercase;color:var(--cyan)}
.tape-head .hint{color:var(--muted);font-weight:500}
#stream{padding:6px;max-height:260px;overflow:auto;font-family:var(--mono);font-size:11.5px}
.entry{display:grid;grid-template-columns:50px 1fr auto auto;gap:8px;padding:5px 8px;border-left:2px solid transparent}
.entry:hover{background:rgba(0,245,208,.04)}
.entry.q{border-left-color:var(--cyan)}.entry.r{border-left-color:var(--warn)}.entry.h{border-left-color:var(--danger)}
.entry .t{color:var(--muted)}.entry .pair{font-weight:600}.entry .det{color:var(--muted)}
.chip{font:700 8px var(--mono);letter-spacing:.4px;padding:2px 6px;text-transform:uppercase;border:1px solid}
.chip.q{color:var(--cyan);border-color:var(--glow)}.chip.r{color:var(--warn);border-color:rgba(255,193,74,.4)}
.chip.h{color:var(--danger);border-color:rgba(255,77,106,.5)}.chip.i{color:var(--ice);border-color:rgba(122,240,255,.35)}
.empty{text-align:center;padding:36px;color:var(--muted);font:11px var(--mono)}
.pulse{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--cyan);margin-right:6px;
  box-shadow:0 0 10px var(--cyan);animation:pulse 1.5s ease-in-out infinite;vertical-align:middle}
@keyframes pulse{0%,100%{opacity:.25}50%{opacity:1}}
footer{margin-top:10px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;
  font:9px var(--mono);color:var(--muted);letter-spacing:.4px}
.amount[title]{cursor:help;border-bottom:1px dotted var(--muted)}
</style>
</head>
<body>
<div class="stage">
  <div class="reticle" aria-hidden="true">
    <svg viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="100" r="94" stroke="#00f5d0" stroke-width=".35" opacity=".5"/>
      <circle cx="100" cy="100" r="72" stroke="#00f5d0" stroke-width=".3" stroke-dasharray="3 5" opacity=".4"/>
      <circle cx="100" cy="100" r="48" stroke="#7af0ff" stroke-width=".3" opacity=".3"/>
      <path d="M100 6 L100 26 M100 174 L100 194 M6 100 L26 100 M174 100 L194 100" stroke="#00f5d0" stroke-width=".55" opacity=".45"/>
    </svg>
  </div>
  <div class="shell">
    <div class="beam">
      <div class="sigil">IH</div>
      <div class="title">Intent HUD <span>· Near Solver</span></div>
      <span id="mode" class="tag dry">…</span>
      <span class="tag canon">CANON · VIEW</span>
      <div class="beam-r"><span>UP <strong id="uptime">—</strong></span><span id="clock">—</span></div>
    </div>
    <div id="kill"></div>

    <div class="top">
      <div class="pod"><h2>Bus link</h2><div id="bus"></div></div>
      <div class="pod"><h2>Inventory power</h2><div id="inv"></div></div>
      <div class="pod"><h2>Decision mass</h2><div id="counters"></div></div>
    </div>

    <div class="intent-stage">
      <h2><span>Active intent object</span><span class="hint" id="intentHint">—</span></h2>
      <div class="intent-grid">
        <div id="intentCard"></div>
        <div class="side-stack">
          <div class="ring-pod">
            <div class="ring">
              <svg viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(0,70,60,.55)" stroke-width="2"/>
                <circle id="ringArc" cx="18" cy="18" r="15.5" fill="none" stroke="#00f5d0" stroke-width="2.2"
                  stroke-linecap="round" stroke-dasharray="0 100" pathLength="100"
                  style="filter:drop-shadow(0 0 3px #00f5d0)"/>
              </svg>
              <div class="ring-c"><div class="big" id="ringBig">0</div><div class="sub">frames</div></div>
            </div>
            <div class="ring-cap" id="ringCap">bus silent</div>
          </div>
          <div class="flow-mini">
            <h2>Fail-closed path</h2>
            <div class="flow">
              <div class="node" id="nodeBus"><div class="n">Bus</div><div class="c" id="nBus">0</div></div>
              <span class="arrow">›</span>
              <div class="node"><div class="n">See</div><div class="c" id="nSee">0</div></div>
              <span class="arrow">›</span>
              <div class="node"><div class="n">Mark</div><div class="c">·</div></div>
              <span class="arrow">›</span>
              <div class="node"><div class="n">Decide</div><div class="c" id="nDecide">0</div></div>
              <span class="arrow">›</span>
              <div class="node"><div class="n">Risk</div><div class="c" id="nRisk">0</div></div>
              <span class="arrow">›</span>
              <div class="node"><div class="n">Quote</div><div class="c" id="nQuote">0</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="tape">
      <div class="tape-head"><span>Live tape</span><span class="hint">GET · 2s</span></div>
      <div id="stream"></div>
    </div>
    <footer>
      <span>127.0.0.1 · read-only · no keys</span>
      <span>SCHEMA · docs.near-intents.org · codec token_diff</span>
    </footer>
  </div>
</div>
<script>
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// Public schema sample — docs.near-intents.org market-makers/example (NOT live traffic)
const SAMPLE = {
  quoteId: '0xsample…docs',
  assetIn: 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
  assetOut: 'nep141:wrap.near',
  exactAmountIn: '1000000',
  exactAmountOut: null,
  minDeadlineMs: 60000,
  side: 'EXACT_IN',
  symIn: 'USDC', symOut: 'wNEAR',
  amtInHuman: '1.00', amtOutHuman: 'solver quotes',
  gates: { listed: 'pass', priced: 'wait', inv: 'pass', risk: 'wait' },
  verdict: null,
  sample: true,
};

function fmtAmount(raw, decimals) {
  const v = BigInt(raw), d = BigInt(decimals), scale = 10n ** d;
  const whole = v / scale, frac = d >= 2n ? ((v % scale) * 100n) / scale : 0n;
  return whole.toLocaleString() + '.' + frac.toString().padStart(2, '0');
}
function shortAsset(id) {
  const name = String(id).replace(/^nep\d+:/, '');
  return name.length > 16 ? name.slice(0, 8) + '…' + name.slice(-4) : name;
}
function symOf(id) {
  if (/wrap\.near/i.test(id)) return 'wNEAR';
  if (/usdt/i.test(id)) return 'USDT';
  if (/usdc|17208628/i.test(id)) return 'USDC';
  return shortAsset(id);
}
function fmtUptime(ms) {
  const s = Math.floor(ms/1000), h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
  return h > 0 ? h+'h '+m+'m' : m+'m '+(s%60)+'s';
}
function sumC(c, pred) {
  let n = 0; for (const [k,v] of Object.entries(c||{})) if (pred(k)) n += v; return n;
}

function renderIntentCard(o) {
  const gates = o.gates || {};
  const gateHtml = ['listed','priced','inv','risk'].map(k => {
    const st = gates[k] || 'wait';
    return '<span class="gate ' + st + '">' + k + '</span>';
  }).join('');
  let verdict = o.verdict;
  let vClass = 'r';
  if (!verdict && o.sample) { verdict = 'AWAITING BUS'; vClass = 'r'; }
  else if (o.ok) { verdict = o.verdict || 'WOULD_QUOTE'; vClass = 'q'; }
  else if (verdict && /kill|daily_loss/.test(verdict)) vClass = 'h';
  else if (verdict) vClass = 'r';

  return '<div class="icard' + (o.sample ? ' sample' : '') + '">' +
    '<div class="icard-top">' +
      '<span class="kind">Quote request</span>' +
      (o.sample ? '<span class="sample-badge">SAMPLE · docs schema · not live</span>' : '') +
      '<span class="qid">' + esc(o.quoteId) + '</span>' +
    '</div>' +
    '<div class="icard-body">' +
      '<div class="leg"><div class="dir">Asset in</div><div class="sym">' + esc(o.symIn) + '</div>' +
        '<div class="amt">' + esc(o.amtInHuman) + '</div>' +
        '<div class="raw">' + esc(shortAsset(o.assetIn)) + '</div></div>' +
      '<div class="swap-glyph">⇄</div>' +
      '<div class="leg"><div class="dir">Asset out</div><div class="sym">' + esc(o.symOut) + '</div>' +
        '<div class="amt">' + esc(o.amtOutHuman) + '</div>' +
        '<div class="raw">' + esc(shortAsset(o.assetOut)) + '</div></div>' +
    '</div>' +
    '<div class="icard-meta">' +
      '<div class="cell"><div class="lbl">Side</div><div class="val">' + esc(o.side) + '</div></div>' +
      '<div class="cell"><div class="lbl">Deadline</div><div class="val">≥ ' + (o.minDeadlineMs/1000) + 's</div></div>' +
      '<div class="cell"><div class="lbl">Spread</div><div class="val">' + esc(o.spread || '—') + '</div></div>' +
      '<div class="cell"><div class="lbl">Raw in</div><div class="val">' + esc(o.exactAmountIn || o.exactAmountOut || '—') + '</div></div>' +
    '</div>' +
    '<div class="icard-foot">' + gateHtml +
      '<span class="verdict ' + vClass + '">' + esc(verdict || '—') + '</span></div>' +
  '</div>';
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
    minDeadlineMs: ev.minDeadlineMs || 60000,
    side,
    symIn: symOf(ev.assetIn), symOut: symOf(ev.assetOut),
    amtInHuman: side === 'EXACT_IN' ? 'exact in' : 'quoted in',
    amtOutHuman: ok && d.amountOutRaw != null ? String(d.amountOutRaw) : (ok ? 'quoted' : '—'),
    spread: ok ? (d.totalSpreadBps + ' bps') : null,
    gates: {
      listed: d.reason === 'asset_not_listed' ? 'fail' : 'pass',
      priced: d.reason === 'no_price' ? 'fail' : (ok || d.reason !== 'no_price' ? 'pass' : 'wait'),
      inv: d.reason === 'insufficient_inventory' ? 'fail' : 'pass',
      risk: /kill|daily_loss|notional|below_min/.test(d.reason||'') ? 'fail' : (ok ? 'pass' : 'wait'),
    },
    ok,
    verdict: ok ? (dry ? 'WOULD_QUOTE' : 'QUOTED') : (d.reason || 'REJECT'),
    sample: false,
  };
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

function render(s, journal) {
  const dry = s.mode === 'dry-run';
  $('mode').textContent = dry ? 'DRY-RUN' : 'LIVE';
  $('mode').className = 'tag ' + (dry ? 'dry' : 'live');
  $('uptime').textContent = fmtUptime(s.uptimeMs);

  const kill = $('kill');
  if (s.killSwitch) { kill.className = 'on'; kill.textContent = '◈ KILL — ' + s.killSwitch; }
  else kill.className = '';

  const r = s.relay || {};
  const frames = r.framesReceived || 0;
  let hc = 'warn', ht = 'no frames · partner key?';
  if (frames > 0) { hc = 'ok'; ht = 'link up'; }
  else if (r.reconnects > 0) { hc = 'bad'; ht = 'reconnect storm'; }
  $('bus').innerHTML = metric('frames', frames) + metric('reconnects', r.reconnects||0) +
    metric('malformed', r.malformedFrames||0) +
    '<div class="metric"><span class="k">health</span><span class="v ' + hc + '">' + ht + '</span></div>';

  const inv = s.inventory || [];
  let maxN = 1;
  const parsed = inv.map(l => {
    const n = Number(fmtAmount(l.availableRaw, l.decimals).replace(/,/g,''));
    if (n > maxN) maxN = n; return {...l, n};
  });
  $('inv').innerHTML = parsed.map(l => {
    const pct = Math.min(100, Math.round((l.n/maxN)*100));
    return '<div class="bar-row"><div class="bar-lab"><span>' + esc(l.symbol) +
      '</span><strong class="amount" title="raw: ' + esc(l.availableRaw) + '">' +
      fmtAmount(l.availableRaw, l.decimals) + '</strong></div><div class="bar"><i style="width:' + pct + '%"></i></div></div>';
  }).join('') + metric('reserved', s.activeReservations);

  const c = s.counters || {};
  const would = sumC(c, k => /would_quote|quoted/.test(k));
  const rejects = sumC(c, k => k.startsWith('quote_decision:') && !/would_quote|quoted/.test(k));
  const total = would + rejects;
  const entries = Object.entries(c).sort();
  $('counters').innerHTML = entries.length
    ? entries.map(([k,v]) => metric(k.replace(/^quote_decision:/,''), v)).join('')
    : metric('awaiting', '—');

  const ringPct = frames > 0 ? Math.min(100, 12 + Math.min(88, frames)) : 0;
  $('ringArc').setAttribute('stroke-dasharray', ringPct + ' ' + (100 - ringPct));
  $('ringBig').textContent = String(frames);
  $('ringCap').textContent = frames > 0 ? 'bus receiving' : 'bus silent';
  $('nBus').textContent = frames; $('nSee').textContent = total;
  $('nDecide').textContent = total; $('nRisk').textContent = rejects; $('nQuote').textContent = would;
  document.querySelectorAll('.node').forEach(el => el.classList.toggle('active', frames > 0));

  // Primary intent object: latest journal decision, else docs SAMPLE
  const j = journal || [];
  let card = null;
  for (let i = j.length - 1; i >= 0; i--) {
    card = fromJournal(j[i], dry);
    if (card) break;
  }
  if (card) {
    $('intentHint').textContent = 'LIVE JOURNAL';
    $('intentCard').innerHTML = renderIntentCard(card);
  } else {
    $('intentHint').textContent = 'SAMPLE · docs.near-intents.org';
    $('intentCard').innerHTML = renderIntentCard(SAMPLE);
  }

  const rows = j.slice(-40).reverse().map(e => {
    if (e.type === 'quote_decision') {
      const d = e.decision, ev = e.event;
      const pair = symOf(ev.assetIn) + ' → ' + symOf(ev.assetOut);
      const reason = d.shouldQuote ? (dry ? 'would_quote' : 'quoted') : d.reason;
      const det = d.shouldQuote ? d.totalSpreadBps + ' bps' : '';
      return row(e.tMs, pair, det, reason, d.shouldQuote);
    }
    if (e.type === 'inferred_fill') return row(e.tMs, 'FILL', e.quoteId, 'fill', true);
    return '';
  }).join('');
  $('stream').innerHTML = rows || '<div class="empty"><span class="pulse"></span>scanning · sample card shown until bus traffic</div>';
}

function metric(k, v) {
  return '<div class="metric"><span class="k">' + esc(k) + '</span><span class="v">' + esc(String(v)) + '</span></div>';
}
function row(tMs, pair, det, reason, ok) {
  let kind = 'r', chip = 'r';
  if (ok || reason === 'fill') { kind = 'q'; chip = reason === 'fill' ? 'i' : 'q'; }
  if (/kill|daily_loss/.test(reason||'')) { kind = 'h'; chip = 'h'; }
  return '<div class="entry ' + kind + '"><span class="t">' + new Date(tMs).toISOString().slice(11,19) +
    '</span><span class="pair">' + esc(pair) + '</span><span class="det">' + esc(det) +
    '</span><span class="chip ' + chip + '">' + esc(reason) + '</span></div>';
}

tick(); setInterval(tick, 2000);
</script>
</body>
</html>`;
