import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch } from '@/test/mock-fetch';
import { parseHnPost, scrapeBoard } from './boards';

describe('parseHnPost', () => {
  it('parses the standard "Company | Role | Location | Salary | url" header', () => {
    const html =
      'Modash.io | Senior Product Engineer | Remote (Europe) | Full-time | €75k–110k | <a href="https:&#x2F;&#x2F;modash.io&#x2F;careers">https://modash.io</a><p>We help brands…';
    expect(parseHnPost(html)).toEqual({
      employer: 'Modash.io',
      title: 'Senior Product Engineer',
      location: 'Remote (Europe)',
      salary: '€75k–110k',
      url: 'https://modash.io/careers',
    });
  });

  it('picks the segment that looks like a role, not just the second one', () => {
    const r = parseHnPost('Acme | Berlin, Germany | Backend Engineer | ONSITE<p>…');
    expect(r?.title).toBe('Backend Engineer');
    expect(r?.location).toBe('Berlin, Germany');
  });

  it('rejects posts without a pipe-separated header', () => {
    expect(parseHnPost('Just a comment about hiring<p>more')).toBeNull();
  });
});

describe('keyed job APIs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('skip Adzuna and Jooble without calling out when their keys are missing', async () => {
    vi.stubEnv('ADZUNA_APP_ID', '');
    vi.stubEnv('JOOBLE_API_KEY', '');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetch = mockFetch({});
    expect(await scrapeBoard('adzuna')).toEqual([]);
    expect(await scrapeBoard('jooble')).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('maps Adzuna: country-scoped ids, clean titles, stated salaries only', async () => {
    vi.stubEnv('ADZUNA_APP_ID', 'id');
    vi.stubEnv('ADZUNA_APP_KEY', 'key');
    vi.stubEnv('RADAR_ADZUNA_COUNTRIES', 'gb');
    vi.stubEnv('RADAR_SEARCH_TERMS', 'engineer');
    mockFetch({
      'api.adzuna.com/v1/api/jobs/gb/search/1': {
        results: [
          {
            id: '101',
            title: '<strong>Backend</strong> Engineer',
            description: 'Python and Postgres',
            redirect_url: 'https://www.adzuna.co.uk/jobs/land/ad/101',
            company: { display_name: 'Acme' },
            location: { display_name: 'London, UK' },
            created: '2026-09-20T10:00:00Z',
            salary_min: 60000,
            salary_max: 80000,
            salary_is_predicted: '0',
          },
          {
            id: '102',
            title: 'Data Engineer',
            description: 'Spark',
            redirect_url: 'https://www.adzuna.co.uk/jobs/land/ad/102',
            company: { display_name: 'Beta' },
            location: { display_name: 'Leeds' },
            salary_min: 50000,
            salary_is_predicted: '1',
          },
        ],
      },
    });
    const [stated, predicted] = await scrapeBoard('adzuna');
    expect(stated).toMatchObject({
      external_id: 'gb:101',
      title: 'Backend Engineer',
      employer: 'Acme',
      location: 'London, UK',
      salary_min: 60000,
      salary_max: 80000,
      salary_currency: 'GBP',
    });
    expect(stated.skills).toEqual(expect.arrayContaining(['python', 'postgresql']));
    expect(predicted).toMatchObject({ external_id: 'gb:102', salary_min: null, salary_currency: null });
  });

  it('maps Jobicy to remote jobs that link to the canonical Jobicy URL', async () => {
    vi.stubEnv('RADAR_JOBICY_INDUSTRIES', 'engineering');
    mockFetch({
      'jobicy.com/api/v2/remote-jobs': {
        jobs: [
          {
            id: 7,
            url: 'https://jobicy.com/jobs/7-ml-engineer',
            jobTitle: 'ML Engineer',
            companyName: 'Acme',
            jobGeo: 'EMEA,  APAC',
            jobDescription: '<p>PyTorch</p>',
            pubDate: '2026-09-25T00:00:00+00:00',
          },
        ],
      },
    });
    const [job] = await scrapeBoard('jobicy');
    expect(job).toMatchObject({
      external_id: '7',
      apply_url: 'https://jobicy.com/jobs/7-ml-engineer',
      location: 'Remote (EMEA, APAC)',
      work_type: 'remote',
      employer: 'Acme',
    });
  });
});
