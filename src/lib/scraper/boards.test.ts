import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch } from '@/test/mock-fetch';
import { searchCity, parseHasjobEntry, parseHnPost, parseWwrItem, scrapeBoard } from './boards';

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

  it('skip Jooble, JSearch and Google Jobs without calling out when their keys are missing', async () => {
    vi.stubEnv('JOOBLE_API_KEY', '');
    vi.stubEnv('RAPIDAPI_KEY', '');
    vi.stubEnv('JSEARCH_API_KEY', '');
    vi.stubEnv('SERPER_API_KEY', '');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const fetch = mockFetch({});
    expect(await scrapeBoard('jooble')).toEqual([]);
    expect(await scrapeBoard('jsearch')).toEqual([]);
    expect(await scrapeBoard('googlejobs')).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('maps 4 Day Week: one job per id across its searches, linked to its page there', async () => {
    const job = {
      id: 'a1',
      title: 'Backend Engineer',
      description: '## **About**\nGo and Postgres',
      url: 'https://4dayweek.io/job/a1',
      category: 'engineering',
      work_arrangement: 'remote',
      locations: [{ city: 'Pune', country: 'India' }],
      posted_at: '2026-11-01T00:00:00Z',
      company: { name: 'Acme' },
    };
    mockFetch({ '4dayweek.io/api/v2/jobs': { data: [job], has_more: false } });
    const jobs = await scrapeBoard('fourdayweek');
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      external_id: 'a1',
      location: 'Remote (Pune, India)',
      apply_url: 'https://4dayweek.io/job/a1',
      employer: 'Acme',
      work_type: 'remote',
    });
    expect(jobs[0].description).toBe('About\nGo and Postgres');
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

describe('parseWwrItem', () => {
  it('splits "Company: Role", keeps the region and turns the escaped HTML into text', () => {
    const item = parseWwrItem(
      '<item><title>Samsara: Staff Software Engineer: Platform</title><region>Anywhere in the World</region>' +
        '<description>&lt;p&gt;Build &lt;strong&gt;fleet&lt;/strong&gt; APIs&lt;/p&gt;</description>' +
        '<pubDate>Wed, 30 Sep 2026 10:00:00 +0000</pubDate><guid>https://weworkremotely.com/remote-jobs/samsara-1</guid>' +
        '<link>https://weworkremotely.com/remote-jobs/samsara-1</link></item>',
    );
    expect(item).toMatchObject({
      employer: 'Samsara',
      title: 'Staff Software Engineer: Platform',
      region: 'Anywhere in the World',
      description: 'Build fleet APIs',
      link: 'https://weworkremotely.com/remote-jobs/samsara-1',
    });
    expect(new Date(Date.parse(item.posted)).toISOString()).toBe('2026-09-30T10:00:00.000Z');
  });
});

describe('searchCity', () => {
  it('maps Gurugram to Gurgaon for job search geography', () => {
    expect(searchCity('Gurugram')).toBe('Gurgaon');
    expect(searchCity('gurugram')).toBe('Gurgaon');
    expect(searchCity('gurgaon')).toBe('Gurgaon');
  });

  it('maps Bengaluru to Bangalore', () => {
    expect(searchCity('Bengaluru')).toBe('Bangalore');
    expect(searchCity('banglore')).toBe('Bangalore');
  });

  it('maps SAS Nagar to Mohali', () => {
    expect(searchCity('SAS Nagar')).toBe('Mohali');
  });

  it('keeps other cities intact', () => {
    expect(searchCity('Mohali')).toBe('Mohali');
    expect(searchCity('Chandigarh')).toBe('Chandigarh');
    expect(searchCity('Noida')).toBe('Noida');
  });
});

describe('parseHasjobEntry', () => {
  it('parses Atom XML entry with title, company, location and application link', () => {
    const entry = `<entry>
      <title type="text">Senior Python Developer</title>
      <id>https://hasjob.co/acme.ai/xyz123</id>
      <link href="https://hasjob.co/acme.ai/xyz123"/>
      <published>2026-10-04T10:00:00Z</published>
      <location>Mohali, Punjab</location>
      <content type="html">&lt;p&gt;&lt;strong&gt;&lt;a href="https://acme.ai"&gt;Acme AI Labs&lt;/a&gt;&lt;/strong&gt;&lt;/p&gt;&lt;p&gt;Build LLM agent systems with FastAPI.&lt;/p&gt;</content>
    </entry>`;
    const parsed = parseHasjobEntry(entry);
    expect(parsed).toMatchObject({
      title: 'Senior Python Developer',
      employer: 'Acme AI Labs',
      location: 'Mohali, Punjab',
      link: 'https://hasjob.co/acme.ai/xyz123',
    });
    expect(parsed.description).toContain('Build LLM agent systems with FastAPI.');
  });
});
