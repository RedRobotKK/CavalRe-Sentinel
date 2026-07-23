/**
 * XState v5 intent lifecycle — declarative mirror of IntentRegister.
 *
 * Production inventory/outbox authority remains IntentRegister.
 * IntentMode here is the same union as the register; exported from index as MachineIntentMode
 * to avoid ambiguous export * clashes.
 */

import { setup, assign, createActor } from 'xstate';

export type IntentMode = 'dry_run' | 'live';

export interface IntentContext {
  quoteId: string;
  fingerprint: string;
  mode: IntentMode;
  reason: string | null;
  quoteHash: string | null;
  txHash: string | null;
  intentHash: string | null;
  assetOut: string | null;
  amountOutRaw: string | null;
  expiresAtMs: number | null;
  effects: string[];
}

export type IntentEvent =
  | { type: 'DECIDE_REJECT'; reason: string }
  | {
      type: 'DECIDE_ACCEPT';
      assetOut: string;
      amountOutRaw: string;
      expiresAtMs: number;
    }
  | { type: 'MARK_SENT'; quoteHash: string; framePayload: string }
  | { type: 'MARK_SETTLED'; txHash: string; intentHash: string }
  | { type: 'EXPIRE' }
  | { type: 'RELEASE' };

export interface IntentInput {
  quoteId: string;
  fingerprint: string;
  mode: IntentMode;
}

function pushEffect(effects: string[], name: string): string[] {
  return [...effects, name];
}

export const intentMachine = setup({
  types: {
    context: {} as IntentContext,
    events: {} as IntentEvent,
    input: {} as IntentInput,
  },
  guards: {
    isLive: ({ context }) => context.mode === 'live',
    hasPayload: ({ event }) =>
      event.type === 'MARK_SENT' &&
      Boolean(event.quoteHash) &&
      Boolean(event.framePayload),
  },
  actions: {
    logReserve: assign({
      effects: ({ context }) => pushEffect(context.effects, 'reserve'),
    }),
    logRelease: assign({
      effects: ({ context }) => pushEffect(context.effects, 'release'),
    }),
    logOutbox: assign({
      effects: ({ context }) => pushEffect(context.effects, 'outbox_enqueue'),
    }),
    logFill: assign({
      effects: ({ context }) => pushEffect(context.effects, 'apply_fill'),
    }),
  },
}).createMachine({
  id: 'intent',
  initial: 'seen',
  context: ({ input }) => ({
    quoteId: input.quoteId,
    fingerprint: input.fingerprint,
    mode: input.mode,
    reason: null,
    quoteHash: null,
    txHash: null,
    intentHash: null,
    assetOut: null,
    amountOutRaw: null,
    expiresAtMs: null,
    effects: [],
  }),
  states: {
    seen: {
      on: {
        DECIDE_REJECT: {
          target: 'decided_reject',
          actions: assign({
            reason: ({ event }) => event.reason,
          }),
        },
        DECIDE_ACCEPT: {
          target: 'reserved',
          actions: [
            assign({
              assetOut: ({ event }) => event.assetOut,
              amountOutRaw: ({ event }) => event.amountOutRaw,
              expiresAtMs: ({ event }) => event.expiresAtMs,
            }),
            'logReserve',
          ],
        },
      },
    },

    reserved: {
      on: {
        MARK_SENT: {
          target: 'sent',
          guard: { type: 'isLive' },
          actions: [
            assign({
              quoteHash: ({ event }) => event.quoteHash,
            }),
            'logOutbox',
          ],
        },
        EXPIRE: { target: 'expired', actions: 'logRelease' },
        RELEASE: { target: 'released', actions: 'logRelease' },
      },
    },

    sent: {
      on: {
        MARK_SETTLED: {
          target: 'settled',
          actions: [
            assign({
              txHash: ({ event }) => event.txHash,
              intentHash: ({ event }) => event.intentHash,
            }),
            'logFill',
            'logRelease',
          ],
        },
        EXPIRE: { target: 'expired', actions: 'logRelease' },
        RELEASE: { target: 'released', actions: 'logRelease' },
      },
    },

    decided_reject: {
      type: 'final',
      on: {
        DECIDE_REJECT: undefined,
        EXPIRE: undefined,
      },
    },
    settled: {
      type: 'final',
      on: {
        MARK_SETTLED: undefined,
        EXPIRE: undefined,
      },
    },
    expired: {
      type: 'final',
      on: {
        EXPIRE: undefined,
      },
    },
    released: {
      type: 'final',
      on: {
        RELEASE: undefined,
        EXPIRE: undefined,
      },
    },
  },
});

export function createIntentActor(input: IntentInput) {
  const actor = createActor(intentMachine, { input });
  actor.start();
  return actor;
}

export function intentState(actor: ReturnType<typeof createIntentActor>): string {
  const v = actor.getSnapshot().value;
  return typeof v === 'string' ? v : JSON.stringify(v);
}

export function intentContext(
  actor: ReturnType<typeof createIntentActor>
): IntentContext {
  return actor.getSnapshot().context;
}
