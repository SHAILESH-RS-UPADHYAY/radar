// ============================
// RADAR --- Scrape API Route
// ============================
// POST /api/scrape --- Scrapes all active companies with ATS adapters
// Upserts jobs into Supabase, logs results to scrape_logs

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { scrapeCompany } from '@/lib/scraper/adapters';
import { upsertJobVectors } from '@/lib/ai/embeddings';

export const maxDuration = 300; // 5 min timeout for Vercel
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Protect with secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== 'Bearer ' + cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const results: any[] = [];

  // Get all scrapable companies
  const { data: companies, error: compErr } = await supabase
    .from('companies')
    .select('id, name, ats_provider, ats_identifier')
    .eq('is_active', true)
    .not('ats_provider', 'eq', 'custom')
    .not('ats_identifier', 'is', null);

  if (compErr || !companies) {
    return NextResponse.json({ error: 'Failed to fetch companies', details: compErr }, { status: 500 });
  }

  console.log('[SCRAPE] Starting scrape for', companies.length, 'companies');

  for (const company of companies) {
    const startTime = Date.now();
    try {
      const jobs = await scrapeCompany(company.ats_provider, company.ats_identifier);
      const duration = Date.now() - startTime;

      if (jobs.length > 0) {
        // Upsert jobs --- ON CONFLICT (company_id, external_id) UPDATE
        const jobRows = jobs.map(j => ({
          company_id: company.id,
          external_id: j.external_id,
          title: j.title,
          description: j.description?.substring(0, 10000) || null,
          location: j.location,
          work_type: j.work_type,
          salary_min: j.salary_min,
          salary_max: j.salary_max,
          experience_required: j.experience_required,
          skills: j.skills,
          apply_url: j.apply_url,
          department: j.department,
          is_active: true,
          scraped_at: new Date().toISOString(),
        }));

        const { data: upsertedJobs, error: upsertErr } = await supabase
          .from('jobs')
          .upsert(jobRows, { onConflict: 'company_id,external_id', ignoreDuplicates: false })
          .select('id, title, description, location, skills, companies(name)');

        if (upsertErr) {
          console.error('[SCRAPE]', company.name, 'upsert error:', upsertErr.message);
        } else if (upsertedJobs && upsertedJobs.length > 0) {
          // Sync to Pinecone!
          const vectorsFormat = upsertedJobs.map(j => ({
            id: j.id,
            title: j.title,
            description: j.description,
            company_name: Array.isArray(j.companies) ? j.companies[0]?.name : (j.companies as any)?.name || company.name,
            skills: j.skills || [],
            location: j.location
          }));
          
          try {
            await upsertJobVectors(vectorsFormat);
            console.log('[SCRAPE]', company.name, 'synced', vectorsFormat.length, 'vectors to Pinecone');
          } catch (vecErr: any) {
            console.error('[SCRAPE]', company.name, 'Pinecone sync error:', vecErr.message);
          }
        }
      }

      // Log success
      await supabase.from('scrape_logs').insert({
        company_id: company.id,
        status: jobs.length > 0 ? 'success' : 'partial',
        jobs_found: jobs.length,
        duration_ms: duration,
      });

      // Update last_scraped_at
      await supabase.from('companies').update({ last_scraped_at: new Date().toISOString() }).eq('id', company.id);

      results.push({ company: company.name, jobs: jobs.length, duration, status: 'success' });
      console.log('[SCRAPE]', company.name, '?', jobs.length, 'jobs in', duration, 'ms');
    } catch (err: any) {
      const duration = Date.now() - startTime;
      await supabase.from('scrape_logs').insert({
        company_id: company.id,
        status: 'failed',
        jobs_found: 0,
        error_message: err.message,
        duration_ms: duration,
      });
      results.push({ company: company.name, jobs: 0, duration, status: 'failed', error: err.message });
      console.error('[SCRAPE]', company.name, 'FAILED:', err.message);
    }
  }

  const totalJobs = results.reduce((sum, r) => sum + r.jobs, 0);
  const succeeded = results.filter(r => r.status === 'success').length;

  return NextResponse.json({
    message: 'Scraped ' + succeeded + '/' + companies.length + ' companies, found ' + totalJobs + ' jobs',
    totalCompanies: companies.length,
    succeeded,
    totalJobs,
    results,
  });
}
