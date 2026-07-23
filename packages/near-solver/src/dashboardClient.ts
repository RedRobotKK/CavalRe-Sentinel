/**
 * Desk client — served as application/javascript at /desk.js
 * Keep as a plain string (no nested template issues).
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

  function hash(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
  function noise(x, y) {
    var ix = Math.floor(x);
    var iy = Math.floor(y);
    var fx = x - ix;
    var fy = y - iy;
    var ux = fx * fx * (3 - 2 * fx);
    var uy = fy * fy * (3 - 2 * fy);
    var a = hash(ix, iy);
    var b = hash(ix + 1, iy);
    var c = hash(ix, iy + 1);
    var d = hash(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy * (1 - ux) + (d - b) * ux * uy;
  }
  function fbm(x, y, oct) {
    var v = 0;
    var a = 0.5;
    var f = 1;
    for (var i = 0; i < oct; i++) {
      v += a * noise(x * f, y * f);
      f *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  var noiseCV = document.createElement("canvas");
  var noiseCTX = noiseCV.getContext("2d");
  var noiseT = 0;

  function bakeNoise(t) {
    var nw = Math.max(64, Math.floor(W / 4) || 64);
    var nh = Math.max(36, Math.floor(H / 4) || 36);
    noiseCV.width = nw;
    noiseCV.height = nh;
    var img = noiseCTX.createImageData(nw, nh);
    var data = img.data;
    var aspect = nw / Math.max(1, nh);
    for (var y = 0; y < nh; y++) {
      for (var x = 0; x < nw; x++) {
        var u = (x / nw) * aspect * 3;
        var v = (y / nh) * 3;
        var n1 = fbm(u + t * 0.12, v + t * 0.08, 5);
        var n2 = fbm(u * 2.1 - t * 0.2, v * 2.1 + t * 0.1, 4);
        var flow = Math.max(0, Math.min(1, (n1 - 0.25) / 0.45));
        var spark = Math.max(0, Math.min(1, (n2 - 0.65) / 0.3));
        var conduit = Math.exp(-Math.pow((y / nh - 0.4) * 5.5, 2));
        var r = (0.96 * (0.08 + flow * 0.35 + spark * 0.55 + conduit * (0.12 + burst * 0.2))) * 255;
        var g = (0.65 * (0.06 + flow * 0.2 + spark * 0.3 + conduit * 0.08)) * 255;
        var b = (0.12 + spark * 0.4 * conduit) * 255;
        var al = (0.35 + flow * 0.4 + spark * 0.45 + conduit * 0.2 + burst * 0.15) * 255;
        var o = (y * nw + x) * 4;
        data[o] = r;
        data[o + 1] = g;
        data[o + 2] = b;
        data[o + 3] = Math.min(230, al);
      }
    }
    noiseCTX.putImageData(img, 0, 0);
  }

  function resize() {
    var r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(2, r.width);
    H = Math.max(2, r.height);
    cv.width = Math.floor(W * dpr);
    cv.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bakeNoise(noiseT);
  }
  window.addEventListener("resize", resize);

  function boxes() {
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
  var bakeAcc = 0;
  function frame(ts) {
    var dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
    last = ts;
    noiseT += dt;
    bakeAcc += dt;
    burst = Math.max(0, burst - dt * 0.4);
    if (W < 4) resize();
    if (bakeAcc > 0.1) {
      bakeAcc = 0;
      bakeNoise(noiseT);
    }

    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    try {
      ctx.drawImage(noiseCV, 0, 0, W, H);
    } catch (e) {}

    ctx.strokeStyle = "rgba(245,166,35,0.07)";
    ctx.lineWidth = 1;
    var hz = H * 0.68;
    for (var gi = 0; gi < 8; gi++) {
      var gy = hz + gi * gi * 2;
      if (gy > H) break;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(245,166,35," + (0.12 + burst * 0.15) + ")";
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.42, W * 0.38, H * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();

    var bx = boxes();
    for (var hi = 0; hi < heat.length; hi++) heat[hi] = Math.max(0, heat[hi] - dt * 0.5);

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
    if (Math.random() < 0.12) {
      var si = Math.floor(Math.random() * (STAGES.length - 1));
      spawn(si, si + 1, Math.random() > 0.35);
    }

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
        g.addColorStop(0, "#1a1610");
        g.addColorStop(1, "#0c0a08");
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

    ctx.fillStyle = "rgba(180,160,100,0.85)";
    ctx.font = "11px ui-monospace,monospace";
    ctx.textAlign = "left";
    ctx.fillText(
      "FBM x5  links=" + links.length + "  " + Math.round(W) + "x" + Math.round(H),
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
  console.info("[desk] client loaded");
})();
`;
