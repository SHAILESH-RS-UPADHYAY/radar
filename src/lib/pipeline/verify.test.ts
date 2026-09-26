import { describe, expect, it } from 'vitest';
import { classifyPosting, needsLinkCheck } from './verify';

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

  it('only link-checks board jobs, not ATS feeds or Hacker News threads', () => {
    expect(needsLinkCheck('remotive')).toBe(true);
    expect(needsLinkCheck('adzuna')).toBe(true);
    expect(needsLinkCheck('greenhouse')).toBe(false);
    expect(needsLinkCheck('hackernews')).toBe(false);
    expect(needsLinkCheck(null)).toBe(false);
  });
});
