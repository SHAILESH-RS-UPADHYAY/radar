import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { cityAliases, knownCompaniesIn } from '@/lib/geo/city-companies';

export const dynamic = 'force-dynamic';

export interface CityCompany {
  name: string;
  tier: 'MNC' | 'Growth' | 'Startup' | 'Board';
  openJobs: number; // live open roles in the selected cities (0 = known office, nothing open right now)
  tracked: boolean; // RADAR scrapes this company's careers feed
  evidence: 'live' | 'known' | 'both';
}

// GET /api/companies?cities=Bangalore,Pune   or   ?remote=1
// Returns only companies actually present in those cities: live job evidence + curated office list.
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cities = (req.nextUrl.searchParams.get('cities') || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const remote = req.nextUrl.searchParams.get('remote') === '1';
  if (!cities.length && !remote) return NextResponse.json({ companies: [] });

  const supabase = createServerClient();
  const byName = new Map<string, CityCompany>();

  // 1. Live evidence from open jobs
  const patterns = cities.flatMap(cityAliases).map((a) => 'location.ilike.%' + a.replace(/[%,()]/g, '') + '%');
  if (remote) patterns.push('work_type.eq.remote');
  if (patterns.length) {
    const run = (cols: string) =>
      supabase.from('jobs').select(cols).eq('is_active', true).or(patterns.join(',')).limit(10000);
    let { data, error } = await run('employer, companies!inner(name, category, ats_provider)');
    // Before migration 003 there is no `employer` column; fall back to company names only.
    if (error) ({ data, error } = await run('companies!inner(name, category, ats_provider)'));
    if (error) console.error('[COMPANIES] live lookup failed:', error.message);
    for (const row of (data || []) as unknown as { employer?: string | null; companies: unknown }[]) {
      const company = (Array.isArray(row.companies) ? row.companies[0] : row.companies) as
        { name: string; category: string; ats_provider: string } | undefined;
      if (!company) continue;
      const name = row.employer || company.name;
      const existing = byName.get(name.toLowerCase());
      if (existing) existing.openJobs++;
      else
        byName.set(name.toLowerCase(), {
          name,
          tier: row.employer ? 'Startup' : (company.category as CityCompany['tier']),
          openJobs: 1,
          tracked: !row.employer,
          evidence: 'live',
        });
    }
  }

  // 2. Curated offices
  const { data: trackedRows } = await supabase
    .from('companies')
    .select('name, ats_provider')
    .neq('ats_provider', 'custom')
    .not('ats_provider', 'is', null);
  const trackedNames = new Set((trackedRows || []).map((r) => r.name.toLowerCase()));
  for (const k of knownCompaniesIn(cities)) {
    const existing = byName.get(k.name.toLowerCase());
    if (existing) {
      existing.evidence = 'both';
      existing.tier = k.tier;
    } else {
      byName.set(k.name.toLowerCase(), {
        name: k.name,
        tier: k.tier,
        openJobs: 0,
        tracked: trackedNames.has(k.name.toLowerCase()),
        evidence: 'known',
      });
    }
  }

  const companies = [...byName.values()].sort(
    (a, b) =>
      Number(b.evidence !== 'live') - Number(a.evidence !== 'live') ||
      b.openJobs - a.openJobs ||
      a.name.localeCompare(b.name),
  );
  return NextResponse.json({ companies });
}
