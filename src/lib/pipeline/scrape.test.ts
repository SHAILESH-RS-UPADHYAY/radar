import { describe, expect, it } from 'vitest';
import { withinExperience } from './scrape';

describe('withinExperience', () => {
  it('keeps up to 3 years and unstated, drops 3-5 and 5+', () => {
    const keep = ['fresher', '0-1', '1-3', null].map((e) => withinExperience({ experience_required: e }));
    const drop = ['3-5', '5+'].map((e) => withinExperience({ experience_required: e }));
    expect(keep).toEqual([true, true, true, true]);
    expect(drop).toEqual([false, false]);
  });
});
