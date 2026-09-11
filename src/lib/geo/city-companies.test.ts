import { describe, expect, it } from 'vitest';
import { canonicalCity, cityAliases, knownCompaniesIn } from './city-companies';

describe('city aliases', () => {
  it('maps alternate spellings to one city', () => {
    expect(canonicalCity('bengaluru')).toBe('Bangalore');
    expect(canonicalCity('Gurgaon')).toBe('Gurugram');
    expect(cityAliases('Bangalore')).toContain('bengaluru');
    expect(cityAliases('Atlantis')).toEqual(['atlantis']);
  });
});

describe('knownCompaniesIn', () => {
  it('lists only companies established in that city', () => {
    const chandigarh = knownCompaniesIn(['Chandigarh']).map((c) => c.name);
    expect(chandigarh).toEqual(['Infosys']);
    expect(chandigarh).not.toContain('Amazon');
  });
  it('merges several cities without duplicates', () => {
    const names = knownCompaniesIn(['Bangalore', 'Hyderabad']).map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining(['Flipkart', 'Darwinbox']));
  });
  it('returns nothing for unknown cities', () => {
    expect(knownCompaniesIn(['Atlantis'])).toEqual([]);
  });
});
