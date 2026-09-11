import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { resolveDreamCompanyIds } from '@/lib/dream-companies';
import { normalizeSkill } from '@/lib/scraper/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = createServerClient();
    const [{ data: profile, error }, { data: dream }] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_dream_companies').select('companies(name)').eq('user_id', userId),
    ]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const dreamCompanies = (dream || [])
      .map((d) => (Array.isArray(d.companies) ? d.companies[0] : d.companies) as { name: string } | null)
      .filter(Boolean)
      .map((c) => c!.name);

    // The embedding is large and useless to the browser.
    if (profile) delete (profile as Record<string, unknown>).resume_embedding;
    return NextResponse.json({ profile: profile || null, dreamCompanies });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

interface SettingsPatch {
  full_name?: unknown;
  location?: unknown;
  is_fresher?: unknown;
  experience_years?: unknown;
  skills?: unknown;
  vault_min_score?: unknown;
  auto_vault?: unknown;
  dream_companies?: unknown;
}

const strings = (v: unknown) =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim())
        .filter(Boolean)
    : null;

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as SettingsPatch;
  const update: Record<string, unknown> = {};
  if (typeof body.full_name === 'string') update.full_name = body.full_name.trim().slice(0, 120) || null;
  if (typeof body.location === 'string') update.location = body.location.trim().slice(0, 300) || null;
  if (typeof body.is_fresher === 'boolean') update.is_fresher = body.is_fresher;
  if (typeof body.experience_years === 'number')
    update.experience_years = Math.max(0, Math.min(50, Math.round(body.experience_years)));
  const skills = strings(body.skills);
  if (skills) update.skills = [...new Set(skills.map(normalizeSkill))].slice(0, 100);
  if (typeof body.vault_min_score === 'number')
    update.vault_min_score = Math.max(0, Math.min(100, Math.round(body.vault_min_score)));
  if (typeof body.auto_vault === 'boolean') update.auto_vault = body.auto_vault;
  const dream = strings(body.dream_companies);

  if (!Object.keys(update).length && !dream) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  try {
    const supabase = createServerClient();
    if (Object.keys(update).length) {
      // Skills/location feed the resume embedding when there is no resume text; force a recompute.
      if (update.skills || update.location) {
        const { data: p } = await supabase.from('user_profiles').select('resume_text').eq('id', userId).maybeSingle();
        if (!p?.resume_text) update.resume_embedding = null;
      }
      const { error } = await supabase.from('user_profiles').update(update).eq('id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (dream) {
      const ids = await resolveDreamCompanyIds(supabase, dream.slice(0, 20));
      await supabase.from('user_dream_companies').delete().eq('user_id', userId);
      if (ids.length) {
        const { error } = await supabase
          .from('user_dream_companies')
          .insert(ids.map((company_id) => ({ user_id: userId, company_id })));
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
