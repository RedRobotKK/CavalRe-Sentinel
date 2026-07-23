/**
 * NEAR SOLVER DESK — 2026 console spin.
 * WebGL atmosphere (grid + path nodes) under glass panels that still explain the data.
 */

export const DASHBOARD_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NEAR SOLVER DESK · CavalRe</title>
<style>
:root{
  --bg:#05080c;--glass:rgba(8,14,20,.82);--line:rgba(0,255,200,.22);
  --cyan:#00ffc8;--dim:#5a8a80;--text:#d8fff4;--warn:#ffc14a;--bad:#ff5a78;
  --mono:"SF Mono",ui-monospace,Menlo,Consolas,monospace;
}
*{box-sizing:border-box;margin:0}
html,body{height:100%;overflow:hidden;background:#05080c;color:var(--text);font:12.5px/1.4 system-ui,sans-serif}
#gl{position:fixed;inset:0;z-index:0}
.scan{position:fixed;inset:0;z-index:1;pointer-events:none;
  background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.12) 2px,rgba(0,0,0,.12) 4px);
  opacity:.35}
.vignette{position:fixed;inset:0;z-index:1;pointer-events:none;
  background:radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,.55) 100%)}
.ui{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;pointer-events:none}
.ui a,.ui button,.ui input{pointer-events:auto}
.ui .panel,.ui header,.ui footer,.ui #kill{pointer-events:auto}
header{display:flex;align-items:center;gap:10px;padding:10px 14px;
  background:linear-gradient(180deg,rgba(0,20,18,.95),rgba(5,10,14,.7));
  border-bottom:1px solid var(--line);backdrop-filter:blur(10px)}
.logo{width:26px;height:26px;border:1px solid var(--cyan);display:grid;place-items:center;
  font:700 9px var(--mono);color:var(--cyan);box-shadow:0 0 12px rgba(0,255,200,.35)}
h1{font:650 12px var(--mono);letter-spacing:1.5px;text-transform:uppercase}
h1 em{font-style:normal;color:var(--dim);font-weight:500}
.pill{font:700 9px var(--mono);padding:3px 8px;border:1px solid;text-transform:uppercase;letter-spacing:.8px}
.pill.dry{color:var(--warn);border-color:rgba(255,193,74,.4);background:rgba(40,30,0,.45)}
.pill.live{color:var(--cyan);border-color:var(--cyan);background:rgba(0,40,32,.45)}
.pill.mute{color:var(--dim);border-color:rgba(90,138,128,.35)}
.sp{flex:1}
.clock{font:11px var(--mono);color:var(--dim)}.clock b{color:var(--cyan)}
#kill{display:none;margin:8px 14px 0;padding:10px 12px;border:1px solid var(--bad);
  background:rgba(40,6,12,.92);color:var(--bad);font:650 12px var(--mono)}
#kill.on{display:block}
.wrap{flex:1;display:grid;grid-template-columns:220px 1fr 220px;gap:10px;padding:10px 14px;min-height:0}
@media(max-width:960px){.wrap{grid-template-columns:1fr;overflow:auto}}
.panel{background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(12px);
  padding:10px 12px;position:relative;box-shadow:inset 0 1px 0 rgba(0,255,200,.08)}
.panel::after{content:"";position:absolute;top:0;left:12px;right:12px;height:1px;
  background:linear-gradient(90deg,transparent,var(--cyan),transparent);opacity:.5}
