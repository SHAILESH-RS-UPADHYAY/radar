import { describe, expect, it } from 'vitest';
import { parseHnPost } from './boards';

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
