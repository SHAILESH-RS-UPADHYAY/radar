/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { isSchemaMissing } from '@/lib/supabase/errors';
import { isUuid } from '@/lib/validate';
import { politeFetcher } from '@/lib/discovery/polite';
import { checkPosting, checkUrl, recordChecks, VERIFY_TTL_MS, type PostingState } from '@/lib/pipeline/verify';
import { sourceName } from '@/lib/scraper/catalog';
import { formatDescription } from '@/lib/jd';
import { greenhousePay } from '@/lib/scraper/adapters';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const BASE =
  'id, external_id, title, description, location, work_type, department, apply_url, is_active, posted_at, scraped_at, salary_min, salary_max, salary_currency, experience_required, employer,';
// Newest schema first (migration 012 adds resolved_url, 007 verified_at and company provenance), then older ones.
const TIERS = [
  BASE +
    ' verified_at, resolved_url, companies!inner(name, category, ats_provider, ats_identifier, funding_stage, source)',
  BASE + ' verified_at, companies!inner(name, category, ats_provider, ats_identifier, funding_stage, source)',
  BASE + ' companies!inner(name, category, ats_provider, ats_identifier)',
];

export interface PostingCheck {
  state: PostingState;
  checkedAt: string | null;
  /** feed = listed in the company's ATS feed at the last scrape; link = apply link opened; none = cannot tell. */
  via: 'feed' | 'link' | 'none';
}

// GET /api/jobs/:id[?verify=1] — one job in full for the JD terminal: description, your match, and whether
// the posting is still open (board jobs get their apply link checked, at most every 6 hours).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const supabase = createServerClient();
  const [jobResult, { data: match }, { data: me }] = await Promise.all([
    (async () => {
      let result = await supabase.from('jobs').select(TIERS[0]).eq('id', id).maybeSingle();
      for (let i = 1; i < TIERS.length && isSchemaMissing(result.error); i++)
        result = await supabase.from('jobs').select(TIERS[i]).eq('id', id).maybeSingle();
      return result;
    })(),
    supabase
      .from('match_scores')
      .select('score, matching_skills, missing_skills, status, reasoning')
      .eq('user_id', userId)
      .eq('job_id', id)
      .maybeSingle(),
    supabase.from('user_profiles').select('experience_years, is_fresher').eq('id', userId).maybeSingle(),
  ] as const);
  if (jobResult.error) return NextResponse.json({ error: jobResult.error.message }, { status: 500 });
  const job = jobResult.data as any;
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const company = Array.isArray(job.companies) ? job.companies[0] : job.companies;

  // Sources RADAR never opens (search APIs, LinkedIn, Indeed) are judged by their feed: listed at the last read.
  const target = checkUrl(job, company.ats_provider);
  let posting: PostingCheck;
  if (!job.is_active)
    posting = { state: 'closed', checkedAt: job.verified_at ?? job.scraped_at, via: target ? 'link' : 'feed' };
  else if (!target)
    posting =
      company.ats_provider === 'hackernews'
        ? { state: 'unknown', checkedAt: null, via: 'none' }
        : { state: 'live', checkedAt: job.scraped_at, via: 'feed' };
  else if (job.verified_at && Date.now() - Date.parse(job.verified_at) < VERIFY_TTL_MS)
    posting = { state: 'live', checkedAt: job.verified_at, via: 'link' };
  else if (req.nextUrl.searchParams.get('verify') === '1') {
    const state = await checkPosting(politeFetcher({ minIntervalMs: 0, timeoutMs: 8_000 }), target);
    await recordChecks(supabase, state === 'live' ? [id] : [], state === 'closed' ? [id] : []);
    posting = {
      state,
      checkedAt: state === 'unknown' ? (job.verified_at ?? null) : new Date().toISOString(),
      via: 'link',
    };
  } else posting = { state: 'unknown', checkedAt: job.verified_at ?? null, via: 'link' };

  const salary = { min: job.salary_min, max: job.salary_max, currency: job.salary_currency };
  if (company.ats_provider === 'greenhouse' && company.ats_identifier && salary.min == null && salary.max == null) {
    const pay = await greenhousePay(company.ats_identifier, job.external_id);
    if (pay) Object.assign(salary, pay);
  }

  return NextResponse.json({
    job: {
      id: job.id,
      title: job.title,
      company: job.employer || company.name,
      via: job.employer ? company.name : null,
      category: company.category,
      fundingStage: company.funding_stage ?? null,
      source: company.source ?? null,
      provider: company.ats_provider,
      providerName: company.ats_provider ? sourceName(company.ats_provider) : null,
      location: job.location,
      workType: job.work_type,
      department: job.department,
      experience: job.experience_required,
      salary,
      postedAt: job.posted_at,
      applyUrl: job.apply_url,
      // Older scrapes stored escaped HTML or one flattened line; this restores paragraphs and sections.
      description: formatDescription(job.description || ''),
    },
    match: match
      ? {
          score: match.score,
          matching: match.matching_skills || [],
          missing: match.missing_skills || [],
          status: match.status,
          reasoning: match.reasoning,
        }
      : null,
    posting,
    you: { experienceYears: me ? (me.is_fresher ? 0 : (me.experience_years ?? null)) : null },
  });
}
