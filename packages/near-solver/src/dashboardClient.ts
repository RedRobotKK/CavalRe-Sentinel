/**
 * Desk client — /desk.js
 * Transparent blockchain block field + circuit stages.
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

  /* ---- transparent blockchain block field ---- */
  var chainNodes = [];
  var chainEdges = [];

  function rebuildChain() {
    chainNodes = [];
    chainEdges = [];
    if (W < 10 || H < 10) return;
    var cols = Math.max(6, Math.floor(W / 70));
    var rows = Math.max(4, Math.floor(H / 55));
    var padX = 30;
    var padY = 24;
    var cellW = (W - padX * 2) / cols;
    var cellH = (H - padY * 2) / rows;
    var i, j, n, idx;
    for (j = 0; j < rows; j++) {
      for (i = 0; i < cols; i++) {
        var jitterX = (hash(i * 3.1, j * 7.3) - 0.5) * cellW * 0.25;
        var jitterY = (hash(i * 5.7, j * 2.9) - 0.5) * cellH * 0.25;
        chainNodes.push({
          x: padX + (i + 0.5) * cellW + jitterX,
          y: padY + (j + 0.5) * cellH + jitterY,
          z: hash(i, j),
          phase: hash(i + 1, j + 2) * Math.PI * 2,
          size: 10 + hash(i * 2, j * 2) * 8,
        });
      }
    }
    // connect each node to next in row (chain) + occasional down-right (DAG)
    for (j = 0; j < rows; j++) {
      for (i = 0; i < cols; i++) {
        idx = j * cols + i;
        if (i < cols - 1) chainEdges.push([idx, idx + 1]);
        if (j < rows - 1 && hash(i, j) > 0.45) {
          var down = (j + 1) * cols + Math.min(cols - 1, i + (hash(j, i) > 0.5 ? 1 : 0));
          chainEdges.push([idx, down]);
        }
      }
    }
  }

  function hash(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function drawBlockField(now) {
    var t = (now - t0) / 1000;
    var e, a, b, n, k, pulse, alpha, s;

    // edges first (behind blocks)
    for (k = 0; k < chainEdges.length; k++) {
      e = chainEdges[k];
      a = chainNodes[e[0]];
      b = chainNodes[e[1]];
      if (!a || !b) continue;
      var flow = (t * 0.35 + a.phase) % 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = "rgba(45, 212, 191, " + (0.06 + burst * 0.08) + ")";
      ctx.lineWidth = 1;
      ctx.stroke();
      // traveling packet on edge
      var px = a.x + (b.x - a.x) * flow;
      var py = a.y + (b.y - a.y) * flow;
      ctx.beginPath();
      ctx.arc(px, py, 1.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(245, 166, 35, " + (0.25 + burst * 0.35) + ")";
      ctx.fill();
    }

    // transparent blocks (isometric-ish diamonds / rounded rects)
    for (k = 0; k < chainNodes.length; k++) {
      n = chainNodes[k];
      pulse = 0.5 + 0.5 * Math.sin(t * 1.2 + n.phase);
      alpha = 0.1 + n.z * 0.12 + pulse * 0.06 + burst * 0.08;
      s = n.size * (0.9 + pulse * 0.08);

      // glass body
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.rect(-s / 2, -s / 2, s, s);
      ctx.fillStyle = "rgba(20, 40, 38, " + alpha + ")";
      ctx.fill();
      ctx.strokeStyle = "rgba(45, 212, 191, " + (0.15 + pulse * 0.2 + burst * 0.15) + ")";
      ctx.lineWidth = 1;
      ctx.stroke();
      // inner highlight
      ctx.strokeStyle = "rgba(245, 166, 35, " + (0.08 + pulse * 0.1) + ")";
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-s / 2 + 2, -s / 2 + 2, s - 4, s - 4);
      ctx.restore();
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
    rebuildChain();
  }
  window.addEventListener("resize", resize);

  function stageBoxes() {
    var n = STAGES.length;
    var pad = 20;
    var bw = Math.min(72, (W - pad * 2) / n - 8);
    var bh = 56;
    var gap = (W - pad * 2 - bw * n) / Math.max(1, n - 1);
    var y = H * 0.38 - bh / 2;
    var out = [];
    for (var i = 0; i < n; i++) {
      var x = pad + i * (bw + gap);
      out.push({ x: x, y: y, w: bw, h: bh, cx: x + bw / 2, cy: y + bh / 2 });
    }
    return out;
  }

  function spawn(a, b, ok) {
    if (links.length > 250) return;
    links.push({
      a: a,
      b: b,
      t: 0,
      sp: 0.45 + Math.random() * 0.4,
      ok: ok,
      amp: 5 + Math.random() * 14,
      ph: Math.random() * 6.28,
    });
  }

  function emit(ok) {
    burst = 1;
    for (var i = 0; i < STAGES.length - 1; i++) {
      (function (idx) {
        setTimeout(function () {
          for (var k = 0; k < 4; k++) spawn(idx, idx + 1, ok);
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

  var last = 0;
  function frame(ts) {
    var dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
    last = ts;
    burst = Math.max(0, burst - dt * 0.4);
    if (W < 4) resize();

    // clear
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, W, H);

    // blockchain field (background)
    drawBlockField(ts);

    // soft vignette so stages read
    var vg = ctx.createRadialGradient(W / 2, H * 0.4, 40, W / 2, H * 0.4, Math.max(W, H) * 0.65);
    vg.addColorStop(0, "rgba(5,7,10,0)");
    vg.addColorStop(1, "rgba(5,7,10,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // ellipse ring
    ctx.strokeStyle = "rgba(45,212,191," + (0.1 + burst * 0.12) + ")";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.42, W * 0.38, H * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();

    var bx = stageBoxes();
    for (var hi = 0; hi < heat.length; hi++) heat[hi] = Math.max(0, heat[hi] - dt * 0.5);

    // stage link particles
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
      var pa = Math.sin(p.t * Math.PI);
      ctx.beginPath();
      ctx.arc(px, py, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = p.ok
        ? "rgba(45,212,191," + (0.45 + pa * 0.5) + ")"
        : "rgba(255,200,80," + (0.45 + pa * 0.5) + ")";
      ctx.fill();
    }
    if (Math.random() < 0.1) {
      var si = Math.floor(Math.random() * (STAGES.length - 1));
      spawn(si, si + 1, Math.random() > 0.35);
    }

    // circuit stages on top
    for (var i = 0; i < bx.length; i++) {
      var b = bx[i];
      var live = counts[i] > 0;
      var a = heat[i];
      if (a > 0.05) {
        ctx.save();
        ctx.shadowColor = "rgba(245,166,35," + (0.45 + a * 0.5) + ")";
        ctx.shadowBlur = 22 + a * 30;
        rr(b.x, b.y, b.w, b.h, 4);
        ctx.fillStyle = "rgba(245,166,35,0.08)";
        ctx.fill();
        ctx.restore();
      }
      var g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      if (a > 0.25) {
        g.addColorStop(0, "#6b450c");
        g.addColorStop(1, "#2e1a00");
      } else if (live) {
        g.addColorStop(0, "#3d2a00");
        g.addColorStop(1, "#1a1200");
      } else {
        g.addColorStop(0, "rgba(26,22,16,0.92)");
        g.addColorStop(1, "rgba(12,10,8,0.92)");
      }
      rr(b.x, b.y, b.w, b.h, 4);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle =
        a > 0.08
          ? "rgba(255,200,80," + (0.55 + a * 0.45) + ")"
          : live
            ? "rgba(245,166,35,0.55)"
            : "rgba(245,166,35,0.35)";
      ctx.lineWidth = a > 0.08 ? 2.4 : 1.4;
      rr(b.x, b.y, b.w, b.h, 4);
      ctx.stroke();
      ctx.fillStyle = a > 0.2 ? "#ffe099" : "#d4a017";
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
        ctx.fillStyle = "rgba(45,212,191,0.85)";
        ctx.fillText("PASS", b.cx, b.y + b.h - 7);
      } else {
        ctx.fillStyle = "rgba(107,124,134,0.55)";
        ctx.fillText("—", b.cx, b.y + b.h - 7);
      }
    }

    ctx.fillStyle = "rgba(120,160,150,0.75)";
    ctx.font = "11px ui-monospace,monospace";
    ctx.textAlign = "left";
    ctx.fillText(
      "chain " + chainNodes.length + " blocks · " + chainEdges.length + " links · " + Math.round(W) + "x" + Math.round(H),
      10,
      H - 10
    );

    requestAnimationFrame(frame);
  }

  setTimeout(resize, 10);
  setTimeout(resize, 50);
  setTimeout(resize, 200);
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
  console.info("[desk] client loaded — chain field");
})();
`;