.panel h2{font:650 9px var(--mono);letter-spacing:1.4px;text-transform:uppercase;color:var(--cyan);margin-bottom:8px}
.blurb{font:11.5px/1.45 system-ui,sans-serif;color:var(--dim);margin-bottom:10px}
.blurb b{color:var(--text);font-weight:600}
.row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(0,40,36,.5);font:12px var(--mono)}
.row:last-child{border:0}.k{color:var(--dim);font-size:10px}.v.ok{color:var(--cyan)}.v.warn{color:var(--warn)}.v.bad{color:var(--bad)}
.mid{display:flex;flex-direction:column;gap:10px;min-height:0}
.intent-grid{display:grid;grid-template-columns:1fr 44px 1fr;gap:8px;align-items:center;margin:6px 0 10px}
.leg{padding:10px;border:1px solid rgba(0,200,170,.25);background:rgba(0,16,14,.55)}
.leg .d{font:700 8px var(--mono);color:var(--dim);letter-spacing:1px;margin-bottom:3px}
.leg .s{font:700 17px var(--mono)}.leg .a{font:12px var(--mono);color:var(--cyan);margin-top:3px}
.leg .r{font:9px var(--mono);color:var(--dim);margin-top:2px;word-break:break-all}
.xchg{width:44px;height:44px;border-radius:50%;border:1px solid var(--cyan);display:grid;place-items:center;
  font:700 14px var(--mono);color:var(--cyan);box-shadow:0 0 18px rgba(0,255,200,.35);
  background:radial-gradient(circle at 30% 30%,rgba(0,60,50,.9),rgba(0,12,10,.95))}
.meta{display:flex;flex-wrap:wrap;gap:12px;font:11px var(--mono);color:var(--dim);margin-bottom:8px}
.meta b{color:var(--text)}
.gates{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.gate{font:700 8px var(--mono);padding:2px 6px;border:1px solid rgba(0,80,70,.5);color:var(--dim);text-transform:uppercase}
.gate.pass{color:var(--cyan);border-color:rgba(0,255,200,.4)}.gate.fail{color:var(--bad);border-color:rgba(255,90,120,.45)}.gate.wait{color:var(--warn);border-color:rgba(255,193,74,.4)}
.verdict{margin-left:auto;font:700 10px var(--mono);padding:3px 9px;border:1px solid;text-transform:uppercase}
.verdict.q{color:var(--cyan);border-color:var(--cyan);background:rgba(0,40,32,.5)}
.verdict.r{color:var(--warn);border-color:rgba(255,193,74,.4);background:rgba(40,30,0,.4)}
.verdict.h{color:var(--bad);border-color:rgba(255,90,120,.5)}
.tape{flex:1;min-height:100px;display:flex;flex-direction:column;border:1px solid var(--line);background:rgba(2,8,10,.88)}
.tape h2{padding:6px 10px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between}
.tape h2 span{color:var(--dim);font-weight:500}
#stream{flex:1;overflow:auto;padding:4px 6px;font:11.5px var(--mono)}
.line{display:grid;grid-template-columns:52px 1fr auto auto;gap:8px;padding:4px 6px;border-left:2px solid transparent}
.line.q{border-left-color:var(--cyan)}.line.r{border-left-color:var(--warn)}.line.h{border-left-color:var(--bad)}
.line .t{color:var(--dim)}.chip{font:700 8px var(--mono);padding:2px 5px;border:1px solid;text-transform:uppercase}
.chip.q{color:var(--cyan);border-color:rgba(0,255,200,.4)}.chip.r{color:var(--warn);border-color:rgba(255,193,74,.4)}.chip.h{color:var(--bad);border-color:rgba(255,90,120,.45)}
footer{padding:6px 14px;font:9px var(--mono);color:var(--dim);border-top:1px solid rgba(0,60,50,.35);
  display:flex;justify-content:space-between;background:rgba(0,8,10,.7)}
.empty{padding:16px;text-align:center;color:var(--dim)}
</style>
</head>
<body>
<canvas id="gl"></canvas>
<div class="scan"></div>
<div class="vignette"></div>
<div class="ui">
<header>
  <div class="logo">NS</div>
  <h1>Near Solver Desk <em>· CavalRe</em></h1>
  <span id="mode" class="pill dry">…</span>
  <span class="pill mute">view</span>
  <span class="sp"></span>
  <span class="clock">UP <b id="uptime">—</b> · <span id="clock">—</span></span>
</header>
<div id="kill"></div>
<div class="wrap">
  <div>
    <div class="panel" style="margin-bottom:10px">
      <h2>System</h2>
      <p class="blurb">Dry-run of the NEAR Intents solver. Each line is one <b>decide()</b>: would we quote, or reject, and why. Nothing is signed here.</p>
      <h2>Bus</h2>
      <div id="bus"></div>
    </div>
    <div class="panel">
      <h2>Inventory</h2>
      <div id="inv"></div>
    </div>
  </div>
  <div class="mid">
    <div class="panel">
      <h2 style="display:flex;justify-content:space-between"><span>Active request</span><span style="color:var(--dim);font-weight:500" id="intentHint">—</span></h2>
      <div id="intentCard"></div>
    </div>
    <div class="tape">
      <h2><span>Decision tape</span><span>2s</span></h2>
      <div id="stream"></div>
    </div>
  </div>
  <div>
    <div class="panel" style="margin-bottom:10px">
      <h2>Scoreboard</h2>
      <div id="counters"></div>
    </div>
    <div class="panel">
      <h2>Path</h2>
      <div class="row"><span class="k">seen</span><span class="v" id="nSee">0</span></div>
      <div class="row"><span class="k">rejected</span><span class="v" id="nRisk">0</span></div>
      <div class="row"><span class="k">would quote</span><span class="v ok" id="nQuote">0</span></div>
      <div class="row"><span class="k">bus frames</span><span class="v" id="nBus">0</span></div>
    </div>
  </div>
</div>
<footer>
  <span>127.0.0.1 · /metrics</span>
  <span>WebGL stage · data from /api</span>
</footer>
</div>
<script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.160.0/build/three.module.js"}}</script>
<script type="module">
import * as THREE from 'three';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* --- WebGL stage: labeled path, not random sculpture --- */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x05080c, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 2, 0.1, 60);
camera.position.set(0, 4.2, 11);
camera.lookAt(0, 0.2, 0);
scene.add(new THREE.AmbientLight(0x143028, 1));
const L = new THREE.DirectionalLight(0x00ffc8, 0.9);
L.position.set(3, 8, 5); scene.add(L);

