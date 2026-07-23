/**
 * Desk shell only. Client logic is /desk.js (see dashboardClient.ts).
 */

export const DASHBOARD_HTML = `<!DOCTYPE html>
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
#c{position:absolute;inset:0;width:100%;height:100%;display:block;background:#05070a}
.intent{padding:8px 12px;border-top:1px solid #1a2228;background:#0e1318;font:12px ui-monospace,monospace;text-align:center}
.kv{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #1a2228;font:11px ui-monospace,monospace}
.kv span:first-child{color:#6b7c86}
.bar{display:grid;grid-template-columns:80px 1fr 28px;gap:6px;align-items:center;margin-bottom:5px;font:11px ui-monospace,monospace}
.bar .l{color:#6b7c86;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar .t{height:11px;background:#080b0e;border:1px solid #1a2228;border-radius:2px;overflow:hidden}
.bar .f{height:100%;background:#f5a623}.bar .f.q{background:#2dd4bf}
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
<script src="/desk.js"></script>
</body>
</html>`;
