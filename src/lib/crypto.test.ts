import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './crypto';

describe('encryptSecret / decryptSecret', () => {
  it('round-trips, with a fresh IV every time', () => {
    const a = encryptSecret('1//refresh-token', 'k'.repeat(40));
    const b = encryptSecret('1//refresh-token', 'k'.repeat(40));
    expect(a).not.toBe(b);
    expect(decryptSecret(a, 'k'.repeat(40))).toBe('1//refresh-token');
  });

  it('rejects a wrong key or a tampered value', () => {
    const sealed = encryptSecret('secret', 'right-key');
    expect(() => decryptSecret(sealed, 'wrong-key')).toThrow();
    const [iv, tag, body] = sealed.split('.');
    const flipped = body.slice(0, -1) + (body.endsWith('A') ? 'B' : 'A');
    expect(() => decryptSecret([iv, tag, flipped].join('.'), 'right-key')).toThrow();
  });
});
