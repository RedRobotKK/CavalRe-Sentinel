# Waiting on Partner JWT

**Status:** external gate — applied, no key yet.
**Policy:** no desk chrome · cover ≠ bus proof · no notional scale.

## What is done without the key

| Item | State |
|------|--------|
| Decide / risk / journal | Green (cover harness) |
| Oracle OneClick + staleness | Green (`npm run oracle:verify`) |
| WS transport JWT-ready | `Authorization: Bearer` when `PARTNER_JWT` set |
| Status honesty | `auth=none\|bearer` + frames separate |
| Settlement → pending match → `recordRealizedPnlUsd` | Wired |
| Dry-run default / live refuses without key | Enforced |

## What is blocked

1. `framesReceived > 0` on residual bus  
2. Residual markout  
3. Live quotes / capital  

## Day key arrives

```bash
# never commit the JWT
export PARTNER_JWT='…'          # raw JWT or "Bearer …"

cd /Users/daniel/Development/CavalRe-Near-Solver
bash scripts/extract-from-sentinel.sh   # if pulling latest
npm run build

# residual only — no --sim
npm run solver:dry-run
```

Expect status line:

```text
bus: N frames | auth=bearer | … — receiving residual
```

If `auth=bearer` and frames stay 0 after several minutes: JWT invalid/revoked or portal access not enabled for solver bus — escalate with partner support, do not “fix” by inventing traffic.

## Portal

- Apply / status: https://partners.near-intents.org  
- WS auth docs: https://docs.near-intents.org/integration/market-makers/message-bus/websocket  
- Handshake header: `Authorization: Bearer <jwt>`  

## Still after first frames

- Markout on residual fills only  
- Reconciler against funded `intents.near` account  
- Microscopic live caps — not before stable markouts  
