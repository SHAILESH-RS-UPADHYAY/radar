import type { SupabaseClient } from '@supabase/supabase-js';
import { COMPANY_SEEDS } from './companies';

/**
 * Keeps the companies table in line with COMPANY_SEEDS: inserts missing companies and
 * updates the ATS fields of existing ones (matched by name), so fixed tokens reach an
 * already-seeded database. Companies added by hand in the DB are left alone.
 */
export async function ensureCompaniesSeeded(supabase: SupabaseClient) {
  const { data: existing, error } = await supabase
    .from('companies')
    .select('id, name, ats_provider, ats_identifier, careers_url, category');
  if (error) {
    console.error('[SEED] Read failed:', error.message);
    return;
  }

  const byName = new Map((existing || []).map((row) => [row.name.toLowerCase(), row]));
  const toInsert = COMPANY_SEEDS.filter((s) => !byName.has(s.name.toLowerCase()));

  if (toInsert.length) {
    const { error: insertErr } = await supabase.from('companies').insert(
      toInsert.map((s) => ({
        name: s.name,
        logo_url: s.logo_url,
        careers_url: s.careers_url,
        ats_provider: s.ats_provider,
        ats_identifier: s.ats_identifier,
        category: s.category,
        country: s.country,
        city: s.city,
        is_active: true,
      })),
    );
    if (insertErr) console.error('[SEED] Insert failed:', insertErr.message);
    else console.log('[SEED] Inserted', toInsert.length, 'companies');
  }

  for (const s of COMPANY_SEEDS) {
    const row = byName.get(s.name.toLowerCase());
    if (!row) continue;
    if (
      row.ats_provider === s.ats_provider &&
      row.ats_identifier === s.ats_identifier &&
      row.careers_url === s.careers_url &&
      row.category === s.category
    )
      continue;
    const { error: updErr } = await supabase
      .from('companies')
      .update({
        ats_provider: s.ats_provider,
        ats_identifier: s.ats_identifier,
        careers_url: s.careers_url,
        category: s.category,
      })
      .eq('id', row.id);
    if (updErr) console.error('[SEED] Update failed for', s.name + ':', updErr.message);
  }
}
