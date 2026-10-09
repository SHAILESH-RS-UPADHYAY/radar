import { describe, expect, it } from 'vitest';
import {
  canonicalCity,
  cityAliases,
  inStrictCity,
  isKnownCity,
  knownCompaniesIn,
  locatedInIndia,
  placeFit,
} from './city-companies';

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

describe('placeFit: whole words, every segment', () => {
  it('finds the city in any segment of a multi-location posting', () => {
    expect(placeFit(['Pune'], 'Bengaluru / Remote / Pune', null)).toEqual({ kind: 'city', city: 'Pune' });
    expect(placeFit(['Bangalore'], 'Bengaluru, Karnataka, India', null)).toEqual({ kind: 'city', city: 'Bangalore' });
    expect(placeFit(['banglore'], 'Bangalore', null)).toEqual({ kind: 'city', city: 'banglore' });
    expect(placeFit(['Gurugram'], 'Gurgaon, Haryana', null)).toEqual({ kind: 'city', city: 'Gurugram' });
    expect(placeFit(['Mumbai'], 'Navi Mumbai', null)).toEqual({ kind: 'city', city: 'Mumbai' });
  });

  it('never matches an alias inside another word', () => {
    expect(placeFit(['San Francisco'], 'Data transfer team, Berlin', null).kind).toBe('elsewhere');
    expect(placeFit(['Delhi'], 'Pancreas ncrna lab, Boston', null).kind).toBe('elsewhere');
    expect(placeFit(['Pune'], 'Punekar Street, London', null).kind).toBe('elsewhere');
    expect(placeFit(['San Francisco'], 'San Francisco, SF', null).kind).toBe('city');
  });

  it('reads remote as a whole word too', () => {
    expect(placeFit(['Pune'], 'Remote, India', null)).toEqual({ kind: 'remote', wanted: false });
    expect(placeFit(['Pune', 'Remote'], 'Remote', null)).toEqual({ kind: 'remote', wanted: true });
    expect(placeFit(['Pune'], 'Remoteville', null).kind).toBe('elsewhere');
  });
});

describe('inStrictCity (autopilot)', () => {
  const off = { remote: false, countryOnly: false };
  it('takes only your cities by default', () => {
    expect(inStrictCity(['Pune'], 'Pune, Maharashtra', null, off)).toBe(true);
    expect(inStrictCity(['Pune'], 'Mumbai', null, off)).toBe(false);
    expect(inStrictCity(['Pune'], 'Remote', 'remote', off)).toBe(false);
    expect(inStrictCity(['Pune'], 'India', null, off)).toBe(false);
  });
  it('adds remote roles and country-only postings only when you allow them', () => {
    expect(inStrictCity(['Pune'], 'Remote', 'remote', { remote: true, countryOnly: false })).toBe(true);
    expect(inStrictCity(['Pune'], 'India', null, { remote: false, countryOnly: true })).toBe(true);
    expect(inStrictCity(['Pune'], 'Bengaluru, India', null, { remote: false, countryOnly: true })).toBe(false);
  });
});

describe('locatedInIndia', () => {
  it('reads Indian cities, states and the country, places abroad, and says nothing for remote or unstated', () => {
    for (const loc of ['Bengaluru', 'Gurgaon, Haryana', 'Remote, India', 'Indore', 'Hybrid - Mohali', 'Pune, MH, IN'])
      expect(locatedInIndia(loc)).toBe(true);
    for (const loc of ['London', 'Toronto, ON (Hybrid)', 'Remote - US', 'Berlin, Germany', 'EMEA', 'Singapore'])
      expect(locatedInIndia(loc)).toBe(false);
    for (const loc of ['Remote', 'Anywhere', '', null, 'Multiple locations', 'APAC'])
      expect(locatedInIndia(loc)).toBeNull();
  });

  it('knows cities by any alias', () => {
    expect(isKnownCity('Gurgaon')).toBe(true);
    expect(isKnownCity('bengaluru')).toBe(true);
    expect(isKnownCity('Paris')).toBe(false);
  });
});
