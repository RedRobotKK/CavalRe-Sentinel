/**
 * Local dry-run helper: free a TCP listen port before createStatusServer.
 *
 * Default: reclaim (kill LISTEN owners). Opt out with DASHBOARD_RECLAIM=0.
 * Never used on a live capital path — dry-run shell only.
 */

import { execSync } from 'node:child_process';

export function reclaimListenPort(port: number): void {
  if (process.env['DASHBOARD_RECLAIM'] === '0') return;

  let pids: string[] = [];
  try {
    const out = execSync(`lsof -t -iTCP:${port} -sTCP:LISTEN 2>/dev/null`, {
      encoding: 'utf8',
    }).trim();
    if (out) pids = out.split(/\s+/).filter(Boolean);
  } catch {
    // lsof exit 1 = nothing listening — fine
    return;
  }

  if (pids.length === 0) return;

  console.log(
    `[dry-run] port ${port} in use by pid ${pids.join(', ')} — reclaiming (DASHBOARD_RECLAIM=0 to skip)`
  );
  for (const pid of pids) {
    try {
      process.kill(Number(pid), 'SIGTERM');
    } catch {
      /* already gone */
    }
  }

  // brief wait so kernel releases the bind
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) {
    try {
      const still = execSync(`lsof -t -iTCP:${port} -sTCP:LISTEN 2>/dev/null`, {
        encoding: 'utf8',
      }).trim();
      if (!still) return;
    } catch {
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }

  // last resort
  for (const pid of pids) {
    try {
      process.kill(Number(pid), 'SIGKILL');
    } catch {
      /* */
    }
  }
}
