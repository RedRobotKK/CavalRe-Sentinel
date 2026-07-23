# Intent register & transactional outbox

**Status:** wired into `SolverRunner` (observe → decide → applyDecision → reserve).

## Runtime path

```text
quote_request
  → register.observe
  → pipeline.decide
  → register.applyDecision  (± reserve)
  → pendingQuotes.register (reconciler)
  → dry-run: stop
  → live: sign → markSent (outbox + hash) → drain → wire

settlement (quote_hash)
  → register.markSettled if indexed
  → else deferred_to_reconciler

maintenance (5s)
  → register.sweepExpired
  → outbox.drain (live only)
```

## Status

`statusReport` includes:

```text
register: reserved=N sent=N settled=N reject=N expired=N | outbox_pending=N
```

## XState mirror

See `docs/INTENT_MACHINE.md` — visualization / actor tests only. Not production inventory authority.

## Tests

```bash
npm test -w @cavalre/near-solver -- intentRegister
npm test -w @cavalre/near-solver -- runner.register
npm test -w @cavalre/near-solver -- runner.maintenance
npm test -w @cavalre/near-solver -- intentMachine
```
