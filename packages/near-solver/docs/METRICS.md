# Metrics → Grafana path

**Endpoint:** `GET http://127.0.0.1:8787/metrics` (Prometheus text 0.0.4)  
**Bind:** localhost only (X18). Scrape from the same host or tunnel deliberately.

## Series

| Metric | Type | Meaning |
|--------|------|---------|
| `cavalre_solver_up` | gauge | Process serving |
| `cavalre_solver_dry_run` | gauge | 1 = dry-run |
| `cavalre_solver_uptime_seconds` | gauge | Uptime |
| `cavalre_solver_kill_switch` | gauge | 1 = halted |
| `cavalre_solver_active_reservations` | gauge | Open holds |
| `cavalre_solver_journal_dropped` | gauge | Sink failures |
| `cavalre_solver_relay_frames_total` | counter | Bus frames |
| `cavalre_solver_relay_malformed_total` | counter | Bad frames |
| `cavalre_solver_relay_reconnects_total` | counter | Reconnects |
| `cavalre_solver_decisions_total{reason=}` | counter | decide outcomes |
| `cavalre_solver_inventory_available{symbol=}` | gauge | Chart-only whole units |

Exact inventory remains on `/api/status` as raw strings.

## Local Prometheus scrape (example)

```yaml
scrape_configs:
  - job_name: cavalre-near-solver
    scrape_interval: 5s
    static_configs:
      - targets: ['127.0.0.1:8787']
    metrics_path: /metrics
```

## Grafana panels worth testing first

1. `rate(cavalre_solver_decisions_total[1m])` by `reason`
2. `cavalre_solver_kill_switch`
3. `rate(cavalre_solver_relay_frames_total[1m])`
4. `cavalre_solver_active_reservations`

## How to judge benefit

Run `npm run solver:cover` for 10–15 minutes, scrape `/metrics`, build those four panels.

| Outcome | Decision |
|---------|----------|
| Reject mix + kill visible at a glance | Keep Grafana for ops |
| Only duplicates status desk noise | Defer Cloud; keep `/metrics` for scripts |
| Alerts on kill / zero frames useful | Wire Alertmanager |

CANON: metrics do not authorize live capital.
