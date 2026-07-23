/**
 * NEAR SOLVER DESK — circuit breaker + 2D FBM noise (always paints).
 */

export const DASHBOARD_HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>NEAR SOLVER DESK</title>
<style>
html,body{height:100%;margin:0;background:#07090c;color:#e8eef0;font:13px/1.4 system-ui,sans-serif;overflow:hidden}
.shell{height:100%;display:grid;grid-template-rows:44px 1fr 110px}
header{display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid #1a2228;background:#0a0e12}
.logo{width:26px;height:26px;background:#f5a623;color:#1a0a00;display:grid;place-items:center;font:700 10px ui-monospace,monospace;border-radius:3px}
h1{font:600 13px system-ui;margin:0}.sub{color:#6b7c86;font-weight:400;font-size:11px;margin-left:6px}
.badge{font:600 9px ui-monospace,monospace;padding:2px 7px;border-radius:3px;text-transform:uppercase;background:#3d2a00;color:#f5a623}
.right{margin-left:auto;font:11px ui-monospace,monospace;color:#6b7c86}.right b{color:#e8eef0}
.main{display:grid;grid-template-columns:210px 1fr 210px;gap:10px;padding:10px;min-height:0}
.card{background:#0e1318;border:1px solid #1a2228;border-radius:4px;padding:10px;overflow:auto}
.card h2{font:600 10px system-ui;color:#6b7c86;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px}
.hero{background:#05070a;border:1px solid #1a2228;border-radius:4px;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.hero h2{font:600 10px system-ui;color:#6b7c86;text-transform:uppercase;letter-spacing:.06em;margin:0;padding:8px 12px 0}
.stage{position:relative;flex:1;min-height:240px}
#c{position:absolute;inset:0;width:100%;height:100%;display:block}
.intent{padding:8px 12px;border-top:1px solid #1a2228;background:#0e1318;font:12px ui-monospace,monospace;text-align:center}
.kv{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #1a2228;font:11px ui-monospace,monospace}
.kv span:first-child{color:#6b7c86}
.bar{display:grid;grid-template-columns:80px 1fr 28px;gap:6px;align-items:center;margin-bottom:5px;font:11px ui-monospace,monospace}
.bar .l{color:#6b7c86;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar .t{height:11px;background:#080b0e;border:1px solid #1a2228;border-radius:2px;overflow:hidden}
.bar .f{height:100%;background:#f5a623}
.bar .f.q{background:#2dd4bf}
.bar .n{text-align:right;font-weight:600}
.fun .row{display:grid;grid-template-columns:48px 1fr 28px;gap:5px;align-items:center;margin-bottom:4px;font:11px ui-monospace,monospace}
.fun .row .nm{color:#6b7c86;font-weight:600}
.fun .row .tk{height:14px;background:#080b0e;border:1px solid #1a2228;border-radius:2px;overflow:hidden}
.fun .row .fl{height:100%;background:linear-gradient(90deg,#7c4a00,#f5a623)}
.tape{border-top:1px solid #1a2228;background:#0e1318;padding:6px 14px;overflow:auto;font:11px ui-monospace,monospace}
.tape h2{font:600 10px system-ui;color:#6b7c86;text-transform:uppercase;margin:0 0 4px;display:flex;justify-content:space-between}
.line{display:grid;grid-template-columns:48px 1fr auto;gap:8px;padding:2px 0;border-bottom:1px solid #1a2228}
.line .t{color:#6b7c86}
.chip{font:700 9px ui-monospace,monospace;padding:1px 5px;border-radius:2px;text-transform:uppercase;background:#3d2a00;color:#f5a623}
.chip.q{background:#042f2e;color:#2dd4bf}
.muted{color:#6b7c86}
.gate{display:inline-block;font:600 9px ui-monospace,monospace;padding:2px 6px;margin:2px;border:1px solid #2a3238;border-radius:2px;color:#6b7c86;text-transform:uppercase}
.gate.pass{color:#2dd4bf;border-color:#115e59;background:#042f2e}
.gate.fail{color:#f43f5e;border-color:#9f1239;background:#4c0519}
.gate.wait{color:#f5a623;border-color:#7c4a00;background:#3d2a00}
</style>
</head>
<body>
<div class="shell">
  <header>
    <div class="logo">NS</div>
    <h1>Near Solver Desk<span class="sub">CavalRe · FBM circuit</span></h1>
    <span class="badge" id="mode">dry-run</span>
    <div class="right">uptime <b id="up">—</b> · <span id="clk">—</span></div>
  </header>
  <div class="main">
    <div class="card">
      <h2>Decision mix</h2>
      <div id="bars" class="muted">waiting…</div>
    </div>
    <div class="hero">
      <h2>Circuit · 5-octave FBM noise field</h2>
      <div class="stage"><canvas id="c"></canvas></div>
      <div class="intent" id="intent">USDC → wNEAR · waiting</div>
    </div>
    <div class="card">
      <h2>Path funnel</h2>
      <div class="fun" id="funnel"></div>
      <h2 style="margin-top:12px">Bus &amp; inventory</h2>
      <div id="bus"></div>
      <div id="inv"></div>
    </div>
  </div>
  <div class="tape">
    <h2>Decision tape <span id="hint" class="muted">—</span></h2>
    <div id="stream" class="muted">npm run solver:cover</div>
  </div>
</div>
<script>
(function(){
  "use strict";
  var STAGES = ["BUS","SEE","MARK","DECIDE","RISK","QUOTE"];
  var counts = [0,0,0,0,0,0];
  var drop = 0;
  var heat = [0,0,0,0,0,0];
  var links = [];
  var burst = 0;
  var lastWould = 0, lastReject = 0;

  var cv = document.getElementById("c");
  var ctx = cv.getContext("2d");
  var W = 0, H = 0, dpr = 1;

  /* ---- FBM / value noise (2D, 5 octaves) ---- */
  function hash(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
  function noise(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y);
    var fx = x - ix, fy = y - iy;
    var ux = fx * fx * (3 - 2 * fx);
    var uy = fy * fy * (3 - 2 * fy);
    var a = hash(ix, iy);
    var b = hash(ix + 1, iy);
    var c = hash(ix, iy + 1);
    var d = hash(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy * (1 - ux) + (d - b) * ux * uy;
  }
  function fbm(x, y, oct) {
    var v = 0, a = 0.5, f = 1, i;
    for (i = 0; i < oct; i++) {
      v += a * noise(x * f, y * f);
      f *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  /* offscreen noise buffer, refreshed slowly */
  var noiseCV = document.createElement("canvas");
  var noiseCTX = noiseCV.getContext("2d");
  var noiseT = 0;

  function bakeNoise(t) {
    var nw = Math.max(80, Math.floor(W / 4));
    var nh = Math.max(45, Math.floor(H / 4));
    if (noiseCV.width !== nw || noiseCV.height !== nh) {
      noiseCV.width = nw;
      noiseCV.height = nh;
    }
    var img = noiseCTX.createImageData(nw, nh);
    var data = img.data;
    var aspect = nw / Math.max(1, nh);
    var i, x, y, u, v, n1, n2, flow, spark, conduit, r, g, b, al, o;
    for (y = 0; y < nh; y++) {
      for (x = 0; x < nw; x++) {
        u = (x / nw) * aspect * 3;
        v = (y / nh) * 3;
        n1 = fbm(u + t * 0.12, v + t * 0.08, 5);
        n2 = fbm(u * 2.1 - t * 0.2, v * 2.1 + t * 0.1, 4);
        flow = Math.max(0, Math.min(1, (n1 - 0.3) / 0.4));
        spark = Math.max(0, Math.min(1, (n2 - 0.7) / 0.25));
        conduit = Math.exp(-Math.pow((y / nh - 0.4) * 5.5, 2));
        r = (0.96 * (0.05 + flow * 0.2 + spark * 0.45 + conduit * (0.08 + burst * 0.15))) * 255;
        g = (0.65 * (0.04 + flow * 0.12 + spark * 0.25 + conduit * 0.05)) * 255;
        b = (0.14 + spark * 0.35 * conduit) * 255;
        al = (0.2 + flow * 0.35 + spark * 0.4 + conduit * 0.15 + burst * 0.12) * 255;
        o = (y * nw + x) * 4;
        data[o] = r; data[o+1] = g; data[o+2] = b; data[o+3] = Math.min(220, al);
      }
    }
    noiseCTX.putImageData(img, 0, 0);
  }

  function resize() {
    var r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    cv.width = Math.floor(W * dpr);
    cv.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bakeNoise(noiseT);
  }
  window.addEventListener("resize", resize);

  function boxes() {
    var n = STAGES.length, pad = 20;
    var bw = Math.min(72, (W - pad * 2) / n - 8);
    var bh = 56;
    var gap = (W - pad * 2 - bw * n) / Math.max(1, n - 1);
    var y = H * 0.38 - bh / 2;
    var out = [], i, x;
    for (i = 0; i < n; i++) {
      x = pad + i * (bw + gap);
      out.push({ x: x, y: y, w: bw, h: bh, cx: x + bw / 2, cy: y + bh / 2 });
    }
    return out;
  }

  function spawn(a, b, ok) {
    if (links.length > 250) return;
    links.push({ a: a, b: b, t: 0, sp: 0.45 + Math.random() * 0.4, ok: ok, amp: 5 + Math.random() * 14, ph: Math.random() * 6.28 });
  }
  function emit(ok) {
    burst = 1;
    var i;
    for (i = 0; i < STAGES.length - 1; i++) {
      (function(idx){
        setTimeout(function(){
          var k;
          for (k = 0; k < 4; k++) spawn(idx, idx + 1, ok);
          heat[idx] = 1;
          if (idx === STAGES.length - 2) heat[idx + 1] = 1;
        }, idx * 55);
      })(i);
    }
  }

  function rr(x, y, w, h, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  var last = 0, bakeAcc = 0;
  function frame(ts) {
    var dt = Math.min(0.033, ((ts - last) / 1000) || 0.016);
    last = ts;
    noiseT += dt;
    bakeAcc += dt;
    burst = Math.max(0, burst - dt * 0.4);
    if (W < 4) resize();
    if (bakeAcc > 0.08) { bakeAcc = 0; bakeNoise(noiseT); }

    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(noiseCV, 0, 0, W, H);
    ctx.globalAlpha = 1;

    // floor lines
    ctx.strokeStyle = "rgba(245,166,35,0.06)";
    ctx.lineWidth = 1;
    var hz = H * 0.68, gi, gy;
    for (gi = 0; gi < 8; gi++) {
      gy = hz + gi * gi * 2;
      if (gy > H) break;
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(245,166,35," + (0.1 + burst * 0.12) + ")";
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.42, W * 0.38, H * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();

    var bx = boxes();
    var i, p, A, B, x, y, a, b, live, g;
    for (i = 0; i < heat.length; i++) heat[i] = Math.max(0, heat[i] - dt * 0.5);

    for (i = links.length - 1; i >= 0; i--) {
      p = links[i];
      p.t += p.sp * dt;
      if (p.t >= 1) { links.splice(i, 1); continue; }
      A = bx[p.a]; B = bx[p.b];
      if (!A || !B) continue;
      x = A.cx + (B.cx - A.cx) * p.t;
      y = A.cy + (B.cy - A.cy) * p.t + Math.sin(p.t * Math.PI * 2 + p.ph) * p.amp * Math.sin(p.t * Math.PI);
      a = Math.sin(p.t * Math.PI);
      ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = p.ok ? "rgba(45,212,191," + (0.45 + a * 0.5) + ")" : "rgba(255,200,80," + (0.45 + a * 0.5) + ")";
      ctx.fill();
    }
    if (Math.random() < 0.12) {
      i = Math.floor(Math.random() * (STAGES.length - 1));
      spawn(i, i + 1, Math.random() > 0.35);
    }

    for (i = 0; i < bx.length; i++) {
      b = bx[i];
      live = counts[i] > 0;
      a = heat[i];
      if (a > 0.05) {
        ctx.save();
        ctx.shadowColor = "rgba(245,166,35," + (0.45 + a * 0.5) + ")";
        ctx.shadowBlur = 22 + a * 30;
        rr(b.x, b.y, b.w, b.h, 4);
        ctx.fillStyle = "rgba(245,166,35,0.08)";
        ctx.fill();
        ctx.restore();
      }
      g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      if (a > 0.25) { g.addColorStop(0, "#6b450c"); g.addColorStop(1, "#2e1a00"); }
      else if (live) { g.addColorStop(0, "#3d2a00"); g.addColorStop(1, "#1a1200"); }
      else { g.addColorStop(0, "#1a1610"); g.addColorStop(1, "#0c0a08"); }
      rr(b.x, b.y, b.w, b.h, 4);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = a > 0.08 ? "rgba(255,200,80," + (0.55 + a * 0.45) + ")" : (live ? "rgba(245,166,35,0.55)" : "rgba(245,166,35,0.28)");
      ctx.lineWidth = a > 0.08 ? 2.4 : 1.3;
      rr(b.x, b.y, b.w, b.h, 4); ctx.stroke();
      ctx.fillStyle = a > 0.2 ? "#ffe099" : "#c4892a";
      ctx.font = "700 10px ui-monospace,monospace";
      ctx.textAlign = "center";
      ctx.fillText(STAGES[i], b.cx, b.y + 16);
      ctx.fillStyle = "#fff0c8";
      ctx.font = "700 16px ui-monospace,monospace";
      ctx.fillText(String(counts[i]), b.cx, b.y + 36);
      ctx.font = "600 8px ui-monospace,monospace";
      if (i === 3 && drop > 0) {
        ctx.fillStyle = "#f43f5e";
        ctx.fillText("DROP -" + drop, b.cx, b.y + b.h - 7);
      } else if (counts[i] > 0) {
        ctx.fillStyle = "rgba(45,212,191,0.8)";
        ctx.fillText("PASS", b.cx, b.y + b.h - 7);
      } else {
        ctx.fillStyle = "rgba(107,124,134,0.5)";
        ctx.fillText("—", b.cx, b.y + b.h - 7);
      }
    }

    // debug strip so we always know the loop is alive
    ctx.fillStyle = "rgba(107,124,134,0.7)";
    ctx.font = "10px ui-monospace,monospace";
    ctx.textAlign = "left";
    ctx.fillText("FBM×5 · links=" + links.length + " · " + Math.round(W) + "x" + Math.round(H), 8, H - 8);

    requestAnimationFrame(frame);
  }

  setTimeout(resize, 20);
  setTimeout(resize, 100);
  setTimeout(resize, 300);
  requestAnimationFrame(frame);

  /* ---- API ---- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function(c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function sym(id) {
    id = String(id || "");
    if (/wrap\.near/i.test(id)) return "wNEAR";
    if (/usdt/i.test(id)) return "USDT";
    if (/usdc|17208628/i.test(id)) return "USDC";
    var n = id.replace(/^nep\d+:/, "");
    return n.length > 14 ? n.slice(0, 7) + "…" + n.slice(-3) : n;
  }
  function fmtAmt(raw, dec) {
    try {
      var v = BigInt(raw), d = BigInt(dec), s = 10n ** d;
      var w = v / s, f = d >= 2n ? ((v % s) * 100n) / s : 0n;
      return w.toLocaleString() + "." + f.toString().padStart(2, "0");
    } catch (e) { return String(raw); }
  }
  function uptime(ms) {
    var s = Math.floor((ms || 0) / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? h + "h " + m + "m" : m + "m " + (s % 60) + "s";
  }

  function render(s, journal) {
    var dry = !s || s.mode !== "live";
    document.getElementById("mode").textContent = dry ? "dry-run" : "live";
    document.getElementById("up").textContent = uptime(s && s.uptimeMs);

    var r = (s && s.relay) || {};
    var frames = r.framesReceived || 0;
    var bus = document.getElementById("bus");
    bus.innerHTML =
      "<div class=\"kv\"><span>Frames</span><span>" + frames + "</span></div>" +
      "<div class=\"kv\"><span>Reconnects</span><span>" + (r.reconnects || 0) + "</span></div>" +
      "<div class=\"kv\"><span>Status</span><span style=\"color:#f5a623\">" + (frames > 0 ? "up" : "no frames") + "</span></div>";

    var inv = (s && s.inventory) || [];
    document.getElementById("inv").innerHTML = inv.map(function(l) {
      return "<div class=\"kv\"><span>" + esc(l.symbol) + "</span><span>" + esc(fmtAmt(l.availableRaw, l.decimals)) + "</span></div>";
    }).join("") + "<div class=\"kv\"><span>Reserved</span><span>" + ((s && s.activeReservations) || 0) + "</span></div>";

    var c = (s && s.counters) || {};
    var keys = Object.keys(c);
    var would = 0, rejects = 0;
    keys.forEach(function(k) {
      if (/would_quote|quoted/.test(k)) would += c[k];
      else if (k.indexOf("quote_decision:") === 0) rejects += c[k];
    });
    var seen = would + rejects;
    counts = [frames || seen, seen, seen, seen, seen, would];
    drop = rejects;

    if (would > lastWould) emit(true);
    if (rejects > lastReject) emit(false);
    lastWould = would; lastReject = rejects;

    var max = 1;
    keys.forEach(function(k) { if (c[k] > max) max = c[k]; });
    if (!keys.length) {
      document.getElementById("bars").innerHTML = "<div class=\"muted\">no decisions yet</div>";
    } else {
      document.getElementById("bars").innerHTML = keys.map(function(k) {
        var name = k.replace(/^quote_decision:/, "");
        var pct = Math.round((c[k] / max) * 100);
        var cls = /would_quote|quoted/.test(k) ? "q" : "";
        return "<div class=\"bar\"><div class=\"l\" title=\"" + esc(name) + "\">" + esc(name) + "</div>" +
          "<div class=\"t\"><div class=\"f " + cls + "\" style=\"width:" + pct + "%\"></div></div>" +
          "<div class=\"n\">" + c[k] + "</div></div>";
      }).sort(function(a, b) { return 0; }).join("");
      // re-sort by count
      document.getElementById("bars").innerHTML = keys.slice().sort(function(a, b) { return c[b] - c[a]; }).map(function(k) {
        var name = k.replace(/^quote_decision:/, "");
        var pct = Math.round((c[k] / max) * 100);
        var cls = /would_quote|quoted/.test(k) ? "q" : "";
        return "<div class=\"bar\"><div class=\"l\" title=\"" + esc(name) + "\">" + esc(name) + "</div>" +
          "<div class=\"t\"><div class=\"f " + cls + "\" style=\"width:" + pct + "%\"></div></div>" +
          "<div class=\"n\">" + c[k] + "</div></div>";
      }).join("");
    }

    var steps = [
      { n: "BUS", v: frames, m: Math.max(frames, seen, 1) },
      { n: "SEE", v: seen, m: Math.max(seen, 1) },
      { n: "DECIDE", v: seen, m: Math.max(seen, 1) },
      { n: "REJECT", v: rejects, m: Math.max(seen, 1) },
      { n: "QUOTE", v: would, m: Math.max(seen, 1) }
    ];
    document.getElementById("funnel").innerHTML = steps.map(function(s) {
      var pct = Math.max(4, Math.round((s.v / s.m) * 100));
      return "<div class=\"row\"><span class=\"nm\">" + s.n + "</span><div class=\"tk\"><div class=\"fl\" style=\"width:" + pct + "%\"></div></div><span>" + s.v + "</span></div>";
    }).join("");

    var j = journal || [];
    var card = null, i, e, d, ev, ok, side, gates, gh, verdict, vc;
    for (i = j.length - 1; i >= 0; i--) {
      e = j[i];
      if (!e || e.type !== "quote_decision" || !e.decision || !e.event) continue;
      d = e.decision; ev = e.event; ok = !!d.shouldQuote;
      side = ev.exactAmountIn != null ? "EXACT_IN" : "EXACT_OUT";
      gates = {
        listed: d.reason === "asset_not_listed" ? "fail" : "pass",
        priced: d.reason === "no_price" ? "fail" : "pass",
        inv: d.reason === "insufficient_inventory" ? "fail" : "pass",
        risk: /kill|daily_loss|notional|below_min/.test(d.reason || "") ? "fail" : (ok ? "pass" : "wait")
      };
      gh = ["listed","priced","inv","risk"].map(function(k) {
        return "<span class=\"gate " + gates[k] + "\">" + k + "</span>";
      }).join("");
      verdict = ok ? (dry ? "Would quote" : "Quoted") : (d.reason || "Reject");
      vc = ok ? "pass" : "fail";
      document.getElementById("intent").innerHTML =
        "<div style=\"font:700 16px system-ui;margin-bottom:4px\">" + esc(sym(ev.assetIn)) + " → " + esc(sym(ev.assetOut)) + "</div>" +
        "<div class=\"muted\">" + side + " · ≥" + ((ev.minDeadlineMs || 60000) / 1000) + "s · " + (ok ? d.totalSpreadBps + " bps" : "—") + "</div>" +
        "<div style=\"margin-top:6px\">" + gh + " <span class=\"gate " + vc + "\">" + esc(verdict) + "</span></div>";
      document.getElementById("hint").textContent = ev.quoteId || d.quoteId || "";
      card = true;
      break;
    }
    if (!card) {
      document.getElementById("intent").innerHTML = "<div style=\"font:700 16px system-ui\">USDC → wNEAR</div><div class=\"muted\">idle · run solver:cover</div>";
      document.getElementById("hint").textContent = "idle";
    }

    var rows = j.filter(function(e) { return e && e.type === "quote_decision" && e.decision && e.event; }).slice(-30).reverse().map(function(e) {
      d = e.decision; ev = e.event;
      var pair = sym(ev.assetIn) + " → " + sym(ev.assetOut);
      var reason = d.shouldQuote ? (dry ? "would_quote" : "quoted") : d.reason;
      var cls = d.shouldQuote ? "q" : "";
      return "<div class=\"line\"><span class=\"t\">" + new Date(e.tMs || Date.now()).toISOString().slice(11, 19) +
        "</span><span>" + esc(pair) + "</span><span class=\"chip " + cls + "\">" + esc(reason) + "</span></div>";
    }).join("");
    document.getElementById("stream").innerHTML = rows || "<div class=\"muted\">npm run solver:cover</div>";
  }

  function tick() {
    document.getElementById("clk").textContent = new Date().toISOString().slice(11, 19) + "Z";
    Promise.all([
      fetch("/api/status").then(function(r) { return r.json(); }),
      fetch("/api/journal/recent").then(function(r) { return r.json(); })
    ]).then(function(pair) {
      render(pair[0], pair[1]);
    }).catch(function(err) {
      console.error(err);
    });
  }
  tick();
  setInterval(tick, 2000);
})();
</script>
</body>
</html>`;
