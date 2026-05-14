// ============================
// RADAR ï¿½ Dashboard Data API
// ============================
// GET /api/dashboard ï¿½ Returns matched jobs for the authenticated user

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerClient();

  // Get match scores with job and company details
  const { data: matches, error } = await supabase
    .from('match_scores')
    .select(
      id, score, reasoning, matching_skills, missing_skills, section,
      jobs!inner (
        id, title, location, work_type, skills, apply_url, department,
        salary_min, salary_max,
        companies!inner ( name, category )
      )
    )
      )
    )
    .eq('user_id', userId)
    .order('score', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[DASHBOARD] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform for frontend
  const formatted = (matches || []).map((m: any) => ({
    id: m.id,
    score: m.score,
    reasoning: m.reasoning,
    matching_skills: m.matching_skills || [],
    missing_skills: m.missing_skills || [],
    section: m.section,
    job: {
      id: m.jobs.id,
      title: m.jobs.title,
      location: m.jobs.location,
      work_type: m.jobs.work_type,
      skills: m.jobs.skills || [],
      apply_url: m.jobs.apply_url,
      department: m.jobs.department,
      salary_min: m.jobs.salary_min,
      salary_max: m.jobs.salary_max,
      company: {
        name: m.jobs.companies.name,
        category: m.jobs.companies.category,
      },
    },
  }));

  return NextResponse.json({ matches: formatted, total: formatted.length });
}