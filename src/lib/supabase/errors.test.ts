import { describe, expect, it } from 'vitest';
import { isSchemaMissing } from './errors';

describe('isSchemaMissing', () => {
  it('recognises missing columns and tables from Postgres and PostgREST', () => {
    expect(isSchemaMissing({ code: '42703', message: 'column match_scores.stage does not exist' })).toBe(true);
    expect(isSchemaMissing({ code: 'PGRST204', message: "Could not find the 'stage' column" })).toBe(true);
    expect(isSchemaMissing({ code: 'PGRST205', message: 'Could not find the table' })).toBe(true);
    expect(isSchemaMissing({ message: 'relation "tailored_resumes" does not exist' })).toBe(true);
  });

  it('leaves real failures alone', () => {
    expect(isSchemaMissing(null)).toBe(false);
    expect(isSchemaMissing({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(false);
    expect(isSchemaMissing({ message: 'TypeError: fetch failed' })).toBe(false);
  });
});
