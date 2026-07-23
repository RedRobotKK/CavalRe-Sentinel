# Intent XState machine

Declarative mirror of `IntentRegister` for visualization and actor tests.
**Production inventory/outbox authority remains `IntentRegister`.**

## Module

- `packages/near-solver/src/intentMachine.ts`
- Tests: `test/intentMachine.test.ts`

```bash
npm test -w @cavalre/near-solver -- intentMachine
```

## Stately Studio

1. Open [Stately Studio](https://stately.ai/studio)
2. New machine → import / paste the `createMachine({...})` definition from `intentMachine.ts` (or use the visual editor to match states below)
3. Click events: `DECIDE_ACCEPT`, `MARK_SENT`, `MARK_SETTLED`, `EXPIRE`

States: `seen` → `reserved` | `decided_reject` → `sent` → `settled` | `expired` | `released`

Guard `isLive` blocks `MARK_SENT` in `dry_run`.

## @xstate/inspect (optional experiment)

```ts
import { createIntentActor } from '@cavalre/near-solver';
// browser or inspect helper:
const actor = createIntentActor({ quoteId: 'q', fingerprint: 'fp', mode: 'live' });
actor.send({ type: 'DECIDE_ACCEPT', assetOut: 'out', amountOutRaw: '1', expiresAtMs: Date.now() + 60_000 });
```

## Actor tests

```ts
const a = createIntentActor({ quoteId: 'q1', fingerprint: 'fp', mode: 'live' });
a.send({ type: 'DECIDE_ACCEPT', assetOut: 'out', amountOutRaw: '1', expiresAtMs: 1 });
expect(a.getSnapshot().value).toBe('reserved');
```

Effects are logged on context (`reserve`, `outbox_enqueue`, `apply_fill`, `release`) for assertions only — wire real inventory via `IntentRegister`.
