import { describe, expect, it } from 'vitest';
import { pickForVault } from './match';

describe('pickForVault', () => {
  const c = (id: string, company: string, score: number) => ({ id, company, score });
  it('keeps the best per company up to the cap, counting what the Vault already holds', () => {
    const list = [c('a1', 'amazon', 90), c('a2', 'amazon', 95), c('a3', 'amazon', 85), c('e1', 'elevenlabs', 88)];
    expect(pickForVault(list, new Map(), new Set(), 2)).toEqual(['a2', 'a1', 'e1']);
    expect(pickForVault(list, new Map([['elevenlabs', 2]]), new Set(), 2)).toEqual(['a2', 'a1']);
  });
  it('skips a company you already applied to', () => {
    expect(
      pickForVault([c('e1', 'elevenlabs', 99), c('s1', 'sarvam', 80)], new Map(), new Set(['elevenlabs'])),
    ).toEqual(['s1']);
  });
});
