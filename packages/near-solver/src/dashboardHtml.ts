/**
 * NEAR SOLVER DESK — circuit breaker + WebGL noise particles + pass stream.
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
  --sans:system-ui,-apple-system,sans-serif;
}
*{box-sizing:border-box;margin:0}
html,body{height:100%;background:var(--bg);color:var(--text);font:13px/1.4 var(--sans);overflow:hidden}
.shell{height:100%;display:grid;grid-template-rows:44px minmax(0,1fr) 120px}
header{display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid var(--line);background:#0a0e12}
.logo{width:26px;height:26px;background:var(--amber);color:#1a0a00;display:grid;place-items:center;font:700 10px var(--mono);border-radius:3px;box-shadow:0 0 12px rgba(245,166,35,.45)}
h1{font:600 13px var(--sans)}.h1sub{color:var(--muted);font-weight:400;font-size:11px;margin-left:6px}
.badge{font:600 9px var(--mono);padding:2px 7px;border-radius:3px;text-transform:uppercase}
.badge.dry{background:#3d2a00;color:#f5a623}.badge.live{background:#064e3b;color:#5eead4}
.right{margin-left:auto;font:11px var(--mono);color:var(--muted)}.right b{color:var(--text)}
#kill{display:none;background:#4c0519;color:#fda4af;padding:6px 14px;font:600 12px var(--mono)}
#kill.on{display:block}
.main{display:grid;grid-template-columns:220px minmax(0,1fr) 220px;gap:10px;padding:10px;min-height:0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:10px;min-height:0;display:flex;flex-direction:column;overflow:auto}
.card h2{font:600 10px var(--sans);color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.kv{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--line);font:11px var(--mono)}
.kv:last-child{border:0}.kv .k{color:var(--muted)}.kv .v.warn{color:var(--amber)}.kv .v.ok{color:var(--cyan)}.kv .v.bad{color:var(--bad)}
.bars{display:flex;flex-direction:column;gap:5px}
.bar-row{display:grid;grid-template-columns:84px 1fr 24px;gap:5px;align-items:center;font:11px var(--mono)}
.bar-row .label{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}
.bar-track{height:11px;background:#080b0e;border:1px solid var(--line);border-radius:2px;overflow:hidden}
.bar-fill{height:100%;min-width:2px}.bar-fill.quote{background:var(--cyan)}.bar-fill.reject{background:var(--amber)}
.bar-n{text-align:right;font-weight:600}
.funnel-step{display:grid;grid-template-columns:48px 1fr 26px;gap:5px;align-items:center;margin-bottom:4px}
.funnel-step .name{font:600 10px var(--mono);color:var(--muted)}
.funnel-step .track{height:14px;background:#080b0e;border:1px solid var(--line);border-radius:2px;overflow:hidden}
.funnel-step .fill{height:100%;background:linear-gradient(90deg,#7c4a00,var(--amber))}
.funnel-step .n{font:700 11px var(--mono);text-align:right}
.funnel-step.active .name{color:var(--amber)}
.hero-card{background:#05070a;border:1px solid var(--line);border-radius:4px;display:flex;flex-direction:column;min-height:0;overflow:hidden;box-shadow:inset 0 0 40px rgba(245,166,35,.04)}
.hero-card > h2{padding:8px 12px 0;font:600 10px var(--sans);color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.hero-stage{position:relative;flex:1 1 auto;min-height:220px}
#gl,#hero{position:absolute;inset:0;width:100%;height:100%;display:block}
#hero{z-index:2;pointer-events:none}
#gl{z-index:1}
.pass-bg{position:absolute;inset:0;z-index:0;overflow:hidden;opacity:.18;pointer-events:none}
.pass-bg .col{position:absolute;top:0;font:9px/1.4 var(--mono);color:#f5a623;white-space:pre;animation:scrollUp linear infinite}
@keyframes scrollUp{from{transform:translateY(0)}to{transform:translateY(-50%)}}
.intent-bar{z-index:3;padding:8px 12px;border-top:1px solid var(--line);background:rgba(14,19,24,.94)}
.req-pair{display:flex;align-items:center;justify-content:center;gap:10px}
.req-pair .sym{font:700 16px var(--sans)}.req-pair .arrow{color:var(--amber);text-shadow:0 0 8px rgba(245,166,35,.5)}
.req-meta{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;font:10px var(--mono);color:var(--muted);margin-top:4px}
.req-meta b{color:var(--text)}
.gates{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin-top:6px}
.gate{font:600 9px var(--mono);padding:2px 6px;border:1px solid #2a3238;border-radius:2px;color:var(--muted);text-transform:uppercase}
.gate.pass{color:var(--cyan);border-color:#115e59;background:#042f2e}
.gate.fail{color:var(--bad);border-color:#9f1239;background:#4c0519}
.gate.wait{color:var(--amber);border-color:#7c4a00;background:#3d2a00}
.verdict{font:700 9px var(--mono);padding:2px 7px;border:1px solid;border-radius:2px;text-transform:uppercase}
.verdict.q{color:var(--cyan);border-color:#115e59;background:#042f2e}
.verdict.r{color:var(--amber);border-color:#7c4a00;background:#3d2a00}
.verdict.h{color:var(--bad);border-color:#9f1239;background:#4c0519}
.tape-wrap{border-top:1px solid var(--line);background:var(--panel);padding:6px 14px;display:flex;flex-direction:column;min-height:0}
.tape-wrap h2{font:600 10px var(--sans);color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;display:flex;justify-content:space-between}
.tape-wrap h2 span{font:11px var(--mono);font-weight:500;text-transform:none;letter-spacing:0}
#stream{flex:1;overflow:auto;font:11px var(--mono)}
.line{display:grid;grid-template-columns:48px 1fr auto auto;gap:8px;padding:2px 0;border-bottom:1px solid var(--line)}
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
    <span id="mode" class="badge dry">dry-run</span>
    <div class="right">uptime <b id="uptime">—</b> · <span id="clock">—</span></div>
  </header>
  <div id="kill"></div>
  <div class="main">
    <div class="card">
      <h2>Decision mix</h2>
      <div class="bars" id="bars"><div class="empty">waiting for data…</div></div>
    </div>
    <div class="hero-card">
      <h2>Circuit breaker · GLSL noise field</h2>
      <div class="hero-stage">
        <div class="pass-bg" id="passBg"></div>
        <canvas id="gl"></canvas>
        <canvas id="hero"></canvas>
      </div>
      <div class="intent-bar" id="intentCard"></div>
    </div>
    <div class="card">
      <h2>Path funnel</h2>
      <div id="funnel"></div>
      <div style="margin-top:10px">
        <h2>Bus &amp; inventory</h2>
        <div id="bus"></div>
        <div id="inv" style="margin-top:4px"></div>
      </div>
    </div>
  </div>
  <div class="tape-wrap">
    <h2>Decision tape <span id="intentHint">—</span></h2>
    <div id="stream"><div class="empty">npm run solver:cover</div></div>
  </div>
</div>
<script>
(function () {
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  };

  /* ---------- WebGL particle field with GLSL value noise ---------- */
  const glCanvas = $('gl');
  const gl = glCanvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
  let glOk = !!gl;
  let glProg = null;
  let glBuf = null;
  let uTime = null;
  let uRes = null;
  let uBurst = null;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh));
      glOk = false;
      return null;
    }
    return sh;
  }

  if (glOk) {
    const vs = compile(gl.VERTEX_SHADER, [
      'attribute vec2 a_pos;',
      'void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }'
    ].join('\n'));
    const fs = compile(gl.FRAGMENT_SHADER, [
      'precision mediump float;',
      'uniform float u_time;',
      'uniform vec2 u_res;',
      'uniform float u_burst;',
      'float hash(vec2 p){',
      '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);',
      '}',
      'float noise(vec2 p){',
      '  vec2 i = floor(p);',
      '  vec2 f = fract(p);',
      '  float a = hash(i);',
      '  float b = hash(i + vec2(1.0, 0.0));',
      '  float c = hash(i + vec2(0.0, 1.0));',
      '  float d = hash(i + vec2(1.0, 1.0));',
      '  vec2 u = f * f * (3.0 - 2.0 * f);',
      '  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;',
      '}',
      'float fbm(vec2 p){',
      '  float v = 0.0;',
      '  float a = 0.5;',
      '  for (int i = 0; i < 4; i++) {',
      '    v += a * noise(p);',
      '    p *= 2.03;',
      '    a *= 0.5;',
      '  }',
      '  return v;',
      '}',
      'void main(){',
      '  vec2 uv = gl_FragCoord.xy / u_res;',
      '  vec2 p = uv * vec2(u_res.x / u_res.y, 1.0) * 3.0;',
      '  float t = u_time * 0.15;',
      '  float n = fbm(p + vec2(t, t * 0.7));',
      '  float n2 = fbm(p * 2.0 - vec2(t * 1.3, -t));',
      '  float flow = smoothstep(0.35, 0.65, n);',
      '  float sparks = smoothstep(0.72, 0.9, n2);',
      '  float conduit = exp(-pow((uv.y - 0.42) * 6.0, 2.0));',
      '  vec3 amber = vec3(0.96, 0.65, 0.14);',
      '  vec3 cyan = vec3(0.18, 0.83, 0.75);',
      '  vec3 col = amber * (0.04 + flow * 0.12 + sparks * 0.25);',
      '  col += cyan * sparks * 0.15 * conduit;',
      '  col += amber * conduit * (0.06 + u_burst * 0.12);',
      '  float alpha = 0.15 + flow * 0.25 + sparks * 0.35 + conduit * 0.1 + u_burst * 0.1;',
      '  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.7));',
      '}'
    ].join('\n'));
    if (vs && fs) {
      glProg = gl.createProgram();
      gl.attachShader(glProg, vs);
      gl.attachShader(glProg, fs);
      gl.linkProgram(glProg);
      if (!gl.getProgramParameter(glProg, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(glProg));
        glOk = false;
      } else {
        glBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, glBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
          -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1
        ]), gl.STATIC_DRAW);
        uTime = gl.getUniformLocation(glProg, 'u_time');
        uRes = gl.getUniformLocation(glProg, 'u_res');
        uBurst = gl.getUniformLocation(glProg, 'u_burst');
        const loc = gl.getAttribLocation(glProg, 'a_pos');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }
    }
  }

  let burstAmt = 0;
  function resizeGl() {
    if (!glOk) return;
    const r = glCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    glCanvas.width = Math.max(1, Math.floor(r.width * dpr));
    glCanvas.height = Math.max(1, Math.floor(r.height * dpr));
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
  }

  /* ---------- 2D circuit boxes ---------- */
  const canvas = $('hero');
  const ctx = canvas.getContext('2d');
  const STAGES = ['BUS', 'SEE', 'MARK', 'DECIDE', 'RISK', 'QUOTE'];
  let counts = { bus: 0, see: 0, mark: 0, decide: 0, risk: 0, quote: 0, drop: 0 };
  let stageHeat = [0, 0, 0, 0, 0, 0];
  const links = [];
  let W = 0, H = 0, dpr2 = 1, lastTs = 0;
  const tags = [];

  function resize2d() {
    const r = canvas.getBoundingClientRect();
    dpr2 = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.max(1, Math.floor(W * dpr2));
    canvas.height = Math.max(1, Math.floor(H * dpr2));
    ctx.setTransform(dpr2, 0, 0, dpr2, 0, 0);
  }

  function boxes() {
    const n = STAGES.length;
    const pad = 22;
    const bw = Math.min(74, (W - pad * 2) / n - 8);
    const bh = 58;
    const gap = (W - pad * 2 - bw * n) / Math.max(1, n - 1);
    const y = H * 0.38 - bh / 2;
    const out = [];
    for (let i = 0; i < n; i++) {
      const x = pad + i * (bw + gap);
      out.push({ x: x, y: y, w: bw, h: bh, cx: x + bw / 2, cy: y + bh / 2 });
    }
    return out;
  }

  function spawnLink(a, b, ok) {
    if (links.length > 300) return;
    links.push({ a: a, b: b, t: 0, speed: 0.5 + Math.random() * 0.4, ok: ok, amp: 6 + Math.random() * 14, phase: Math.random() * 6.28 });
  }

  function emitFlow(ok) {
    burstAmt = 1;
    for (let i = 0; i < STAGES.length - 1; i++) {
      (function (idx) {
        setTimeout(function () {
          for (let k = 0; k < 4; k++) spawnLink(idx, idx + 1, ok);
          stageHeat[idx] = 1;
          if (idx === STAGES.length - 2) stageHeat[idx + 1] = 1;
        }, idx * 55);
      })(i);
    }
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function frame(ts) {
    const dt = Math.min(0.033, ((ts - lastTs) / 1000) || 0.016);
    lastTs = ts;
    burstAmt = Math.max(0, burstAmt - dt * 0.45);

    if (glOk && glProg) {
      resizeGl();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(glProg);
      gl.uniform1f(uTime, ts * 0.001);
      gl.uniform2f(uRes, glCanvas.width, glCanvas.height);
      gl.uniform1f(uBurst, burstAmt);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    if (W < 8) resize2d();
    ctx.clearRect(0, 0, W, H);

    // floor
    ctx.strokeStyle = 'rgba(245,166,35,0.05)';
    ctx.lineWidth = 1;
    var hz = H * 0.68;
    for (var gi = 0; gi < 8; gi++) {
      var gy = hz + gi * gi * 2.2;
      if (gy > H) break;
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(245,166,35,' + (0.08 + burstAmt * 0.1) + ')';
    ctx.beginPath(); ctx.ellipse(W / 2, H * 0.44, W * 0.38, H * 0.18, 0, 0, Math.PI * 2); ctx.stroke();

    var bx = boxes();
    for (var hi = 0; hi < stageHeat.length; hi++) stageHeat[hi] = Math.max(0, stageHeat[hi] - dt * 0.5);

    for (var li = links.length - 1; li >= 0; li--) {
      var p = links[li];
      p.t += p.speed * dt;
      if (p.t >= 1) { links.splice(li, 1); continue; }
      var A = bx[p.a], B = bx[p.b];
      if (!A || !B) continue;
      var x = A.cx + (B.cx - A.cx) * p.t;
      var y = A.cy + (B.cy - A.cy) * p.t + Math.sin(p.t * Math.PI * 2 + p.phase) * p.amp * Math.sin(p.t * Math.PI);
      var a = Math.sin(p.t * Math.PI);
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = p.ok ? 'rgba(45,212,191,' + (0.4 + a * 0.5) + ')' : 'rgba(255,200,80,' + (0.4 + a * 0.5) + ')';
      ctx.fill();
    }
    if (Math.random() < 0.1) {
      var si = Math.floor(Math.random() * (STAGES.length - 1));
      spawnLink(si, si + 1, Math.random() > 0.35);
    }

    var vals = [counts.bus, counts.see, counts.mark, counts.decide, counts.risk, counts.quote];
    for (var i = 0; i < bx.length; i++) {
      var b = bx[i];
      var heat = stageHeat[i];
      var live = vals[i] > 0;
      if (heat > 0.05) {
        ctx.save();
        ctx.shadowColor = 'rgba(245,166,35,' + (0.4 + heat * 0.5) + ')';
        ctx.shadowBlur = 20 + heat * 28;
        rr(b.x, b.y, b.w, b.h, 4);
        ctx.fillStyle = 'rgba(245,166,35,0.07)';
        ctx.fill();
        ctx.restore();
      }
      var g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      if (heat > 0.25) { g.addColorStop(0, '#6b450c'); g.addColorStop(1, '#2e1a00'); }
      else if (live) { g.addColorStop(0, '#3d2a00'); g.addColorStop(1, '#1a1200'); }
      else { g.addColorStop(0, '#18140e'); g.addColorStop(1, '#0c0a08'); }
      rr(b.x, b.y, b.w, b.h, 4);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = heat > 0.08 ? 'rgba(255,200,80,' + (0.55 + heat * 0.45) + ')' : (live ? 'rgba(245,166,35,0.55)' : 'rgba(245,166,35,0.2)');
      ctx.lineWidth = heat > 0.08 ? 2.3 : 1.2;
      rr(b.x, b.y, b.w, b.h, 4); ctx.stroke();
      ctx.fillStyle = heat > 0.2 ? '#ffe099' : '#c4892a';
      ctx.font = '700 10px ui-monospace,monospace';
      ctx.textAlign = 'center';
      ctx.fillText(STAGES[i], b.cx, b.y + 16);
      ctx.fillStyle = '#fff0c8';
      ctx.font = '700 16px ui-monospace,monospace';
      ctx.fillText(String(vals[i]), b.cx, b.y + 36);
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

    for (var ti = tags.length - 1; ti >= 0; ti--) {
      var tg = tags[ti];
      tg.life -= dt; tg.y -= 12 * dt;
      if (tg.life <= 0) { tags.splice(ti, 1); continue; }
      ctx.globalAlpha = Math.min(1, tg.life);
      ctx.font = '600 10px ui-monospace,monospace';
      var tw = ctx.measureText(tg.text).width + 12;
      rr(tg.x - tw / 2, tg.y - 8, tw, 16, 3);
      ctx.fillStyle = 'rgba(20,14,8,0.9)'; ctx.fill();
      ctx.strokeStyle = 'rgba(245,166,35,0.45)'; ctx.lineWidth = 1;
      rr(tg.x - tw / 2, tg.y - 8, tw, 16, 3); ctx.stroke();
      ctx.fillStyle = '#f5a623'; ctx.textAlign = 'center';
      ctx.fillText(tg.text, tg.x, tg.y + 3);
      ctx.globalAlpha = 1;
    }

    requestAnimationFrame(frame);
  }

  function onResize() { resize2d(); resizeGl(); }
  window.addEventListener('resize', onResize);
  setTimeout(onResize, 30);
  setTimeout(onResize, 200);
  requestAnimationFrame(frame);

  /* ---------- data UI ---------- */
  var passLines = [];
  function renderPassBg() {
    var el = $('passBg');
    if (!el) return;
    var html = '';
    for (var c = 0; c < 5; c++) {
      var lines = [];
      for (var i = c; i < passLines.length; i += 5) lines.push(passLines[i]);
      while (lines.length < 10) lines.push('· · ·');
      var text = lines.concat(lines).join('\n');
      html += '<div class="col" style="left:' + (3 + c * 19) + '%;animation-duration:' + (16 + c * 3) + 's">' + esc(text) + '</div>';
    }
    el.innerHTML = html;
  }

  function symOf(id) {
    id = String(id || '');
    if (/wrap\.near/i.test(id)) return 'wNEAR';
    if (/usdt/i.test(id)) return 'USDT';
    if (/usdc|17208628/i.test(id)) return 'USDC';
    var name = id.replace(/^nep\d+:/, '');
    return name.length > 14 ? name.slice(0, 7) + '…' + name.slice(-3) : name;
  }
  function fmtAmount(raw, decimals) {
    try {
      var v = BigInt(raw), d = BigInt(decimals), scale = 10n ** d;
      var whole = v / scale, frac = d >= 2n ? ((v % scale) * 100n) / scale : 0n;
      return whole.toLocaleString() + '.' + frac.toString().padStart(2, '0');
    } catch (e) { return String(raw); }
  }
  function fmtUptime(ms) {
    var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm ' + (s % 60) + 's';
  }
  function kv(k, v, cls) {
    return '<div class="kv"><span class="k">' + esc(k) + '</span><span class="v ' + (cls || '') + '">' + esc(String(v)) + '</span></div>';
  }

  function renderBars(counters) {
    var entries = Object.entries(counters || {}).map(function (e) {
      return [e[0].replace(/^quote_decision:/, ''), e[1]];
    }).sort(function (a, b) { return b[1] - a[1]; });
    if (!entries.length) { $('bars').innerHTML = '<div class="empty">no decisions yet</div>'; return; }
    var max = Math.max.apply(null, entries.map(function (e) { return e[1]; }).concat([1]));
    $('bars').innerHTML = entries.map(function (e) {
      var pct = Math.round((e[1] / max) * 100);
      var cls = /would_quote|quoted/.test(e[0]) ? 'quote' : 'reject';
      return '<div class="bar-row"><span class="label" title="' + esc(e[0]) + '">' + esc(e[0]) + '</span>' +
        '<div class="bar-track"><div class="bar-fill ' + cls + '" style="width:' + pct + '%"></div></div>' +
        '<span class="bar-n">' + e[1] + '</span></div>';
    }).join('');
  }

  function renderFunnel(seen, rejected, quoted, frames) {
    var steps = [
      { name: 'BUS', n: frames, max: Math.max(frames, seen, 1) },
      { name: 'SEE', n: seen, max: Math.max(seen, 1) },
      { name: 'DECIDE', n: seen, max: Math.max(seen, 1) },
      { name: 'REJECT', n: rejected, max: Math.max(seen, 1) },
      { name: 'QUOTE', n: quoted, max: Math.max(seen, 1) }
    ];
    $('funnel').innerHTML = steps.map(function (s) {
      var pct = Math.max(4, Math.round((s.n / s.max) * 100));
      return '<div class="funnel-step' + (s.n > 0 ? ' active' : '') + '"><span class="name">' + s.name + '</span>' +
        '<div class="track"><div class="fill" style="width:' + pct + '%"></div></div><span class="n">' + s.n + '</span></div>';
    }).join('');
  }

  function renderIntent(o) {
    var gates = o.gates || {};
    var gh = ['listed', 'priced', 'inv', 'risk'].map(function (k) {
      return '<span class="gate ' + (gates[k] || 'wait') + '">' + k + '</span>';
    }).join('');
    var verdict = o.verdict, vc = 'r';
    if (!verdict && o.sample) verdict = 'Waiting';
    else if (o.ok) { verdict = o.verdict || 'Would quote'; vc = 'q'; }
    else if (verdict && /kill|daily_loss/.test(verdict)) vc = 'h';
    return '<div class="req-pair"><span class="sym">' + esc(o.symIn) + '</span><span class="arrow">→</span><span class="sym">' + esc(o.symOut) + '</span></div>' +
      '<div class="req-meta"><span>Side <b>' + esc(o.side) + '</b></span><span>Deadline ≥ <b>' + ((o.minDeadlineMs || 60000) / 1000) + 's</b></span><span>Spread <b>' + esc(o.spread || '—') + '</b></span></div>' +
      '<div class="gates">' + gh + '<span class="verdict ' + vc + '">' + esc(verdict || '—') + '</span></div>';
  }

  function fromJournal(e, dry) {
    if (!e || e.type !== 'quote_decision' || !e.decision || !e.event) return null;
    var d = e.decision, ev = e.event, ok = !!d.shouldQuote;
    var side = ev.exactAmountIn != null ? 'EXACT_IN' : 'EXACT_OUT';
    return {
      quoteId: ev.quoteId || d.quoteId,
      symIn: symOf(ev.assetIn), symOut: symOf(ev.assetOut),
      minDeadlineMs: ev.minDeadlineMs || 60000, side: side,
      spread: ok ? d.totalSpreadBps + ' bps' : null,
      gates: {
        listed: d.reason === 'asset_not_listed' ? 'fail' : 'pass',
        priced: d.reason === 'no_price' ? 'fail' : 'pass',
        inv: d.reason === 'insufficient_inventory' ? 'fail' : 'pass',
        risk: /kill|daily_loss|notional|below_min/.test(d.reason || '') ? 'fail' : (ok ? 'pass' : 'wait')
      },
      ok: ok,
      verdict: ok ? (dry ? 'Would quote' : 'Quoted') : (d.reason || 'Reject'),
      sample: false
    };
  }

  var SAMPLE = {
    symIn: 'USDC', symOut: 'wNEAR', minDeadlineMs: 60000, side: 'EXACT_IN', spread: null,
    gates: { listed: 'pass', priced: 'wait', inv: 'pass', risk: 'wait' },
    verdict: null, sample: true, ok: false
  };

  var lastWould = 0, lastReject = 0;

  function render(s, journal) {
    var dry = s.mode === 'dry-run';
    $('mode').textContent = dry ? 'Dry-run' : 'Live';
    $('mode').className = 'badge ' + (dry ? 'dry' : 'live');
    $('uptime').textContent = fmtUptime(s.uptimeMs || 0);
    var kill = $('kill');
    if (s.killSwitch) { kill.className = 'on'; kill.textContent = 'KILL SWITCH — ' + s.killSwitch; }
    else kill.className = '';

    var r = s.relay || {};
    var frames = r.framesReceived || 0;
    var hc = 'warn', ht = 'No frames (partner key)';
    if (frames > 0) { hc = 'ok'; ht = 'Receiving'; }
    else if (r.reconnects > 0) { hc = 'bad'; ht = 'Reconnect storm'; }
    $('bus').innerHTML = kv('Frames', frames) + kv('Reconnects', r.reconnects || 0) + kv('Status', ht, hc);
    var inv = s.inventory || [];
    $('inv').innerHTML = inv.map(function (l) {
      return kv(l.symbol, fmtAmount(l.availableRaw, l.decimals));
    }).join('') + kv('Reserved', s.activeReservations || 0);

    var c = s.counters || {};
    renderBars(c);
    var would = 0, rejects = 0;
    Object.keys(c).forEach(function (k) {
      if (/would_quote|quoted/.test(k)) would += c[k];
      else if (k.indexOf('quote_decision:') === 0) rejects += c[k];
    });
    var seen = would + rejects;
    renderFunnel(seen, rejects, would, frames);

    counts.bus = frames || seen;
    counts.see = seen; counts.mark = seen; counts.decide = seen; counts.risk = seen;
    counts.quote = would; counts.drop = rejects;

    if (would > lastWould) emitFlow(true);
    if (rejects > lastReject) {
      emitFlow(false);
      var top = null, topN = 0;
      Object.keys(c).forEach(function (k) {
        if (k.indexOf('quote_decision:') === 0 && !/would_quote|quoted/.test(k) && c[k] > topN) {
          topN = c[k]; top = k.replace(/^quote_decision:/, '');
        }
      });
      if (top) tags.push({ text: top, life: 3.2, x: 80, y: 36 });
    }
    lastWould = would; lastReject = rejects;

    var j = journal || [];
    passLines = [];
    j.filter(function (e) { return e && e.type === 'quote_decision' && e.decision && e.event; }).slice(-40).forEach(function (e) {
      var d = e.decision, ev = e.event;
      var pair = symOf(ev.assetIn) + '→' + symOf(ev.assetOut);
      var reason = d.shouldQuote ? (dry ? 'WOULD_QUOTE' : 'QUOTED') : (d.reason || 'REJECT');
      var det = d.shouldQuote ? (d.totalSpreadBps + 'bps') : '';
      passLines.push(pair + '  ' + reason + (det ? '  ' + det : ''));
    });
    renderPassBg();

    var card = null;
    for (var i = j.length - 1; i >= 0; i--) {
      card = fromJournal(j[i], dry);
      if (card) break;
    }
    if (card) {
      $('intentHint').textContent = card.quoteId || '';
      $('intentCard').innerHTML = renderIntent(card);
    } else {
      $('intentHint').textContent = 'idle';
      $('intentCard').innerHTML = renderIntent(SAMPLE);
    }

    var rows = j.slice(-28).reverse().map(function (e) {
      if (!e || e.type !== 'quote_decision' || !e.decision || !e.event) return '';
      var d = e.decision, ev = e.event;
      var pair = symOf(ev.assetIn) + ' → ' + symOf(ev.assetOut);
      var reason = d.shouldQuote ? (dry ? 'would_quote' : 'quoted') : d.reason;
      var det = d.shouldQuote ? d.totalSpreadBps + ' bps' : '';
      var chip = d.shouldQuote ? 'q' : (/kill|daily_loss/.test(reason || '') ? 'h' : 'r');
      return '<div class="line"><span class="t">' + new Date(e.tMs || Date.now()).toISOString().slice(11, 19) +
        '</span><span class="pair">' + esc(pair) + '</span><span style="color:var(--muted)">' + esc(det) +
        '</span><span class="chip ' + chip + '">' + esc(reason) + '</span></div>';
    }).join('');
    $('stream').innerHTML = rows || '<div class="empty">npm run solver:cover</div>';
  }

  async function tick() {
    try {
      var status = await fetch('/api/status').then(function (r) { return r.json(); });
      var journal = await fetch('/api/journal/recent').then(function (r) { return r.json(); });
      render(status, journal);
    } catch (err) {
      console.error('desk tick', err);
    }
    $('clock').textContent = new Date().toISOString().slice(11, 19) + 'Z';
  }
  tick();
  setInterval(tick, 2000);
  $('intentCard').innerHTML = renderIntent(SAMPLE);
})();
</script>
</body>
</html>`;
