import type { SupabaseClient } from '@supabase/supabase-js';
import type { Portfolio, SettingsProfile } from '@/types';
import { extractSkills } from '@/lib/scraper/utils';
import { isSchemaMissing } from '@/lib/supabase/errors';

interface ProfileRow {
  full_name: string | null;
  location: string | null;
  is_fresher: boolean | null;
  experience_years: number | null;
  skills: string[] | null;
  current_role: string | null;
  resume_text: string | null;
  vault_min_score: number | null;
  auto_vault: boolean | null;
  last_matched_at: string | null;
  auto_overclock?: boolean;
  overclock_daily_cap?: number;
  portfolio?: Partial<Portfolio> | null;
}

/** The stored portfolio JSON with every field present. */
export const toPortfolio = (v: Partial<Portfolio> | null | undefined): Portfolio => ({
  portfolio: v?.portfolio || '',
  github: v?.github || '',
  linkedin: v?.linkedin || '',
  website: v?.website || '',
  projects: Array.isArray(v?.projects) ? v.projects : [],
});

/** Comma-separated profile columns (location, current_role) → trimmed list. */
export const splitList = (v: unknown): string[] =>
  String(v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** The profile as the settings page edits it. Throws on a database error; null when onboarding never ran. */
export async function loadSettingsProfile(supabase: SupabaseClient, userId: string): Promise<SettingsProfile | null> {
  const base =
    'full_name, location, is_fresher, experience_years, skills, current_role, resume_text, vault_min_score, auto_vault, last_matched_at';
  const read = (columns: string) => supabase.from('user_profiles').select(columns).eq('id', userId).maybeSingle();
  // Newest schema first: portfolio (008), then auto-OVERCLOCK (007), then everything before them.
  const tiers = [
    base + ', auto_overclock, overclock_daily_cap, portfolio',
    base + ', auto_overclock, overclock_daily_cap',
    base,
  ];
  let { data, error } = await read(tiers[0]);
  for (let i = 1; i < tiers.length && isSchemaMissing(error); i++) ({ data, error } = await read(tiers[i]));
  if (error) throw new Error(error.message);
  const p = data as unknown as ProfileRow | null;
  if (!p) return null;
  return {
    full_name: p.full_name,
    location: p.location,
    is_fresher: p.is_fresher ?? true,
    experience_years: p.experience_years ?? 0,
    skills: p.skills || [],
    target_roles: splitList(p.current_role),
    has_resume: !!p.resume_text,
    resume_skills: extractSkills(p.resume_text || ''),
    vault_min_score: p.vault_min_score ?? 80,
    auto_vault: p.auto_vault !== false,
    auto_overclock: typeof p.auto_overclock === 'boolean' ? p.auto_overclock : null,
    overclock_daily_cap: p.overclock_daily_cap ?? 5,
    last_matched_at: p.last_matched_at,
    portfolio: p.portfolio === undefined ? null : toPortfolio(p.portfolio),
  };
}
