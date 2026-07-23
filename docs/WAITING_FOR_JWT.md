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
| **IntentRegister** on quote path | observe → decide → reserve; maintenance sweep 5s |
| **Outbox** on live send | markSent enqueues; drain on send + maintenance |
| Register gauges | `/metrics` + `/api/status` + status text line |
| XState mirror | tests / Stately only — not inventory authority |
| Dry-run default / live refuses without key | Enforced |

## What is blocked

1. `framesReceived > 0` on residual bus  
2. Residual markout  
3. Live quotes / capital  
4. Protocol-bit-identical `quote_hash` (interim = SHA-256 of frame)  

## Day key arrives

```bash
# never commit the JWT
export PARTNER_JWT='…'          # raw JWT or "Bearer …"

cd /Users/daniel/Development/CavalRe-Near-Solver
bash scripts/extract-from-sentinel.sh
npm install && npm run build

# residual only — no --sim / cover as proof
npm run solver:dry-run
```

Expect:

```text
bus: N frames | auth=bearer | … — receiving residual
register: reserved=… sent=0 settled=… | outbox_pending=0
```

```bash
curl -s http://127.0.0.1:8787/metrics | grep -E 'register|frames|auth_bearer'
curl -s http://127.0.0.1:8787/api/status | jq '.register, .relay'
```

If `auth=bearer` and frames stay 0 after several minutes: JWT invalid/revoked or portal access not enabled — escalate with partner; do not invent traffic.

## Portal

- Apply / status: https://partners.near-intents.org  
- WS auth docs: https://docs.near-intents.org/integration/market-makers/message-bus/websocket  
- Handshake header: `Authorization: Bearer <jwt>`  

## Still after first frames

1. Confirm register `reserved` rises with residual accepts  
2. Markout on residual fills only  
3. Reconciler against funded `intents.near` account  
4. Replace interim quote_hash with protocol hash when matched on settlement  
5. Microscopic live caps — not before stable markouts  
