import type { SupabaseClient } from '@supabase/supabase-js';
import { COMPANY_SEEDS } from '@/lib/scraper/companies';

/** Company names → company ids, creating untracked (custom) rows for names we do not know yet. */
export async function resolveDreamCompanyIds(supabase: SupabaseClient, names: string[]): Promise<string[]> {
  const ids: string[] = [];
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];

  for (const name of unique) {
    const { data: existing } = await supabase.from('companies').select('id').ilike('name', name).limit(1);

    if (existing?.[0]?.id) {
      ids.push(existing[0].id);
      continue;
    }

    const seed = COMPANY_SEEDS.find((c) => c.name.toLowerCase() === name.toLowerCase());
    const { data: inserted, error } = await supabase
      .from('companies')
      .insert({
        name,
        careers_url: seed?.careers_url || 'https://www.google.com/search?q=' + encodeURIComponent(name + ' careers'),
        ats_provider: seed?.ats_provider || 'custom',
        ats_identifier: seed?.ats_identifier || null,
        category: seed?.category || 'Startup',
        country: seed?.country || 'India',
        city: seed?.city || null,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[ONBOARDING] Dream company insert failed:', name, error.message);
      continue;
    }
    if (inserted?.id) ids.push(inserted.id);
  }

  return ids;
}
