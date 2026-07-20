/**
 * END-TO-END: wire frame in -> signed quote_response frame out.
 *
 * Exercises the full path a production quote takes:
 *   RelayClient(parse) -> SolverPipeline(decide) -> ledger inventory ->
 *   token_diff message -> NEP-413 sign -> quote_response frame -> transport
 * with a fake transport and deterministic clock/nonce. Then verifies the
 * signature cryptographically, exactly as the verifier contract would.
 */
import { describe, it, expect } from 'vitest';
import { verify as edVerify, createPublicKey } from 'node:crypto';
import * as FloatLib from '@cavalre/floatlib-ts';
import {
  RelayClient,
  type Transport,
  type TransportHandlers,
  SolverPipeline,
  LedgerInventory,
  SolverRiskGuard,
  buildTokenDiffMessage,
  buildQuoteResponse,
  signNep413,
  nep413Hash,
  generateSolverKeypair,
  type QuoteRequestEvent,
} from '../src/index';

const USDC = 'nep141:usdc.near';
const WNEAR = 'nep141:wrap.near';
const REGISTRY = new Map([
  [USDC, { symbol: 'USDC', decimals: 6n }],
  [WNEAR, { symbol: 'wNEAR', decimals: 24n }],
]);
const VERIFIER = 'intents.near';
const FIXED_NOW = Date.parse('2026-07-20T12:00:00.000Z');
const FIXED_NONCE = new Uint8Array(32).fill(42);

class FakeTransport implements Transport {
  sent: string[] = [];
  constructor(public handlers: TransportHandlers) {}
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {}
}

