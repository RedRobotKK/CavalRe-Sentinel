/**
 * NEP-413 OFF-CHAIN MESSAGE SIGNING
 *
 * Implements the NEAR NEP-413 signMessage payload exactly:
 *   sha256( borsh(u32 tag = 2^31+413) ++ borsh(Payload{message, nonce[32], recipient, callbackUrl?}) )
 * signed with an ed25519 full-access key.
 *
 * Zero external dependencies: borsh subset and base58 are implemented here;
 * ed25519 + sha256 come from node:crypto. The borsh subset is deliberately
 * minimal — only the four encoders NEP-413 needs — and each is unit-tested
 * against the spec.
 *
 * Spec: https://github.com/near/NEPs/blob/master/neps/nep-0413.md
 */

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as edSign,
  type KeyObject,
} from 'node:crypto';

/** 2^31 + 413: guarantees the signed bytes can never be a valid NEAR transaction. */
export const NEP413_TAG = 2147484061;

const NONCE_LENGTH_BYTES = 32;

// ============================================================================
// BORSH SUBSET
// ============================================================================

export function borshU32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true); // little-endian
  return out;
}

export function borshString(value: string): Uint8Array {
  const utf8 = new TextEncoder().encode(value);
  const out = new Uint8Array(4 + utf8.length);
  out.set(borshU32(utf8.length), 0);
  out.set(utf8, 4);
  return out;
}

export function borshOptionString(value: string | undefined): Uint8Array {
  if (value === undefined) return new Uint8Array([0]);
  const s = borshString(value);
  const out = new Uint8Array(1 + s.length);
  out[0] = 1;
  out.set(s, 1);
  return out;
}

// ============================================================================
// PAYLOAD
// ============================================================================

export interface Nep413Payload {
  message: string;
  nonce: Uint8Array; // exactly 32 bytes
  recipient: string;
  callbackUrl?: string | undefined;
}

export function nep413PayloadBytes(p: Nep413Payload): Uint8Array {
  if (p.nonce.length !== NONCE_LENGTH_BYTES) {
    throw new Error(`NEP-413 nonce must be exactly ${NONCE_LENGTH_BYTES} bytes, got ${p.nonce.length}`);
  }
  const parts = [
    borshU32(NEP413_TAG),
    borshString(p.message),
    p.nonce, // fixed-size array: raw bytes, no length prefix
    borshString(p.recipient),
    borshOptionString(p.callbackUrl),
  ];
  const total = parts.reduce((n, part) => n + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function nep413Hash(p: Nep413Payload): Uint8Array {
  return new Uint8Array(createHash('sha256').update(nep413PayloadBytes(p)).digest());
}

// ============================================================================
// KEYS + SIGNING
// ============================================================================

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Encode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let out = '';
  while (n > 0n) {
    out = BASE58_ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  // Preserve leading zero bytes as '1'
  for (const b of bytes) {
    if (b !== 0) break;
    out = '1' + out;
  }
  return out || '1';
}

export interface SolverKeypair {
  privateKey: KeyObject;
  publicKeyRaw: Uint8Array; // 32-byte ed25519 public key
}

/** Generate an ephemeral keypair (tests / dev). Production keys come from a keystore. */
export function generateSolverKeypair(): SolverKeypair {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return { privateKey, publicKeyRaw: rawPublicKey(publicKey) };
}

/** Load a private key from a raw 32-byte ed25519 seed (e.g. from env/keystore). */
export function privateKeyFromSeed(seed: Uint8Array): KeyObject {
  if (seed.length !== 32) throw new Error('ed25519 seed must be 32 bytes');
  // PKCS8 wrapping for a raw ed25519 seed
  const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  return createPrivateKey({
    key: Buffer.concat([pkcs8Prefix, Buffer.from(seed)]),
    format: 'der',
    type: 'pkcs8',
  });
}

function rawPublicKey(publicKey: KeyObject): Uint8Array {
  const spki = publicKey.export({ format: 'der', type: 'spki' });
  return new Uint8Array(spki.subarray(spki.length - 32)); // last 32 bytes of SPKI DER
}

export interface Nep413Signature {
  signatureBase64: string;
  publicKeyString: string; // "ed25519:<base58>"
  nonceBase64: string;
}

export function signNep413(payload: Nep413Payload, privateKey: KeyObject): Nep413Signature {
  const hash = nep413Hash(payload);
  const signature = edSign(null, hash, privateKey);
  const publicKeyRaw = rawPublicKey(createPublicKey(privateKey));
  return {
    signatureBase64: Buffer.from(signature).toString('base64'),
    publicKeyString: `ed25519:${base58Encode(publicKeyRaw)}`,
    nonceBase64: Buffer.from(payload.nonce).toString('base64'),
  };
}