const grid = new THREE.GridHelper(28, 56, 0x0c3a32, 0x081818);
grid.position.y = -1.4; scene.add(grid);

const labels = ['BUS','SEE','MARK','DECIDE','RISK','QUOTE'];
const nodes = [];
const g = new THREE.Group(); scene.add(g);
labels.forEach((_, i) => {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 20, 20),
    new THREE.MeshStandardMaterial({ color: 0x007a66, emissive: 0x003028, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.4 })
  );
  m.position.set((i - 2.5) * 1.5, 0.6, -0.5);
  g.add(m); nodes.push(m);
  if (i) {
    const a = new THREE.Vector3((i-3.5)*1.5, 0.6, -0.5);
    const b = new THREE.Vector3((i-2.5)*1.5, 0.6, -0.5);
    g.add(new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.LineCurve3(a,b), 6, 0.025, 5, false),
      new THREE.MeshBasicMaterial({ color: 0x00a080, transparent: true, opacity: 0.45 })
    ));
  }
});

const bars = {};
['USDC','wNEAR','USDT'].forEach((sym, i) => {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 1, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x00a888, emissive: 0x002820, metalness: 0.35, roughness: 0.45 })
  );
  m.position.set(-5.2 + i * 0.75, -0.2, 1.2);
  scene.add(m); bars[sym] = m;
});

const ring = new THREE.Mesh(
  new THREE.TorusGeometry(3.4, 0.03, 10, 80),
  new THREE.MeshBasicMaterial({ color: 0x00ffc8, transparent: true, opacity: 0.22 })
);
ring.rotation.x = Math.PI/2.3; ring.position.set(0, 0.6, -0.5); scene.add(ring);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w/h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
(function loop() {
  requestAnimationFrame(loop);
  const t = performance.now()*0.001;
  g.rotation.y = Math.sin(t*0.12)*0.06;
  ring.rotation.z = t*0.1;
  renderer.render(scene, camera);
})();

