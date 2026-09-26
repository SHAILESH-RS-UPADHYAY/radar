import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch } from '@/test/mock-fetch';
import { scrapeAshby, scrapeCompany, scrapeGreenhouse, scrapeLever, scrapePersonio } from './adapters';

afterEach(() => vi.unstubAllGlobals());

describe('scrapeGreenhouse', () => {
  it('maps fields and decodes content', async () => {
    mockFetch({
      'boards-api.greenhouse.io/v1/boards/acme/jobs': {
        jobs: [
          {
            id: 42,
            title: 'Backend Engineer',
            absolute_url: 'https://boards.greenhouse.io/acme/jobs/42',
            location: { name: 'Bengaluru, India' },
            departments: [{ name: 'Engineering' }],
            content: '&lt;p&gt;Python &amp;amp; Postgres, 2+ years&lt;/p&gt;',
            updated_at: '2026-09-01T00:00:00Z',
          },
        ],
      },
    });
    const [job] = await scrapeGreenhouse('acme');
    expect(job).toMatchObject({
      external_id: '42',
      title: 'Backend Engineer',
      location: 'Bengaluru, India',
      department: 'Engineering',
      description: 'Python & Postgres, 2+ years',
      experience_required: '1-3',
      employer: null,
    });
    expect(job.skills).toEqual(expect.arrayContaining(['python', 'postgresql']));
  });
});

describe('scrapeLever', () => {
  it('uses the EU host for eu: slugs and maps workplace type', async () => {
    const fetch = mockFetch({
      'api.eu.lever.co/v0/postings/acme': [
        {
          id: 'abc',
          text: 'Frontend Developer',
          hostedUrl: 'https://jobs.eu.lever.co/acme/abc',
          categories: { location: 'Berlin', team: 'Web' },
          workplaceType: 'hybrid',
          descriptionPlain: 'React',
          createdAt: 1_700_000_000_000,
        },
      ],
    });
    const [job] = await scrapeLever('eu:acme');
    expect(String(fetch.mock.calls[0][0])).toContain('api.eu.lever.co');
    expect(job).toMatchObject({
      external_id: 'abc',
      work_type: 'hybrid',
      department: 'Web',
      posted_at: '2023-11-14T22:13:20.000Z',
    });
  });
});

describe('scrapeAshby', () => {
  it('drops unlisted jobs and parses compensation', async () => {
    mockFetch({
      'api.ashbyhq.com/posting-api/job-board/acme': {
        jobs: [
          {
            id: '1',
            title: 'ML Engineer',
            jobUrl: 'u1',
            location: 'Remote',
            isRemote: true,
            descriptionPlain: 'PyTorch',
            compensation: { compensationTierSummary: '$150K – $200K' },
          },
          { id: '2', title: 'Hidden Engineer', jobUrl: 'u2', isListed: false },
        ],
      },
    });
    const jobs = await scrapeAshby('acme');
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      work_type: 'remote',
      salary_min: 150000,
      salary_max: 200000,
      salary_currency: 'USD',
    });
  });
});

describe('scrapePersonio', () => {
  it('parses the XML feed', async () => {
    mockFetch({
      'acme.jobs.personio.de/xml': `<?xml version="1.0"?><workzag-jobs><position><id>7</id><name>Data Engineer</name><office>Munich</office>
        <department>Tech</department><jobDescriptions><jobDescription><name>Tasks</name><value><![CDATA[<p>Spark &amp; Airflow</p>]]></value></jobDescription></jobDescriptions>
        <createdAt>2026-08-01T10:00:00+00:00</createdAt></position></workzag-jobs>`,
    });
    const [job] = await scrapePersonio('acme');
    expect(job).toMatchObject({
      external_id: '7',
      title: 'Data Engineer',
      location: 'Munich',
      apply_url: 'https://acme.jobs.personio.de/job/7',
    });
    expect(job.skills).toEqual(expect.arrayContaining(['spark', 'airflow']));
  });
});

describe('scrapeCompany', () => {
  it('filters out non-tech titles and jobs missing required fields', async () => {
    mockFetch({
      'boards-api.greenhouse.io/v1/boards/acme/jobs': {
        jobs: [
          { id: 1, title: 'Software Engineer', absolute_url: 'u', location: { name: 'Pune' }, content: '' },
          { id: 2, title: 'Account Executive', absolute_url: 'u', location: { name: 'Pune' }, content: '' },
          { id: 3, title: 'Data Engineer', absolute_url: '', location: { name: 'Pune' }, content: '' },
        ],
      },
    });
    const jobs = await scrapeCompany('greenhouse', 'acme');
    expect(jobs.map((j) => j.title)).toEqual(['Software Engineer']);
  });

  it('rejects unknown providers and ignores custom', async () => {
    await expect(scrapeCompany('nope', 'x')).rejects.toThrow('No adapter');
    await expect(scrapeCompany(null, null)).resolves.toEqual([]);
  });
});
