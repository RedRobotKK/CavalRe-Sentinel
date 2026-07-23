/**
 * Desk client — calm, decision-driven. No decorative lattice.
 */

export const DASHBOARD_JS = `
(function () {
  "use strict";

  var STAGES = ["BUS", "SEE", "MARK", "DECIDE", "RISK", "QUOTE"];
  var counts = [0, 0, 0, 0, 0, 0];
  var drop = 0;
  var heat = [0, 0, 0, 0, 0, 0];
  var lastWould = 0;
  var lastReject = 0;

  function buildStages() {
    var el = document.getElementById("stages");
    var html = "";
    for (var i = 0; i < STAGES.length; i++) {
      if (i > 0) {
        html +=
          '<div class="connector" data-c="' +
          (i - 1) +
          '"><div class="dot"></div></div>';
      }
      html +=
        '<div class="stage" data-s="' +
        i +
        '">' +
        '<div class="stage-box" id="sb' +
        i +
        '">' +
        '<div class="stage-name">' +
        STAGES[i] +
        "</div>" +
        '<div class="stage-n" id="sn' +
        i +
        '">0</div>' +
        '<div class="stage-flag" id="sf' +
        i +
        '">—</div>' +
        "</div></div>";
    }
    el.innerHTML = html;
  }
  buildStages();

  function pulseConnectors() {
    var dots = document.querySelectorAll(".connector .dot");
    dots.forEach(function (d, i) {
      d.classList.remove("run");
      void d.offsetWidth;
      setTimeout(function () {
        d.classList.add("run");
      }, i * 70);
    });
  }

  function paintStages() {
    for (var i = 0; i < STAGES.length; i++) {
      var box = document.getElementById("sb" + i);
      var n = document.getElementById("sn" + i);
      var f = document.getElementById("sf" + i);
      n.textContent = String(counts[i]);
      var live = counts[i] > 0;
      var hot = heat[i] > 0.15;
      box.className = "stage-box" + (hot ? " hot" : live ? " live" : "");
      if (i === 3 && drop > 0) {
        f.textContent = "DROP −" + drop;
        f.className = "stage-flag drop";
      } else if (live) {
        f.textContent = "PASS";
        f.className = "stage-flag pass";
      } else {
        f.textContent = "—";
        f.className = "stage-flag";
      }
    }
  }

  var heatTimer = setInterval(function () {
    var dirty = false;
    for (var i = 0; i < heat.length; i++) {
      if (heat[i] > 0) {
        heat[i] = Math.max(0, heat[i] - 0.04);
        dirty = true;
      }
    }
    if (dirty) paintStages();
  }, 50);

  function emit() {
    for (var i = 0; i < STAGES.length; i++) {
      (function (idx) {
        setTimeout(function () {
          heat[idx] = 1;
          paintStages();
        }, idx * 60);
      })(i);
    }
    pulseConnectors();
  }

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
      '<div class="kv"><span class="k">Frames</span><span class="v">' +
      frames +
      "</span></div>" +
      '<div class="kv"><span class="k">Reconnects</span><span class="v">' +
      (r.reconnects || 0) +
      "</span></div>" +
      '<div class="kv"><span class="k">Bus</span><span class="v warn">' +
      (frames > 0 ? "up" : "no frames") +
      "</span></div>";

    var inv = (s && s.inventory) || [];
    document.getElementById("inv").innerHTML =
      inv
        .map(function (l) {
          return (
            '<div class="kv"><span class="k">' +
            esc(l.symbol) +
            '</span><span class="v">' +
            esc(fmtAmt(l.availableRaw, l.decimals)) +
            "</span></div>"
          );
        })
        .join("") +
      '<div class="kv"><span class="k">Reserved</span><span class="v">' +
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

    if (would > lastWould || rejects > lastReject) emit();
    lastWould = would;
    lastReject = rejects;
    paintStages();

    var max = 1;
    keys.forEach(function (k) {
      if (c[k] > max) max = c[k];
    });
    if (!keys.length) {
      document.getElementById("bars").innerHTML = '<div class="muted">No decisions yet</div>';
    } else {
      document.getElementById("bars").innerHTML = keys
        .slice()
        .sort(function (a, b) {
          return c[b] - c[a];
        })
        .map(function (k) {
          var name = k.replace(/^quote_decision:/, "");
          var pct = Math.max(2, Math.round((c[k] / max) * 100));
          var cls = /would_quote|quoted/.test(k) ? "q" : "";
          return (
            '<div class="bar">' +
            '<div class="label" title="' +
            esc(name) +
            '">' +
            esc(name) +
            "</div>" +
            '<div class="row"><div class="track"><div class="fill ' +
            cls +
            '" style="width:' +
            pct +
            '%"></div></div>' +
            '<div class="n">' +
            c[k] +
            "</div></div></div>"
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
        var pct = Math.max(2, Math.round((st.v / st.m) * 100));
        return (
          '<div class="fun-row"><span class="nm">' +
          st.n +
          '</span><div class="tk"><div class="fl" style="width:' +
          pct +
          '%"></div></div><span class="n">' +
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
        '<div class="intent-pair">' +
        esc(sym(ev.assetIn)) +
        " → " +
        esc(sym(ev.assetOut)) +
        "</div>" +
        '<div class="intent-meta">' +
        side +
        " · ≥" +
        ((ev.minDeadlineMs || 60000) / 1000) +
        "s · <b>" +
        (ok ? d.totalSpreadBps + " bps" : "—") +
        "</b></div>" +
        '<div class="gates">' +
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
        '<div class="intent-pair">USDC → wNEAR</div>' +
        '<div class="intent-meta">Waiting for decisions</div>';
      document.getElementById("hint").textContent = "idle";
    }

    var rows = j
      .filter(function (e) {
        return e && e.type === "quote_decision" && e.decision && e.event;
      })
      .slice(-24)
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
          '</span><span class="pair">' +
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
      rows || '<div class="muted">Run solver:cover to populate tape</div>';
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
        console.error("[desk]", err);
      });
  }

  tick();
  setInterval(tick, 2000);
  console.info("[desk] calm shell");
})();
`;
