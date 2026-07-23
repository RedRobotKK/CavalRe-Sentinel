# Intent register & transactional outbox

**Status:** implemented in `@cavalre/near-solver` (`IntentRegister`, `Outbox`).  
**Not yet:** default `SolverRunner` path still uses `PendingQuoteBook` directly — wire when residual live send is enabled.

## IntentRegister

Lifecycle per `quote_id`:

```text
seen → decided_reject
     → reserved → expired | released | sent → settled | expired | released
```

- Inventory `reserve` / `release` / fill only inside transitions
- Dry-run cannot `markSent`
- `markSent` enqueues `quote_response` on the outbox in the same synchronous step as `state=sent` + `quote_hash` index
- `markSettled` is idempotent on `tx_hash` (fill runs once)

## Outbox

```text
pending → publishing → done
                   └→ pending (retry) | failed
```

```ts
register.markSent(id, { quoteHash, framePayload, signerId });
await register.outbox.drain(async (row) => {
  relay.sendFrame(row.payload);
  return { ok: true };
});
```

Same `(topic, idempotencyKey)` + same payload → enqueue noop. Different payload → throw conflict.

## Tests

```bash
npm test -w @cavalre/near-solver -- intentRegister
```
