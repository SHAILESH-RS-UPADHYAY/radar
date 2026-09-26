import { describe, expect, it } from 'vitest';
import { STATUS_WORDS, drawWords } from './status-words';

describe('status words', () => {
  it('are unique and fit a phone footer', () => {
    expect(STATUS_WORDS.length).toBeGreaterThanOrEqual(150);
    expect(new Set(STATUS_WORDS.map((w) => w.toLowerCase())).size).toBe(STATUS_WORDS.length);
    expect(Math.max(...STATUS_WORDS.map((w) => w.length))).toBeLessThanOrEqual(22);
  });

  it('never repeat until every word has been shown', () => {
    const seen: string[] = [];
    while (seen.length < STATUS_WORDS.length - 16) seen.push(...drawWords(16));
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('keep every briefing free of repeats, across reshuffles too', () => {
    let previous = '';
    for (let i = 0; i < 60; i++) {
      const words = drawWords(16);
      expect(new Set(words).size).toBe(16);
      expect(words[0]).not.toBe(previous);
      previous = words[15];
    }
  });
});
