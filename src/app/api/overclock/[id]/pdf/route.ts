import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { isSchemaMissing } from '@/lib/supabase/errors';
import { isUuid } from '@/lib/validate';
import { MIGRATION_HINT, pdfFileName, toView } from '@/lib/overclock';
import { renderResumePdf } from '@/lib/resume-pdf';

export const dynamic = 'force-dynamic';

// GET — the tailored resume as a PDF download, rendered on demand from the stored version.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await createServerClient()
    .from('tailored_resumes')
    .select('id, job_id, content, base_score, projected_score, model, created_at, jobs(employer, companies(name))')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (isSchemaMissing(error)) return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const view = toView(data);
  const job = (Array.isArray(data.jobs) ? data.jobs[0] : data.jobs) as {
    employer: string | null;
    companies: { name: string } | { name: string }[] | null;
  } | null;
  const company =
    job?.employer || (Array.isArray(job?.companies) ? job?.companies[0]?.name : job?.companies?.name) || '';
  const bytes = await renderResumePdf(view.resume);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${pdfFileName(view.resume.name, company)}"`,
      'cache-control': 'private, no-store',
    },
  });
}