/* --- data --- */
function fmtAmount(raw, decimals) {
  const v = BigInt(raw), d = BigInt(decimals), scale = 10n ** d;
  const whole = v/scale, frac = d>=2n ? ((v%scale)*100n)/scale : 0n;
  return whole.toLocaleString()+'.'+frac.toString().padStart(2,'0');
}
function shortAsset(id) {
  const name = String(id).replace(/^nep\\d+:/, '');
  return name.length > 18 ? name.slice(0,8)+'…'+name.slice(-4) : name;
}
function symOf(id) {
  if (/wrap\\.near/i.test(id)) return 'wNEAR';
  if (/usdt/i.test(id)) return 'USDT';
  if (/usdc|17208628/i.test(id)) return 'USDC';
  return shortAsset(id);
}
function fmtUptime(ms) {
  const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60);
  return h>0?h+'h '+m+'m':m+'m '+(s%60)+'s';
}
function row(k,v,cls){return '<div class="row"><span class="k">'+esc(k)+'</span><span class="v '+(cls||'')+'">'+esc(String(v))+'</span></div>';}

function renderIntent(o) {
  const gates = o.gates||{};
  const gh = ['listed','priced','inv','risk'].map(k=>{
    const st=gates[k]||'wait'; return '<span class="gate '+st+'">'+k+'</span>';
  }).join('');
  let verdict=o.verdict, vc='r';
  if(!verdict&&o.sample) verdict='WAITING';
  else if(o.ok){verdict=o.verdict||'WOULD QUOTE';vc='q';}
  else if(verdict&&/kill|daily_loss/.test(verdict)) vc='h';
  return '<div class="intent-grid">'+
    '<div class="leg"><div class="d">Pay</div><div class="s">'+esc(o.symIn)+'</div><div class="a">'+esc(o.amtInHuman)+'</div><div class="r">'+esc(shortAsset(o.assetIn))+'</div></div>'+
    '<div class="xchg">→</div>'+
    '<div class="leg"><div class="d">Receive</div><div class="s">'+esc(o.symOut)+'</div><div class="a">'+esc(o.amtOutHuman)+'</div><div class="r">'+esc(shortAsset(o.assetOut))+'</div></div></div>'+
    '<div class="meta"><span>side <b>'+esc(o.side)+'</b></span><span>deadline ≥ <b>'+(o.minDeadlineMs/1000)+'s</b></span><span>spread <b>'+esc(o.spread||'—')+'</b></span></div>'+
    '<div class="gates">'+gh+'<span class="verdict '+vc+'">'+esc(verdict||'—')+'</span></div>';
}

function fromJournal(e, dry) {
  if(!e||e.type!=='quote_decision') return null;
  const d=e.decision, ev=e.event, ok=!!d.shouldQuote;
  const side=ev.exactAmountIn!=null?'EXACT_IN':'EXACT_OUT';
  return {
    quoteId:ev.quoteId||d.quoteId, assetIn:ev.assetIn, assetOut:ev.assetOut,
    minDeadlineMs:ev.minDeadlineMs||60000, side,
    symIn:symOf(ev.assetIn), symOut:symOf(ev.assetOut),
    amtInHuman:side==='EXACT_IN'?'exact in':'quoted in',
    amtOutHuman:ok&&d.amountOutRaw!=null?String(d.amountOutRaw):(ok?'quoted':'—'),
    spread:ok?d.totalSpreadBps+' bps':null,
    gates:{
      listed:d.reason==='asset_not_listed'?'fail':'pass',
      priced:d.reason==='no_price'?'fail':'pass',
      inv:d.reason==='insufficient_inventory'?'fail':'pass',
      risk:/kill|daily_loss|notional|below_min/.test(d.reason||'')?'fail':(ok?'pass':'wait'),
    },
    ok, verdict:ok?(dry?'WOULD QUOTE':'QUOTED'):(d.reason||'REJECT'), sample:false,
  };
}

const SAMPLE={quoteId:'sample',assetIn:'nep141:usdc',assetOut:'nep141:wrap.near',minDeadlineMs:60000,side:'EXACT_IN',
  symIn:'USDC',symOut:'wNEAR',amtInHuman:'1.00',amtOutHuman:'priced if accepted',
  gates:{listed:'pass',priced:'wait',inv:'pass',risk:'wait'},verdict:null,sample:true,ok:false};

