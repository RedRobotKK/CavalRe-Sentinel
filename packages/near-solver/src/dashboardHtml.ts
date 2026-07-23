/**
 * Desk shell — restrained, data-first.
 */

export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>NEAR SOLVER DESK</title>
<style>
:root{
  --bg:#0a0a0b;
  --surface:#121214;
  --line:rgba(255,255,255,0.06);
  --text:#f5f5f7;
  --muted:#86868b;
  --amber:#f5a623;
  --cyan:#32d4c8;
  --bad:#ff453a;
  --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
  --sans:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif;
}
*{box-sizing:border-box;margin:0}
html,body{height:100%;background:var(--bg);color:var(--text);font:13px/1.45 var(--sans);overflow:hidden;-webkit-font-smoothing:antialiased}
.shell{height:100%;display:grid;grid-template-rows:52px 1fr 132px}
header{display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--line)}
.mark{width:22px;height:22px;border-radius:5px;background:var(--amber);color:#1a0a00;display:grid;place-items:center;font:700 9px var(--mono)}
h1{font:600 14px/1 var(--sans);letter-spacing:-0.01em}
.hsub{color:var(--muted);font-weight:400;font-size:12px;margin-left:8px}
.badge{font:600 10px var(--mono);padding:3px 8px;border-radius:100px;background:rgba(245,166,35,0.12);color:var(--amber);letter-spacing:0.04em}
.right{margin-left:auto;font:12px var(--mono);color:var(--muted)}.right b{color:var(--text);font-weight:500}
.main{display:grid;grid-template-columns:220px 1fr 220px;gap:1px;background:var(--line);min-height:0}
.panel{background:var(--bg);padding:20px 18px;overflow:auto}
.panel h2{font:600 11px var(--sans);color:var(--muted);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:16px}
.hero{background:var(--bg);display:flex;flex-direction:column;min-height:0;position:relative}
.hero-inner{flex:1;display:flex;flex-direction:column;justify-content:center;padding:28px 32px 12px;min-height:0}
.stages{display:flex;align-items:center;justify-content:center;gap:0;position:relative;z-index:2}
.stage{width:88px;text-align:center;position:relative}
.stage-box{
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:12px;
  padding:14px 8px 12px;
  transition:border-color .25s, box-shadow .25s, background .25s;
}
.stage-box.hot{
  border-color:rgba(245,166,35,0.45);
  box-shadow:0 0 0 1px rgba(245,166,35,0.15), 0 8px 32px rgba(245,166,35,0.08);
  background:#16140f;
}
.stage-box.live{border-color:rgba(245,166,35,0.22)}
.stage-name{font:600 10px var(--mono);color:var(--muted);letter-spacing:0.06em;margin-bottom:6px}
.stage-box.hot .stage-name,.stage-box.live .stage-name{color:var(--amber)}
.stage-n{font:600 22px/1 var(--sans);letter-spacing:-0.03em;color:var(--text)}
.stage-flag{font:600 9px var(--mono);margin-top:8px;color:var(--muted);letter-spacing:0.04em}
.stage-flag.pass{color:var(--cyan)}
.stage-flag.drop{color:var(--bad)}
.connector{width:28px;height:1px;background:var(--line);position:relative;flex-shrink:0}
.connector .dot{
  position:absolute;top:50%;left:0;width:5px;height:5px;margin-top:-2.5px;border-radius:50%;
  background:var(--amber);opacity:0;transform:translateX(0);
}
.connector .dot.run{animation:flow 0.7s ease-in-out forwards}
@keyframes flow{
  0%{opacity:0;transform:translateX(0)}
  20%{opacity:1}
  80%{opacity:1}
  100%{opacity:0;transform:translateX(28px)}
}
.intent{
  margin-top:36px;
  text-align:center;
  padding:0 20px;
}
.intent-pair{font:600 28px/1.1 var(--sans);letter-spacing:-0.03em;margin-bottom:8px}
.intent-meta{font:13px var(--sans);color:var(--muted);margin-bottom:14px}
.intent-meta b{color:var(--text);font-weight:500}
.gates{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
.gate{
  font:600 10px var(--mono);padding:4px 10px;border-radius:100px;
  border:1px solid var(--line);color:var(--muted);letter-spacing:0.03em;
}
.gate.pass{color:var(--cyan);border-color:rgba(50,212,200,0.25);background:rgba(50,212,200,0.06)}
.gate.fail{color:var(--bad);border-color:rgba(255,69,58,0.3);background:rgba(255,69,58,0.08)}
.gate.wait{color:var(--amber);border-color:rgba(245,166,35,0.25);background:rgba(245,166,35,0.06)}
.bar{display:grid;grid-template-columns:1fr 36px;gap:8px;align-items:center;margin-bottom:10px}
.bar .label{font:12px var(--sans);color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar .row{display:flex;align-items:center;gap:8px}
.bar .track{flex:1;height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden}
.bar .fill{height:100%;border-radius:2px;background:var(--amber)}
.bar .fill.q{background:var(--cyan)}
.bar .n{font:600 12px var(--mono);text-align:right;color:var(--text)}
.kv{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line);font:12px var(--sans)}
.kv:last-child{border:0}
.kv .k{color:var(--muted)}
.kv .v{font:500 12px var(--mono)}
.kv .v.warn{color:var(--amber)}
.fun-row{display:grid;grid-template-columns:52px 1fr 28px;gap:8px;align-items:center;margin-bottom:10px}
.fun-row .nm{font:600 11px var(--mono);color:var(--muted)}
.fun-row .tk{height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden}
.fun-row .fl{height:100%;background:var(--amber);border-radius:2px}
.fun-row .n{font:600 12px var(--mono);text-align:right}
.tape{border-top:1px solid var(--line);padding:12px 20px;overflow:auto}
.tape h2{font:600 11px var(--sans);color:var(--muted);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;display:flex;justify-content:space-between}
.tape h2 span{font:12px var(--mono);font-weight:400;letter-spacing:0;text-transform:none}
.line{display:grid;grid-template-columns:52px 1fr auto;gap:16px;padding:6px 0;border-bottom:1px solid var(--line);font:12px var(--mono);align-items:center}
.line:last-child{border:0}
.line .t{color:var(--muted)}
.line .pair{font-family:var(--sans);font-weight:500}
.chip{font:600 10px var(--mono);padding:3px 8px;border-radius:100px;background:rgba(245,166,35,0.1);color:var(--amber)}
.chip.q{background:rgba(50,212,200,0.1);color:var(--cyan)}
.muted{color:var(--muted)}
</style>
</head>
<body>
<div class="shell">
  <header>
    <div class="mark">NS</div>
    <h1>Near Solver<span class="hsub">CavalRe</span></h1>
    <span class="badge" id="mode">dry-run</span>
    <div class="right"><b id="up">—</b> · <span id="clk">—</span></div>
  </header>
  <div class="main">
    <div class="panel">
      <h2>Decision mix</h2>
      <div id="bars" class="muted">—</div>
    </div>
    <div class="hero">
      <div class="hero-inner">
        <div class="stages" id="stages"></div>
        <div class="intent" id="intent"></div>
      </div>
    </div>
    <div class="panel">
      <h2>Path</h2>
      <div id="funnel"></div>
      <h2 style="margin-top:28px">Inventory</h2>
      <div id="bus"></div>
      <div id="inv"></div>
    </div>
  </div>
  <div class="tape">
    <h2>Tape <span id="hint">—</span></h2>
    <div id="stream" class="muted">—</div>
  </div>
</div>
<script src="/desk.js"></script>
</body>
</html>`;
