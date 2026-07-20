/**
 * SOLVER-BUS MESSAGE CODEC
 *
 * Parse and build JSON-RPC frames for the NEAR Intents solver relay.
 * All parsing is fail-closed: anything that does not validate exactly
 * becomes { kind: 'malformed' } — it never throws, and never produces
 * a partially-valid event.
 *
 * Amounts cross this boundary as decimal-string raw token units and are
 * converted to bigint. Floats are rejected outright.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface QuoteRequestEvent {
  quoteId: string;
  assetIn: string; // defuse asset id, e.g. "nep141:usdc.near"
  assetOut: string;
  exactAmountIn?: bigint | undefined; // raw token units; exactly one of in/out is set
  exactAmountOut?: bigint | undefined;
  minDeadlineMs: number;
}

export interface SettlementEvent {
  quoteHash: string;
  intentHash: string;
  txHash: string;
}

export type RelayMessage =
  | { kind: 'quote_request'; event: QuoteRequestEvent }
  | { kind: 'settlement'; event: SettlementEvent }
  | { kind: 'rpc_result'; id: number; result: unknown }
  | { kind: 'unknown' }
  | { kind: 'malformed' };

export interface Nep413SignedData {
  standard: 'nep413';
  payload: {
    message: string;
    nonce: string; // base64
    recipient: string;
    callbackUrl?: string;
  };
  publicKey: string; // "ed25519:<base58>"
  signature: string; // "ed25519:<base64>" per bus examples
}

// ============================================================================
// PARSING
// ============================================================================

const MALFORMED: RelayMessage = { kind: 'malformed' };

/** Strict decimal-string -> bigint. Rejects sign, exponents, decimals, spaces. */
function parseRawAmount(value: unknown): bigint | null {
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) return null;
  return BigInt(value);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

export function parseRelayMessage(raw: string): RelayMessage {
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return MALFORMED;
  }
  if (typeof msg !== 'object' || msg === null) return MALFORMED;
  const m = msg as Record<string, unknown>;

  // RPC result (subscription acks, quote_response acks)
  if ('result' in m && typeof m['id'] === 'number') {
    return { kind: 'rpc_result', id: m['id'], result: m['result'] };
  }

  if (m['method'] !== 'subscribe') return { kind: 'unknown' };
  const p = m['params'];
  if (typeof p !== 'object' || p === null) return { kind: 'unknown' };
  const params = p as Record<string, unknown>;

  // Quote request event
  if ('quote_id' in params) {
    if (
      !isNonEmptyString(params['quote_id']) ||
      !isNonEmptyString(params['defuse_asset_identifier_in']) ||
      !isNonEmptyString(params['defuse_asset_identifier_out']) ||
      typeof params['min_deadline_ms'] !== 'number'
    ) {
      return MALFORMED;
    }

    const hasIn = params['exact_amount_in'] !== undefined;
    const hasOut = params['exact_amount_out'] !== undefined;
    if (hasIn === hasOut) return MALFORMED; // exactly one side, per protocol

    let exactAmountIn: bigint | undefined;
    let exactAmountOut: bigint | undefined;
    if (hasIn) {
      const v = parseRawAmount(params['exact_amount_in']);
      if (v === null) return MALFORMED;
      exactAmountIn = v;
    } else {
      const v = parseRawAmount(params['exact_amount_out']);
      if (v === null) return MALFORMED;
      exactAmountOut = v;
    }

    return {
      kind: 'quote_request',
      event: {
        quoteId: params['quote_id'],
        assetIn: params['defuse_asset_identifier_in'],
        assetOut: params['defuse_asset_identifier_out'],
        exactAmountIn,
        exactAmountOut,
        minDeadlineMs: params['min_deadline_ms'],
      },
    };
  }

  // Settlement notification
  if ('intent_hash' in params) {
    if (
      !isNonEmptyString(params['quote_hash']) ||
      !isNonEmptyString(params['intent_hash']) ||
      !isNonEmptyString(params['tx_hash'])
    ) {
      return MALFORMED;
    }
    return {
      kind: 'settlement',
      event: {
        quoteHash: params['quote_hash'],
        intentHash: params['intent_hash'],
        txHash: params['tx_hash'],
      },
    };
  }

  return { kind: 'unknown' };
}

// ============================================================================
// BUILDING
// ============================================================================

/**
 * The intent message the solver signs: a token_diff from the SOLVER's
 * perspective. Positive = solver receives, negative = solver pays out.
 */
export function buildTokenDiffMessage(params: {
  signerId: string;
  deadlineIso: string;
  assetIn: string;
  amountIn: bigint;
  assetOut: string;
  amountOut: bigint;
}): string {
  return JSON.stringify({
    deadline: params.deadlineIso,
    intents: [
      {
        intent: 'token_diff',
        diff: {
          [params.assetIn]: params.amountIn.toString(),
          [params.assetOut]: `-${params.amountOut.toString()}`,
        },
      },
    ],
    signer_id: params.signerId,
  });
}

export function buildQuoteResponse(params: {
  rpcId: number;
  quoteId: string;
  quoteOutput: { amountOut?: bigint; amountIn?: bigint };
  signedData: Nep413SignedData;
  otherQuoteHashes?: string[];
}): string {
  const quoteOutput: Record<string, string> = {};
  if (params.quoteOutput.amountOut !== undefined) {
    quoteOutput['amount_out'] = params.quoteOutput.amountOut.toString();
  }
  if (params.quoteOutput.amountIn !== undefined) {
    quoteOutput['amount_in'] = params.quoteOutput.amountIn.toString();
  }

  return JSON.stringify({
    jsonrpc: '2.0',
    id: params.rpcId,
    method: 'quote_response',
    params: [
      {
        quote_id: params.quoteId,
        quote_output: quoteOutput,
        signed_data: params.signedData,
        ...(params.otherQuoteHashes ? { other_quote_hashes: params.otherQuoteHashes } : {}),
      },
    ],
  });
}