describe('end-to-end quote flow', () => {
  it('turns a relay quote frame into a verifiable signed quote_response', () => {
    // --- assemble the solver exactly as production would, minus real I/O ---
    const keypair = generateSolverKeypair();
    const inventory = new LedgerInventory(REGISTRY);
    inventory.deposit(WNEAR, 1_000n * 10n ** 24n, 'genesis');
    inventory.deposit(USDC, 10_000_000000n, 'genesis');

    const pipeline = new SolverPipeline({
      registry: REGISTRY,
      priceSource: {
        mid: (a, b) => (a === USDC && b === WNEAR ? FloatLib.toFloat(2n, 0n) : null),
        usdPrice: (a) => (a === USDC ? FloatLib.ONE : FloatLib.toFloat(5n, 1n)),
      },
      inventory,
      riskGuard: new SolverRiskGuard({
        maxQuoteNotionalUsd: FloatLib.toFloat(10_000n, 0n),
        maxDailyLossUsd: FloatLib.toFloat(500n, 0n),
      }),
      config: {
        signerId: 'sentinel-solver.near',
        halfSpreadBps: 50,
        maxInventorySkewBps: 100,
        quoteValidityMs: 60_000,
        minNotionalUsd: FloatLib.toFloat(10n, 0n),
      },
      now: () => FIXED_NOW,
    });

    let transport!: FakeTransport;
    const client = new RelayClient({
      url: 'wss://fake',
      transportFactory: (_u, handlers) => (transport = new FakeTransport(handlers)),
      reconnectMinMs: 1000,
      reconnectMaxMs: 8000,
      onSettlement: () => {},
      onQuoteRequest: (event: QuoteRequestEvent) => {
        const decision = pipeline.decide(event);
        if (!decision.shouldQuote) return;
        const message = buildTokenDiffMessage({
          signerId: 'sentinel-solver.near',
          deadlineIso: decision.deadlineIso,
          assetIn: decision.assetIn,
          amountIn: decision.amountInRaw,
          assetOut: decision.assetOut,
          amountOut: decision.amountOutRaw,
        });
        const signed = signNep413(
          { message, nonce: FIXED_NONCE, recipient: VERIFIER },
          keypair.privateKey
        );
        client.sendFrame(
          buildQuoteResponse({
            rpcId: client.nextRpcId(),
            quoteId: decision.quoteId,
            quoteOutput: { amountOut: decision.amountOutRaw },
            signedData: {
              standard: 'nep413',
              payload: { message, nonce: signed.nonceBase64, recipient: VERIFIER },
              publicKey: signed.publicKeyString,
              signature: `ed25519:${signed.signatureBase64}`,
            },
          })
        );
      },
    });

    client.start();
    transport.handlers.onOpen();

    // --- a taker wants to sell 100 USDC for wNEAR ---
    transport.handlers.onMessage(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'subscribe',
        params: {
          subscription: 's-1',
          quote_id: 'q-e2e',
          defuse_asset_identifier_in: USDC,
          defuse_asset_identifier_out: WNEAR,
          exact_amount_in: '100000000',
          min_deadline_ms: 60000,
        },
      })
    );

    // frames: 2 subscribes + 1 quote_response
    expect(transport.sent).toHaveLength(3);
    const response = JSON.parse(transport.sent[2]!);
    expect(response.method).toBe('quote_response');
    expect(response.params[0].quote_id).toBe('q-e2e');

    // economics: 200 wNEAR at mid, minus 50bps + skew -> within (198, 199) wNEAR
    const amountOut = BigInt(response.params[0].quote_output.amount_out);
    expect(amountOut).toBeGreaterThan(198n * 10n ** 24n);
    expect(amountOut).toBeLessThan(199n * 10n ** 24n);

    // the signed token_diff matches the quoted amounts, solver-perspective
    const signedData = response.params[0].signed_data;
    const intentMessage = JSON.parse(signedData.payload.message);
    expect(intentMessage.signer_id).toBe('sentinel-solver.near');
    expect(intentMessage.deadline).toBe('2026-07-20T12:01:00.000Z');
    expect(intentMessage.intents[0].diff[USDC]).toBe('100000000');
    expect(intentMessage.intents[0].diff[WNEAR]).toBe(`-${amountOut.toString()}`);

    // signature verifies against the NEP-413 hash, like the verifier would check
    const hash = nep413Hash({
      message: signedData.payload.message,
      nonce: new Uint8Array(Buffer.from(signedData.payload.nonce, 'base64')),
      recipient: VERIFIER,
    });
    const sigBytes = Buffer.from(signedData.signature.replace('ed25519:', ''), 'base64');
    expect(edVerify(null, hash, createPublicKey(keypair.privateKey), sigBytes)).toBe(true);
  });

  it('stays silent on quotes it must not fill (no frame leaks)', () => {
    const pipeline = new SolverPipeline({
      registry: REGISTRY,
      priceSource: { mid: () => null, usdPrice: () => null }, // no prices -> never quote
      inventory: new LedgerInventory(REGISTRY),
      riskGuard: new SolverRiskGuard({
        maxQuoteNotionalUsd: FloatLib.toFloat(10_000n, 0n),
        maxDailyLossUsd: FloatLib.toFloat(500n, 0n),
      }),
      config: {
        signerId: 'sentinel-solver.near',
        halfSpreadBps: 50,
        maxInventorySkewBps: 100,
        quoteValidityMs: 60_000,
        minNotionalUsd: FloatLib.toFloat(10n, 0n),
      },
      now: () => FIXED_NOW,
    });

    let transport!: FakeTransport;
    const client = new RelayClient({
      url: 'wss://fake',
      transportFactory: (_u, h) => (transport = new FakeTransport(h)),
      reconnectMinMs: 1000,
      reconnectMaxMs: 8000,
      onSettlement: () => {},
      onQuoteRequest: (event) => {
        const d = pipeline.decide(event);
        expect(d.shouldQuote).toBe(false);
      },
    });
    client.start();
    transport.handlers.onOpen();
    transport.handlers.onMessage(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'subscribe',
        params: {
          subscription: 's-1',
          quote_id: 'q-blocked',
          defuse_asset_identifier_in: USDC,
          defuse_asset_identifier_out: WNEAR,
          exact_amount_in: '100000000',
          min_deadline_ms: 60000,
        },
      })
    );
    expect(transport.sent).toHaveLength(2); // subscribes only, no quote_response
  });
});
