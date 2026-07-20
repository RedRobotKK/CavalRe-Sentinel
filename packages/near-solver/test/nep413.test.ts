import { describe, it, expect } from 'vitest';
import { createHash, verify as edVerify, createPublicKey } from 'node:crypto';
import {
  borshString,
  borshU32,
  borshOptionString,
  nep413PayloadBytes,
  nep413Hash,
  signNep413,
  generateSolverKeypair,
  NEP413_TAG,
} from '../src/nep413';

describe('borsh primitives', () => {
  it('encodes u32 little-endian', () => {
    expect(Array.from(borshU32(1))).toEqual([1, 0, 0, 0]);
    expect(Array.from(borshU32(0x01020304))).toEqual([4, 3, 2, 1]);
  });

  it('encodes string as u32 length + utf8', () => {
    const b = borshString('hi');
    expect(Array.from(b)).toEqual([2, 0, 0, 0, 104, 105]);
  });

  it('encodes utf8 multibyte correctly by byte length, not char length', () => {
    const b = borshString('€'); // 3 bytes utf8
    expect(Array.from(b.slice(0, 4))).toEqual([3, 0, 0, 0]);
    expect(b.length).toBe(7);
  });

  it('encodes Option<string>: None = [0], Some = [1] + string', () => {
    expect(Array.from(borshOptionString(undefined))).toEqual([0]);
    expect(Array.from(borshOptionString('a'))).toEqual([1, 1, 0, 0, 0, 97]);
  });
});

describe('NEP-413 payload', () => {
  const nonce = new Uint8Array(32).map((_, i) => i); // [0..31]

  it('uses the standard tag 2^31 + 413', () => {
    expect(NEP413_TAG).toBe(2147484061);
  });

  it('serializes tag + message + nonce + recipient + optional callbackUrl in order', () => {
    const bytes = nep413PayloadBytes({ message: 'hi', nonce, recipient: 'myapp.com' });
    // tag(4) + strlen(4)+2 + nonce(32) + strlen(4)+9 + option(1) = 56
    expect(bytes.length).toBe(56);
    expect(Array.from(bytes.slice(0, 4))).toEqual([
      2147484061 & 0xff,
      (2147484061 >> 8) & 0xff,
      (2147484061 >> 16) & 0xff,
      (2147484061 >>> 24) & 0xff,
    ]);
    // message right after tag
    expect(Array.from(bytes.slice(4, 10))).toEqual([2, 0, 0, 0, 104, 105]);
    // nonce follows message
    expect(Array.from(bytes.slice(10, 42))).toEqual(Array.from(nonce));
    // final byte is Option None
    expect(bytes[bytes.length - 1]).toBe(0);
  });

  it('cannot collide with a NEAR transaction: tag makes signer-id length impossibly large', () => {
    const bytes = nep413PayloadBytes({ message: 'hi', nonce, recipient: 'r' });
    const fakeSignerLen = new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true);
    expect(fakeSignerLen).toBeGreaterThan(2 ** 31); // no real account id is 2GB long
  });

  it('hash equals sha256 of payload bytes', () => {
    const p = { message: 'hi', nonce, recipient: 'myapp.com' };
    const expected = createHash('sha256').update(nep413PayloadBytes(p)).digest();
    expect(Buffer.from(nep413Hash(p))).toEqual(expected);
  });

  it('rejects a nonce that is not exactly 32 bytes', () => {
    expect(() =>
      nep413PayloadBytes({ message: 'x', nonce: new Uint8Array(31), recipient: 'r' })
    ).toThrow();
  });
});

describe('signNep413', () => {
  const nonce = new Uint8Array(32).fill(7);

  it('produces a signature verifiable with the public key', () => {
    const kp = generateSolverKeypair();
    const signed = signNep413(
      { message: '{"deadline":"2026-01-01T00:00:00Z"}', nonce, recipient: 'intents.near' },
      kp.privateKey
    );

    const hash = nep413Hash({
      message: '{"deadline":"2026-01-01T00:00:00Z"}',
      nonce,
      recipient: 'intents.near',
    });
    const ok = edVerify(
      null,
      hash,
      createPublicKey(kp.privateKey),
      Buffer.from(signed.signatureBase64, 'base64')
    );
    expect(ok).toBe(true);
  });

  it('formats public key as ed25519:<base58>', () => {
    const kp = generateSolverKeypair();
    const signed = signNep413({ message: 'm', nonce, recipient: 'r' }, kp.privateKey);
    expect(signed.publicKeyString).toMatch(/^ed25519:[1-9A-HJ-NP-Za-km-z]+$/);
  });

  it('different nonces produce different signatures (no accidental reuse)', () => {
    const kp = generateSolverKeypair();
    const a = signNep413({ message: 'm', nonce, recipient: 'r' }, kp.privateKey);
    const b = signNep413(
      { message: 'm', nonce: new Uint8Array(32).fill(8), recipient: 'r' },
      kp.privateKey
    );
    expect(a.signatureBase64).not.toBe(b.signatureBase64);
  });

  it('exposes the nonce as base64 for the wire format', () => {
    const kp = generateSolverKeypair();
    const signed = signNep413({ message: 'm', nonce, recipient: 'r' }, kp.privateKey);
    expect(Buffer.from(signed.nonceBase64, 'base64')).toEqual(Buffer.from(nonce));
  });
});