function render(s, journal) {
  const dry=s.mode==='dry-run';
  $('mode').textContent=dry?'dry-run':'live';
  $('mode').className='pill '+(dry?'dry':'live');
  $('uptime').textContent=fmtUptime(s.uptimeMs);
  const kill=$('kill');
  if(s.killSwitch){kill.className='on';kill.textContent='KILL — '+s.killSwitch;} else kill.className='';

  const r=s.relay||{}, frames=r.framesReceived||0;
  let hc='warn', ht='no frames · partner key?';
  if(frames>0){hc='ok';ht='up';} else if(r.reconnects>0){hc='bad';ht='reconnect storm';}
  $('bus').innerHTML=row('frames',frames)+row('reconnects',r.reconnects||0)+row('malformed',r.malformedFrames||0)+row('status',ht,hc);

  const inv=s.inventory||[];
  let maxN=1;
  const parsed=inv.map(l=>{const n=Number(fmtAmount(l.availableRaw,l.decimals).replace(/,/g,'')); if(n>maxN)maxN=n; return{...l,n};});
  $('inv').innerHTML=parsed.map(l=>row(l.symbol,fmtAmount(l.availableRaw,l.decimals))).join('')+row('reserved',s.activeReservations);
  parsed.forEach(l=>{const b=bars[l.symbol]; if(!b)return; const h=Math.max(0.2,(l.n/maxN)*2.4); b.scale.y=h; b.position.y=-1.4+h/2;});

  const c=s.counters||{};
  const would=Object.entries(c).filter(([k])=>/would_quote|quoted/.test(k)).reduce((a,[,v])=>a+v,0);
  const rejects=Object.entries(c).filter(([k])=>k.startsWith('quote_decision:')&&!/would_quote|quoted/.test(k)).reduce((a,[,v])=>a+v,0);
  const total=would+rejects;
  $('counters').innerHTML=Object.entries(c).sort((a,b)=>b[1]-a[1]).map(([k,v])=>row(k.replace(/^quote_decision:/,''),v)).join('')||row('none','—');
  $('nSee').textContent=total; $('nRisk').textContent=rejects; $('nQuote').textContent=would; $('nBus').textContent=frames;

  nodes.forEach((m,i)=>{
    const on=(i===0&&frames>0)||(i>0&&total>0);
    m.material.emissiveIntensity=on?1.2:0.4;
    m.material.color.setHex(on?0x00ffc8:0x007a66);
  });

  const j=journal||[];
  let card=null;
  for(let i=j.length-1;i>=0;i--){card=fromJournal(j[i],dry); if(card)break;}
  if(card){$('intentHint').textContent=card.quoteId; $('intentCard').innerHTML=renderIntent(card);}
  else{$('intentHint').textContent='idle'; $('intentCard').innerHTML=renderIntent(SAMPLE);}

  const rows=j.slice(-40).reverse().map(e=>{
    if(e.type!=='quote_decision') return '';
    const d=e.decision,ev=e.event;
    const pair=symOf(ev.assetIn)+' → '+symOf(ev.assetOut);
    const reason=d.shouldQuote?(dry?'would_quote':'quoted'):d.reason;
    const det=d.shouldQuote?d.totalSpreadBps+' bps':'';
    let kind='r',chip='r';
    if(d.shouldQuote){kind='q';chip='q';}
    if(/kill|daily_loss/.test(reason||'')){kind='h';chip='h';}
    return '<div class="line '+kind+'"><span class="t">'+new Date(e.tMs).toISOString().slice(11,19)+
      '</span><span>'+esc(pair)+'</span><span style="color:var(--dim)">'+esc(det)+
      '</span><span class="chip '+chip+'">'+esc(reason)+'</span></div>';
  }).join('');
  $('stream').innerHTML=rows||'<div class="empty">npm run solver:cover — fills this tape</div>';
}

async function tick(){
  try{
    const [status,journal]=await Promise.all([
      fetch('/api/status').then(r=>r.json()),
      fetch('/api/journal/recent').then(r=>r.json()),
    ]);
    render(status,journal);
  }catch{}
  $('clock').textContent=new Date().toISOString().slice(11,19)+'Z';
}
tick(); setInterval(tick,2000);
</script>
</body>
</html>`;
