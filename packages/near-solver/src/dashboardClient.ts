/**
 * Desk client — isometric glass blockchain lattice under circuit stages.
 */

export const DASHBOARD_JS = `
(function () {
  "use strict";

  var STAGES = ["BUS", "SEE", "MARK", "DECIDE", "RISK", "QUOTE"];
  var counts = [0, 0, 0, 0, 0, 0];
  var drop = 0;
  var heat = [0, 0, 0, 0, 0, 0];
  var links = [];
  var burst = 0;
  var lastWould = 0;
  var lastReject = 0;

  var cv = document.getElementById("c");
  if (!cv) {
    console.error("[desk] #c canvas missing");
    return;
  }
  var ctx = cv.getContext("2d");
  var W = 0;
  var H = 0;
  var dpr = 1;
  var t0 = performance.now();

  /* isometric glass lattice */
  var nodes = [];
  var edges = [];
  var packets = [];

  function hash(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function rebuild() {
    nodes = [];
    edges = [];
    if (W < 20 || H < 20) return;

    // isometric grid density
    var cols = Math.max(8, Math.floor(W / 52));
    var rows = Math.max(6, Math.floor(H / 38));
    var originX = W * 0.5;
    var originY = H * 0.12;
    var tileW = Math.min(28, W / (cols * 1.15));
    var tileH = tileW * 0.55;
    var i, j, idx;

    for (j = 0; j < rows; j++) {
      for (i = 0; i < cols; i++) {
        // classic iso projection
        var ix = (i - j) * tileW * 0.9;
        var iy = (i + j) * tileH * 0.9;
        var elev = hash(i * 1.7, j * 2.3) * 10;
        nodes.push({
          i: i,
          j: j,
          x: originX + ix,
          y: originY + iy - elev,
          elev: elev,
          size: tileW * (0.72 + hash(i, j) * 0.2),
          phase: hash(i + 3, j + 5) * Math.PI * 2,
          hot: hash(i * 4, j * 4),
          depth: i + j,
        });
      }
    }

    // chain along row + selective DAG down
    for (j = 0; j < rows; j++) {
      for (i = 0; i < cols; i++) {
        idx = j * cols + i;
        if (i < cols - 1) edges.push({ a: idx, b: idx + 1, kind: 0 });
        if (j < rows - 1) {
          edges.push({ a: idx, b: idx + cols, kind: 1 });
          if (i < cols - 1 && hash(i, j) > 0.55)
            edges.push({ a: idx, b: idx + cols + 1, kind: 2 });
        }
      }
    }

    // sort nodes back-to-front for painter's algorithm
    nodes.sort(function (a, b) {
      return a.depth - b.depth;
    });
  }

  function drawIsoCube(x, y, s, pulse, hot) {
    var hw = s * 0.5;
    var hh = s * 0.28;
    var depth = s * 0.32;

    // shadow under block
    ctx.beginPath();
    ctx.ellipse(x, y + depth + 4, hw * 0.9, hh * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0," + (0.25 + pulse * 0.1) + ")";
    ctx.fill();

    var top = 0.1 + hot * 0.08 + pulse * 0.06 + burst * 0.08;
    var left = 0.06 + hot * 0.04;
    var right = 0.04 + hot * 0.03;

    // left face
    ctx.beginPath();
    ctx.moveTo(x - hw, y);
    ctx.lineTo(x, y + hh);
    ctx.lineTo(x, y + hh + depth);
    ctx.lineTo(x - hw, y + depth);
    ctx.closePath();
    ctx.fillStyle = "rgba(12, 40, 38, " + (0.35 + left) + ")";
    ctx.fill();
    ctx.strokeStyle = "rgba(45, 212, 191, " + (0.2 + pulse * 0.15) + ")";
    ctx.lineWidth = 1;
    ctx.stroke();

    // right face
    ctx.beginPath();
    ctx.moveTo(x + hw, y);
    ctx.lineTo(x, y + hh);
    ctx.lineTo(x, y + hh + depth);
    ctx.lineTo(x + hw, y + depth);
    ctx.closePath();
    ctx.fillStyle = "rgba(8, 28, 26, " + (0.4 + right) + ")";
    ctx.fill();
    ctx.strokeStyle = "rgba(45, 212, 191, " + (0.15 + pulse * 0.1) + ")";
    ctx.stroke();

    // top face (glass)
    ctx.beginPath();
    ctx.moveTo(x, y - hh);
    ctx.lineTo(x + hw, y);
    ctx.lineTo(x, y + hh);
    ctx.lineTo(x - hw, y);
    ctx.closePath();
    var tg = ctx.createLinearGradient(x - hw, y - hh, x + hw, y + hh);
    tg.addColorStop(0, "rgba(45, 212, 191, " + (0.12 + top) + ")");
    tg.addColorStop(0.5, "rgba(245, 166, 35, " + (0.06 + top * 0.5) + ")");
    tg.addColorStop(1, "rgba(20, 60, 55, " + (0.18 + top) + ")");
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.strokeStyle = "rgba(180, 255, 240, " + (0.25 + pulse * 0.25 + burst * 0.2) + ")";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // specular glint on top
    ctx.beginPath();
    ctx.moveTo(x - hw * 0.35, y - hh * 0.2);
    ctx.lineTo(x - hw * 0.05, y - hh * 0.55);
    ctx.strokeStyle = "rgba(255,255,255," + (0.08 + pulse * 0.1) + ")";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawBeams(t) {
    var k, e, a, b, mx, my, flow, gx;
    for (k = 0; k < edges.length; k++) {
      e = edges[k];
      a = nodes[e.a];
      b = nodes[e.b];
      if (!a || !b) continue;

      // base cable
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = "rgba(45, 212, 191, 0.08)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // energy pulse along edge
      flow = (t * 0.4 + a.phase * 0.15 + k * 0.01) % 1;
      mx = a.x + (b.x - a.x) * flow;
      my = a.y + (b.y - a.y) * flow;

      gx = ctx.createRadialGradient(mx, my, 0, mx, my, 10);
      gx.addColorStop(0, "rgba(245, 166, 35, " + (0.45 + burst * 0.3) + ")");
      gx.addColorStop(0.4, "rgba(45, 212, 191, 0.2)");
      gx.addColorStop(1, "rgba(45, 212, 191, 0)");
      ctx.fillStyle = gx;
      ctx.beginPath();
      ctx.arc(mx, my, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(mx, my, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 230, 180, 0.9)";
      ctx.fill();
    }
  }

  function drawLattice(now) {
    var t = (now - t0) / 1000;
    var k, n, pulse;

    // deep atmosphere
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#060a0e");
    sky.addColorStop(0.5, "#05080c");
    sky.addColorStop(1, "#030507");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // distant grid fade
    ctx.strokeStyle = "rgba(45,212,191,0.03)";
    ctx.lineWidth = 1;
    for (k = 0; k < 12; k++) {
      var gy = H * 0.55 + k * k * 1.5;
      if (gy > H) break;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }

    drawBeams(t);

    // blocks back-to-front (nodes already sorted by depth)
    for (k = 0; k < nodes.length; k++) {
      n = nodes[k];
      // skip if far outside view
      if (n.x < -40 || n.x > W + 40 || n.y < -40 || n.y > H + 40) continue;
      pulse = 0.5 + 0.5 * Math.sin(t * 1.4 + n.phase);
      drawIsoCube(n.x, n.y, n.size, pulse, n.hot);
    }
  }

  function resize() {
    var r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(2, r.width);
    H = Math.max(2, r.height);
    cv.width = Math.floor(W * dpr);
    cv.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuild();
  }
  window.addEventListener("resize", resize);

  function stageBoxes() {
    var n = STAGES.length;
    var pad = 24;
    var bw = Math.min(76, (W - pad * 2) / n - 10);
    var bh = 58;
    var gap = (W - pad * 2 - bw * n) / Math.max(1, n - 1);
    var y = H * 0.36 - bh / 2;
    var out = [];
    for (var i = 0; i < n; i++) {
      var x = pad + i * (bw + gap);
      out.push({ x: x, y: y, w: bw, h: bh, cx: x + bw / 2, cy: y + bh / 2 });
    }
    return out;
  }

  function spawn(a, b, ok) {
    if (links.length > 280) return;
    links.push({
      a: a,
      b: b,
      t: 0,
      sp: 0.5 + Math.random() * 0.35,
      ok: ok,
      amp: 4 + Math.random() * 12,
      ph: Math.random() * 6.28,
      trail: [],
    });
  }

  function emit(ok) {
    burst = 1;
    for (var i = 0; i < STAGES.length - 1; i++) {
      (function (idx) {
        setTimeout(function () {
          for (var k = 0; k < 5; k++) spawn(idx, idx + 1, ok);
          heat[idx] = 1;
          if (idx === STAGES.length - 2) heat[idx + 1] = 1;
        }, idx * 50);
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

  var last = 0;
  function frame(ts) {
    var dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
    last = ts;
    burst = Math.max(0, burst - dt * 0.4);
    if (W < 4) resize();

    drawLattice(ts);

    // focus vignette so stages pop
    var vg = ctx.createRadialGradient(W / 2, H * 0.38, 30, W / 2, H * 0.4, Math.max(W, H) * 0.7);
    vg.addColorStop(0, "rgba(5,7,10,0)");
    vg.addColorStop(0.55, "rgba(5,7,10,0.15)");
    vg.addColorStop(1, "rgba(5,7,10,0.7)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // orbit ring
    ctx.strokeStyle = "rgba(245,166,35," + (0.12 + burst * 0.18) + ")";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.4, W * 0.4, H * 0.16, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(45,212,191," + (0.08 + burst * 0.1) + ")";
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.4, W * 0.32, H * 0.12, 0, 0, Math.PI * 2);
    ctx.stroke();

    var bx = stageBoxes();
    for (var hi = 0; hi < heat.length; hi++) heat[hi] = Math.max(0, heat[hi] - dt * 0.5);

    // stage packets with trails
    for (var li = links.length - 1; li >= 0; li--) {
      var p = links[li];
      p.t += p.sp * dt;
      if (p.t >= 1) {
        links.splice(li, 1);
        continue;
      }
      var A = bx[p.a];
      var B = bx[p.b];
      if (!A || !B) continue;
      var px = A.cx + (B.cx - A.cx) * p.t;
      var py =
        A.cy +
        (B.cy - A.cy) * p.t +
        Math.sin(p.t * Math.PI * 2 + p.ph) * p.amp * Math.sin(p.t * Math.PI);
      p.trail.push({ x: px, y: py });
      if (p.trail.length > 10) p.trail.shift();
      if (p.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (var ti = 1; ti < p.trail.length; ti++) ctx.lineTo(p.trail[ti].x, p.trail[ti].y);
        ctx.strokeStyle = p.ok ? "rgba(45,212,191,0.25)" : "rgba(245,166,35,0.25)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      var pa = Math.sin(p.t * Math.PI);
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = p.ok
        ? "rgba(45,212,191," + (0.5 + pa * 0.5) + ")"
        : "rgba(255,200,80," + (0.5 + pa * 0.5) + ")";
      ctx.fill();
    }
    if (Math.random() < 0.1) {
      var si = Math.floor(Math.random() * (STAGES.length - 1));
      spawn(si, si + 1, Math.random() > 0.35);
    }

    // circuit stage cards
    for (var i = 0; i < bx.length; i++) {
      var b = bx[i];
      var live = counts[i] > 0;
      var a = heat[i];

      // floating platform shadow
      ctx.beginPath();
      ctx.ellipse(b.cx, b.y + b.h + 6, b.w * 0.45, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fill();

      if (a > 0.05) {
        ctx.save();
        ctx.shadowColor = "rgba(245,166,35," + (0.5 + a * 0.5) + ")";
        ctx.shadowBlur = 28 + a * 35;
        rr(b.x, b.y, b.w, b.h, 6);
        ctx.fillStyle = "rgba(245,166,35,0.1)";
        ctx.fill();
        ctx.restore();
      }

      var g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      if (a > 0.25) {
        g.addColorStop(0, "#7a5210");
        g.addColorStop(1, "#2a1800");
      } else if (live) {
        g.addColorStop(0, "#4a3208");
        g.addColorStop(1, "#1a1000");
      } else {
        g.addColorStop(0, "rgba(30,24,14,0.95)");
        g.addColorStop(1, "rgba(12,10,6,0.95)");
      }
      rr(b.x, b.y, b.w, b.h, 6);
      ctx.fillStyle = g;
      ctx.fill();

      // glass top edge
      ctx.strokeStyle =
        a > 0.08
          ? "rgba(255,210,100," + (0.6 + a * 0.4) + ")"
          : live
            ? "rgba(245,166,35,0.65)"
            : "rgba(245,166,35,0.4)";
      ctx.lineWidth = a > 0.08 ? 2.2 : 1.4;
      rr(b.x, b.y, b.w, b.h, 6);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,230,150," + (0.15 + a * 0.35) + ")";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.x + 8, b.y + 2);
      ctx.lineTo(b.x + b.w - 8, b.y + 2);
      ctx.stroke();

      ctx.fillStyle = a > 0.2 ? "#ffe6a0" : "#d4a017";
      ctx.font = "700 10px ui-monospace,monospace";
      ctx.textAlign = "center";
      ctx.fillText(STAGES[i], b.cx, b.y + 17);
      ctx.fillStyle = "#fff6d0";
      ctx.font = "700 18px ui-monospace,monospace";
      ctx.fillText(String(counts[i]), b.cx, b.y + 38);
      ctx.font = "600 8px ui-monospace,monospace";
      if (i === 3 && drop > 0) {
        ctx.fillStyle = "#f43f5e";
        ctx.fillText("DROP -" + drop, b.cx, b.y + b.h - 8);
      } else if (counts[i] > 0) {
        ctx.fillStyle = "rgba(45,212,191,0.9)";
        ctx.fillText("PASS", b.cx, b.y + b.h - 8);
      } else {
        ctx.fillStyle = "rgba(107,124,134,0.55)";
        ctx.fillText("—", b.cx, b.y + b.h - 8);
      }
    }

    ctx.fillStyle = "rgba(120,160,150,0.7)";
    ctx.font = "10px ui-monospace,monospace";
    ctx.textAlign = "left";
    ctx.fillText(
      "iso lattice " +
        nodes.length +
        " · beams " +
        edges.length +
        " · " +
        Math.round(W) +
        "x" +
        Math.round(H),
      10,
      H - 10
    );

    requestAnimationFrame(frame);
  }

  setTimeout(resize, 10);
  setTimeout(resize, 50);
  setTimeout(resize, 250);
  requestAnimationFrame(frame);

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
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
      var v = BigInt(raw);
      var d = BigInt(dec);
      var scale = 10n ** d;
      var whole = v / scale;
      var frac = d >= 2n ? ((v % scale) * 100n) / scale : 0n;
      return whole.toLocaleString() + "." + frac.toString().padStart(2, "0");
    } catch (e) {
      return String(raw);
    }
  }
  function uptime(ms) {
    var s = Math.floor((ms || 0) / 1000);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    return h > 0 ? h + "h " + m + "m" : m + "m " + (s % 60) + "s";
  }

  function render(s, journal) {
    var dry = !s || s.mode !== "live";
    document.getElementById("mode").textContent = dry ? "dry-run" : "live";
    document.getElementById("up").textContent = uptime(s && s.uptimeMs);

    var r = (s && s.relay) || {};
    var frames = r.framesReceived || 0;
    document.getElementById("bus").innerHTML =
      '<div class="kv"><span>Frames</span><span>' +
      frames +
      "</span></div>" +
      '<div class="kv"><span>Reconnects</span><span>' +
      (r.reconnects || 0) +
      "</span></div>" +
      '<div class="kv"><span>Status</span><span style="color:#f5a623">' +
      (frames > 0 ? "up" : "no frames") +
      "</span></div>";

    var inv = (s && s.inventory) || [];
    document.getElementById("inv").innerHTML =
      inv
        .map(function (l) {
          return (
            '<div class="kv"><span>' +
            esc(l.symbol) +
            "</span><span>" +
            esc(fmtAmt(l.availableRaw, l.decimals)) +
            "</span></div>"
          );
        })
        .join("") +
      '<div class="kv"><span>Reserved</span><span>' +
      ((s && s.activeReservations) || 0) +
      "</span></div>";

    var c = (s && s.counters) || {};
    var keys = Object.keys(c);
    var would = 0;
    var rejects = 0;
    keys.forEach(function (k) {
      if (/would_quote|quoted/.test(k)) would += c[k];
      else if (k.indexOf("quote_decision:") === 0) rejects += c[k];
    });
    var seen = would + rejects;
    counts = [frames || seen, seen, seen, seen, seen, would];
    drop = rejects;

    if (would > lastWould) emit(true);
    if (rejects > lastReject) emit(false);
    lastWould = would;
    lastReject = rejects;

    var max = 1;
    keys.forEach(function (k) {
      if (c[k] > max) max = c[k];
    });
    if (!keys.length) {
      document.getElementById("bars").innerHTML = '<div class="muted">no decisions yet</div>';
    } else {
      document.getElementById("bars").innerHTML = keys
        .slice()
        .sort(function (a, b) {
          return c[b] - c[a];
        })
        .map(function (k) {
          var name = k.replace(/^quote_decision:/, "");
          var pct = Math.round((c[k] / max) * 100);
          var cls = /would_quote|quoted/.test(k) ? "q" : "";
          return (
            '<div class="bar"><div class="l" title="' +
            esc(name) +
            '">' +
            esc(name) +
            '</div><div class="t"><div class="f ' +
            cls +
            '" style="width:' +
            pct +
            '%"></div></div><div class="n">' +
            c[k] +
            "</div></div>"
          );
        })
        .join("");
    }

    var steps = [
      { n: "BUS", v: frames, m: Math.max(frames, seen, 1) },
      { n: "SEE", v: seen, m: Math.max(seen, 1) },
      { n: "DECIDE", v: seen, m: Math.max(seen, 1) },
      { n: "REJECT", v: rejects, m: Math.max(seen, 1) },
      { n: "QUOTE", v: would, m: Math.max(seen, 1) },
    ];
    document.getElementById("funnel").innerHTML = steps
      .map(function (st) {
        var pct = Math.max(4, Math.round((st.v / st.m) * 100));
        return (
          '<div class="row"><span class="nm">' +
          st.n +
          '</span><div class="tk"><div class="fl" style="width:' +
          pct +
          '%"></div></div><span>' +
          st.v +
          "</span></div>"
        );
      })
      .join("");

    var j = journal || [];
    var found = false;
    for (var i = j.length - 1; i >= 0; i--) {
      var e = j[i];
      if (!e || e.type !== "quote_decision" || !e.decision || !e.event) continue;
      var d = e.decision;
      var ev = e.event;
      var ok = !!d.shouldQuote;
      var side = ev.exactAmountIn != null ? "EXACT_IN" : "EXACT_OUT";
      var gates = {
        listed: d.reason === "asset_not_listed" ? "fail" : "pass",
        priced: d.reason === "no_price" ? "fail" : "pass",
        inv: d.reason === "insufficient_inventory" ? "fail" : "pass",
        risk: /kill|daily_loss|notional|below_min/.test(d.reason || "")
          ? "fail"
          : ok
            ? "pass"
            : "wait",
      };
      var gh = ["listed", "priced", "inv", "risk"]
        .map(function (k) {
          return '<span class="gate ' + gates[k] + '">' + k + "</span>";
        })
        .join("");
      var verdict = ok ? (dry ? "Would quote" : "Quoted") : d.reason || "Reject";
      var vc = ok ? "pass" : "fail";
      document.getElementById("intent").innerHTML =
        '<div style="font:700 16px system-ui;margin-bottom:4px">' +
        esc(sym(ev.assetIn)) +
        " → " +
        esc(sym(ev.assetOut)) +
        '</div><div class="muted">' +
        side +
        " · ≥" +
        ((ev.minDeadlineMs || 60000) / 1000) +
        "s · " +
        (ok ? d.totalSpreadBps + " bps" : "—") +
        '</div><div style="margin-top:6px">' +
        gh +
        ' <span class="gate ' +
        vc +
        '">' +
        esc(verdict) +
        "</span></div>";
      document.getElementById("hint").textContent = ev.quoteId || d.quoteId || "";
      found = true;
      break;
    }
    if (!found) {
      document.getElementById("intent").innerHTML =
        '<div style="font:700 16px system-ui">USDC → wNEAR</div><div class="muted">idle · run solver:cover</div>';
      document.getElementById("hint").textContent = "idle";
    }

    var rows = j
      .filter(function (e) {
        return e && e.type === "quote_decision" && e.decision && e.event;
      })
      .slice(-30)
      .reverse()
      .map(function (e) {
        var d = e.decision;
        var ev = e.event;
        var pair = sym(ev.assetIn) + " → " + sym(ev.assetOut);
        var reason = d.shouldQuote ? (dry ? "would_quote" : "quoted") : d.reason;
        var cls = d.shouldQuote ? "q" : "";
        return (
          '<div class="line"><span class="t">' +
          new Date(e.tMs || Date.now()).toISOString().slice(11, 19) +
          "</span><span>" +
          esc(pair) +
          '</span><span class="chip ' +
          cls +
          '">' +
          esc(reason) +
          "</span></div>"
        );
      })
      .join("");
    document.getElementById("stream").innerHTML =
      rows || '<div class="muted">npm run solver:cover</div>';
  }

  function tick() {
    document.getElementById("clk").textContent =
      new Date().toISOString().slice(11, 19) + "Z";
    Promise.all([
      fetch("/api/status").then(function (r) {
        return r.json();
      }),
      fetch("/api/journal/recent").then(function (r) {
        return r.json();
      }),
    ])
      .then(function (pair) {
        render(pair[0], pair[1]);
      })
      .catch(function (err) {
        console.error("[desk] tick", err);
      });
  }

  tick();
  setInterval(tick, 2000);
  console.info("[desk] iso lattice loaded");
})();
`;
