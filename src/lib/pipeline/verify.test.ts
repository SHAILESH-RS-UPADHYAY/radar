import { describe, expect, it } from 'vitest';
import { checkUrl, classifyPosting, needsLinkCheck } from './verify';

const page = (title: string, body: string) => `<html><head><title>${title}</title></head><body>${body}</body></html>`;

describe('classifyPosting', () => {
  it('reads clear closed signals', () => {
    expect(classifyPosting(404, '')).toBe('closed');
    expect(classifyPosting(410, '')).toBe('closed');
    expect(classifyPosting(200, page('Backend Engineer', '<h1>This job is no longer available</h1>'))).toBe('closed');
    expect(classifyPosting(200, page('Job', '<p>This position has been filled.</p>'))).toBe('closed');
    expect(classifyPosting(200, page('Job', '<p>We are no longer accepting applications for this role.</p>'))).toBe(
      'closed',
    );
    expect(classifyPosting(200, page('Page not found', '<p>Oops</p>'))).toBe('closed');
    expect(
      classifyPosting(
        200,
        page('Acme', ''),
        'https://boards.greenhouse.io/acme/jobs/1',
        'https://boards.greenhouse.io/acme?error=true',
      ),
    ).toBe('closed');
    expect(
      classifyPosting(
        200,
        page('Remote jobs', ''),
        'https://remoteok.com/remote-jobs/123-dev',
        'https://remoteok.com/',
      ),
    ).toBe('closed');
  });

  it('keeps open jobs live and uncertain answers unknown', () => {
    expect(
      classifyPosting(200, page('Backend Engineer at Acme', '<h1>Backend Engineer</h1><button>Apply</button>')),
    ).toBe('live');
    // Words inside scripts are not what the visitor sees.
    expect(
      classifyPosting(200, page('Job', '<script>const t = "This job is no longer available"</script><p>Apply</p>')),
    ).toBe('live');
    expect(classifyPosting(403, '')).toBe('unknown');
    expect(classifyPosting(500, '')).toBe('unknown');
    expect(classifyPosting(429, '')).toBe('unknown');
  });

  it('opens board pages it may open, never ATS feeds, search APIs, LinkedIn, Indeed or Hacker News', () => {
    const job = { apply_url: 'https://board.example/job/1' };
    expect(needsLinkCheck(job, 'remotive')).toBe(true);
    expect(needsLinkCheck(job, 'wttj_email')).toBe(true);
    for (const provider of ['greenhouse', 'adzuna', 'jooble', 'linkedin_email', 'indeed_email', 'hackernews', null])
      expect(needsLinkCheck(job, provider)).toBe(false);
  });

  it('checks the employer page a board link led to, once RADAR knows it', () => {
    const job = { apply_url: 'https://www.adzuna.in/details/1', resolved_url: 'https://jobs.lever.co/acme/123' };
    expect(checkUrl(job, 'adzuna')).toBe('https://jobs.lever.co/acme/123');
    expect(checkUrl({ apply_url: 'https://remotive.com/x' }, 'remotive')).toBe('https://remotive.com/x');
    expect(checkUrl({ apply_url: 'https://www.adzuna.in/details/1' }, 'adzuna')).toBeNull();
    // A board that led to LinkedIn or Naukri: still never opened.
    const walled = { apply_url: 'https://www.adzuna.in/details/2', resolved_url: 'https://www.naukri.com/job/1' };
    expect(checkUrl(walled, 'adzuna')).toBeNull();
  });
});
