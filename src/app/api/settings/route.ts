import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { resolveDreamCompanyIds } from '@/lib/dream-companies';
import { normalizeSkill } from '@/lib/scraper/utils';
import { loadSettingsProfile } from '@/lib/profile';
import { isSchemaMissing } from '@/lib/supabase/errors';
import { cleanKit, cleanPortfolio, MAX_DREAM_COMPANIES } from '@/lib/validate';
import { serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = createServerClient();
    const [profile, { data: dream }] = await Promise.all([
      loadSettingsProfile(supabase, userId),
      supabase.from('user_dream_companies').select('companies(name)').eq('user_id', userId),
    ]);
    const dreamCompanies = (dream || [])
      .map((d) => (Array.isArray(d.companies) ? d.companies[0] : d.companies) as { name: string } | null)
      .filter(Boolean)
      .map((c) => c!.name);
    return NextResponse.json({ profile, dreamCompanies });
  } catch (err) {
    return serverError('API /settings', err);
  }
}

interface SettingsPatch {
  full_name?: unknown;
  target_roles?: unknown;
  location?: unknown;
  is_fresher?: unknown;
  experience_years?: unknown;
  skills?: unknown;
  vault_min_score?: unknown;
  auto_vault?: unknown;
  auto_overclock?: unknown;
  overclock_daily_cap?: unknown;
  dream_companies?: unknown;
  portfolio?: unknown;
  application_kit?: unknown;
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
  const roles = strings(body.target_roles);
  if (roles) {
    const unique = [...new Map(roles.map((r) => [r.toLowerCase(), r.replace(/,/g, ' ').slice(0, 60)])).values()];
    update.current_role = unique.slice(0, 8).join(', ') || null;
  }
  const skills = strings(body.skills);
  if (skills) update.skills = [...new Set(skills.map(normalizeSkill))].slice(0, 100);
  if (typeof body.vault_min_score === 'number')
    update.vault_min_score = Math.max(0, Math.min(100, Math.round(body.vault_min_score)));
  if (typeof body.auto_vault === 'boolean') update.auto_vault = body.auto_vault;
  if (typeof body.auto_overclock === 'boolean') update.auto_overclock = body.auto_overclock;
  if (typeof body.overclock_daily_cap === 'number')
    update.overclock_daily_cap = Math.max(0, Math.min(20, Math.round(body.overclock_daily_cap)));
  if (body.portfolio !== undefined) {
    const portfolio = cleanPortfolio(body.portfolio);
    if (typeof portfolio === 'string') return NextResponse.json({ error: portfolio }, { status: 400 });
    update.portfolio = portfolio;
  }
  if (body.application_kit !== undefined) update.application_kit = cleanKit(body.application_kit);
  const dream = strings(body.dream_companies);

  if (!Object.keys(update).length && !dream) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  try {
    const supabase = createServerClient();
    if (Object.keys(update).length) {
      // Skills/location feed the resume embedding when there is no resume text; force a recompute.
      if (update.skills || update.location) {
        const { data: p } = await supabase.from('user_profiles').select('resume_text').eq('id', userId).maybeSingle();
        if (!p?.resume_text) update.resume_embedding = update.resume_embedding_v2 = null;
      }
      const { error } = await supabase.from('user_profiles').update(update).eq('id', userId);
      if (isSchemaMissing(error))
        return NextResponse.json(
          {
            error: update.application_kit
              ? 'The Application Kit needs migration 009. Run supabase/migrations/009_sources_apply_kit.sql.'
              : update.portfolio
                ? 'Portfolio needs migration 008. Run supabase/migrations/008_portfolio.sql.'
                : 'This setting needs migration 007. Run supabase/migrations/007_discovery_verify_autopilot.sql.',
          },
          { status: 503 },
        );
      if (error) return serverError('API /settings', error);
    }

    if (dream) {
      const ids = await resolveDreamCompanyIds(supabase, dream.slice(0, MAX_DREAM_COMPANIES));
      await supabase.from('user_dream_companies').delete().eq('user_id', userId);
      if (ids.length) {
        const { error } = await supabase
          .from('user_dream_companies')
          .insert(ids.map((company_id) => ({ user_id: userId, company_id })));
        if (error) return serverError('API /settings', error);
      }
    }
    // Echo the saved profile so the page shows exactly what was stored (e.g. normalised skills).
    return NextResponse.json({ ok: true, profile: await loadSettingsProfile(supabase, userId) });
  } catch (err) {
    return serverError('API /settings', err);
  }
}
