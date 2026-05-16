/* eslint-disable @typescript-eslint/no-explicit-any */
 
 
 
 
 
 

// ============================
// RADAR — ATS Scraper Adapters
// ============================
// Greenhouse, Lever, Ashby — all have FREE public JSON APIs
// No authentication required. Structured data. Highly reliable.

export interface ScrapedJob {
  external_id: string;
  title: string;
  description: string;
  location: string;
  apply_url: string;
  department: string | null;
  work_type: 'remote' | 'hybrid' | 'in-office' | null;
  salary_min: number | null;
  salary_max: number | null;
  experience_required: string | null;
  skills: string[];
}

// ============================
// GREENHOUSE ADAPTER
// Endpoint: https://api.greenhouse.io/v1/boards/{token}/jobs?content=true
// No auth. Returns clean JSON with job details.
// ============================
export async function scrapeGreenhouse(boardToken: string): Promise<ScrapedJob[]> {
  try {
    const url = 'https://api.greenhouse.io/v1/boards/' + boardToken + '/jobs?content=true';
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error('Greenhouse API error: ' + res.status);
    const data = await res.json();

    return (data.jobs || []).map((job: any) => ({
      external_id: String(job.id),
      title: job.title || '',
      description: stripHtml(job.content || ''),
      location: job.location?.name || 'Not specified',
      apply_url: job.absolute_url || '',
      department: job.departments?.[0]?.name || null,
      work_type: inferWorkType(job.location?.name || ''),
      salary_min: null,
      salary_max: null,
      experience_required: inferExperience(job.title + ' ' + (job.content || '')),
      skills: extractSkills(job.content || ''),
    }));
  } catch (error) {
    console.error('[GREENHOUSE] Error scraping ' + boardToken + ':', error);
    return [];
  }
}

// ============================
// LEVER ADAPTER
// Endpoint: https://api.lever.co/v0/postings/{company}
// No auth. Returns JSON array of postings.
// ============================
export async function scrapeLever(companySlug: string): Promise<ScrapedJob[]> {
  try {
    const url = 'https://api.lever.co/v0/postings/' + companySlug;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error('Lever API error: ' + res.status);
    const data = await res.json();

    return (data || []).map((job: any) => ({
      external_id: job.id || '',
      title: job.text || '',
      description: stripHtml(job.descriptionPlain || job.description || ''),
      location: job.categories?.location || 'Not specified',
      apply_url: job.hostedUrl || job.applyUrl || '',
      department: job.categories?.department || job.categories?.team || null,
      work_type: inferWorkType((job.categories?.location || '') + ' ' + (job.workplaceType || '')),
      salary_min: parseSalary(job.salaryRange?.min),
      salary_max: parseSalary(job.salaryRange?.max),
      experience_required: inferExperience(job.text + ' ' + (job.descriptionPlain || '')),
      skills: extractSkills(job.descriptionPlain || job.description || ''),
    }));
  } catch (error) {
    console.error('[LEVER] Error scraping ' + companySlug + ':', error);
    return [];
  }
}

// ============================
// ASHBY ADAPTER
// Endpoint: https://api.ashbyhq.com/posting-api/job-board/{client}
// No auth. Returns JSON with jobs array. Supports compensation data.
// ============================
export async function scrapeAshby(clientName: string): Promise<ScrapedJob[]> {
  try {
    const url = 'https://api.ashbyhq.com/posting-api/job-board/' + clientName + '?includeCompensation=true';
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error('Ashby API error: ' + res.status);
    const data = await res.json();

    return (data.jobs || []).map((job: any) => ({
      external_id: job.id || '',
      title: job.title || '',
      description: stripHtml(job.descriptionHtml || job.descriptionPlain || ''),
      location: job.location || 'Not specified',
      apply_url: job.jobUrl || '',
      department: job.departmentName || null,
      work_type: inferWorkType((job.location || '') + ' ' + (job.isRemote ? 'remote' : '')),
      salary_min: job.compensation?.compensationTierSummary ? parseSalaryFromText(job.compensation.compensationTierSummary) : null,
      salary_max: null,
      experience_required: inferExperience(job.title + ' ' + (job.descriptionPlain || '')),
      skills: extractSkills(job.descriptionHtml || job.descriptionPlain || ''),
    }));
  } catch (error) {
    console.error('[ASHBY] Error scraping ' + clientName + ':', error);
    return [];
  }
}

// ============================
// SCRAPE DISPATCHER
// Routes to the correct adapter based on ATS provider
// ============================
export async function scrapeCompany(
  atsProvider: string | null,
  atsIdentifier: string | null,
): Promise<ScrapedJob[]> {
  if (!atsProvider || !atsIdentifier) return [];

  switch (atsProvider) {
    case 'greenhouse':
      return scrapeGreenhouse(atsIdentifier);
    case 'lever':
      return scrapeLever(atsIdentifier);
    case 'ashby':
      return scrapeAshby(atsIdentifier);
    default:
      console.log('[SCRAPER] No adapter for provider: ' + atsProvider);
      return [];
  }
}

// ============================
// HELPER FUNCTIONS
// ============================

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function inferWorkType(text: string): 'remote' | 'hybrid' | 'in-office' | null {
  const lower = text.toLowerCase();
  if (lower.includes('remote')) return 'remote';
  if (lower.includes('hybrid')) return 'hybrid';
  if (lower.includes('on-site') || lower.includes('onsite') || lower.includes('office')) return 'in-office';
  return null;
}

function inferExperience(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('fresher') || lower.includes('entry level') || lower.includes('entry-level') || lower.includes('new grad') || lower.includes('0-1 year') || lower.includes('intern')) return 'fresher';
  if (lower.match(/1[\s-]+3\s*year/)) return '1-3';
  if (lower.match(/3[\s-]+5\s*year/)) return '3-5';
  if (lower.match(/5\+?\s*year/) || lower.includes('senior')) return '5+';
  if (lower.match(/0[\s-]+1\s*year/) || lower.includes('junior')) return '0-1';
  return null;
}

const TECH_SKILLS = [
  'python', 'javascript', 'typescript', 'react', 'next.js', 'node.js',
  'java', 'c++', 'go', 'rust', 'sql', 'postgresql', 'mongodb', 'redis',
  'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform',
  'machine learning', 'deep learning', 'nlp', 'computer vision',
  'git', 'ci/cd', 'rest api', 'graphql', 'microservices',
  'pandas', 'numpy', 'pytorch', 'tensorflow', 'fastapi', 'django', 'flask',
  'html', 'css', 'tailwind', 'figma', 'ui/ux',
  'agile', 'scrum', 'jira', 'data structures', 'algorithms',
];

function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  return TECH_SKILLS.filter(skill => lower.includes(skill));
}

function parseSalary(value: any): number | null {
  if (!value) return null;
  const num = typeof value === 'string' ? parseInt(value.replace(/[^0-9]/g, '')) : Number(value);
  return isNaN(num) ? null : num;
}

function parseSalaryFromText(text: string): number | null {
  const match = text.match(/[\d,]+/);
  return match ? parseInt(match[0].replace(/,/g, '')) : null;
}
