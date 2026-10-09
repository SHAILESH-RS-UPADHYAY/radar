import { describe, expect, it } from 'vitest';
import { pickForVault } from './match';

describe('pickForVault', () => {
  const c = (id: string, company: string, score: number) => ({ id, company, score });
  it('keeps the best per company up to the cap, counting what the company already holds', () => {
    const list = [c('a1', 'amazon', 90), c('a2', 'amazon', 95), c('a3', 'amazon', 85), c('e1', 'elevenlabs', 88)];
    expect(pickForVault(list, new Map(), 2)).toEqual(['a2', 'a1', 'e1']);
    expect(pickForVault(list, new Map([['elevenlabs', 2]]), 2)).toEqual(['a2', 'a1']);
  });
  it('counts applications: one application leaves room for one more role, two leave none', () => {
    const list = [c('e1', 'elevenlabs', 99), c('e2', 'elevenlabs', 97), c('s1', 'sarvam', 80)];
    expect(pickForVault(list, new Map([['elevenlabs', 1]]))).toEqual(['e1', 's1']);
    expect(pickForVault(list, new Map([['elevenlabs', 2]]))).toEqual(['s1']);
  });
});
