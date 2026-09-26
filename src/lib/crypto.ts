// Authenticated encryption for secrets RADAR must store (e.g. a Gmail refresh token): AES-256-GCM.
// The key is derived from GMAIL_TOKEN_KEY, so any long random string works as the secret.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const keyFrom = (secret: string) => createHash('sha256').update(secret).digest();

/** "iv.tag.ciphertext", each base64url. */
export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString('base64url')).join('.');
}

/** Throws if the value was tampered with or the key is wrong. */
export function decryptSecret(sealed: string, secret: string): string {
  const [iv, tag, body] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'));
  if (!iv || !tag || !body) throw new Error('Malformed secret');
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}
