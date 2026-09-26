// Recognise "that column/table is not there yet" errors, so a feature can fall back cleanly until its
// migration has been run instead of taking the whole page down.

type DbError = { code?: string; message?: string } | null | undefined;

// 42703 / 42P01: Postgres undefined column / table. PGRST204 / PGRST205: PostgREST schema-cache misses.
const MISSING = new Set(['42703', '42P01', 'PGRST204', 'PGRST205']);

export function isSchemaMissing(error: DbError): boolean {
  if (!error) return false;
  return MISSING.has(error.code || '') || /does not exist|schema cache/i.test(error.message || '');
}
