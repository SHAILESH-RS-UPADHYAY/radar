import type { SupabaseClient } from '@supabase/supabase-js';
import type { SettingsProfile } from '@/types';
import { extractSkills } from '@/lib/scraper/utils';

/** Comma-separated profile columns (location, current_role) → trimmed list. */
export const splitList = (v: unknown): string[] =>
  String(v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** The profile as the settings page edits it. Throws on a database error; null when onboarding never ran. */
export async function loadSettingsProfile(supabase: SupabaseClient, userId: string): Promise<SettingsProfile | null> {
  const { data: p, error } = await supabase
    .from('user_profiles')
    .select(
      'full_name, location, is_fresher, experience_years, skills, current_role, resume_text, vault_min_score, auto_vault, last_matched_at',
    )
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
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
    vault_min_score: p.vault_min_score ?? 70,
    auto_vault: p.auto_vault !== false,
    last_matched_at: p.last_matched_at,
  };
}
