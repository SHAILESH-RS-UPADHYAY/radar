import { describe, expect, it } from 'vitest';
import { employerFromPage } from './adopt';

describe('employerFromPage', () => {
  const at = (u: string, site = '', title = '') => employerFromPage(new URL(u), site, title);
  it('reads the employer from ATS paths, Workday hosts, site names and careers domains', () => {
    expect(at('https://jobs.lever.co/cohere/123')).toBe('Cohere');
    expect(at('https://job-boards.greenhouse.io/scale-ai/jobs/1')).toBe('Scale Ai');
    expect(at('https://www.welcometothejungle.com/en/companies/qonto/jobs/backend')).toBe('Qonto');
    expect(at('https://acme.wd5.myworkdayjobs.com/en-US/careers/job/1')).toBe('Acme');
    expect(at('https://example.com/x', 'Cohere')).toBe('Cohere');
    expect(at('https://careers.cohere.com/jobs/fde')).toBe('Cohere');
    expect(at('https://x.io/apply', '', 'Forward Deployed Engineer | Careers at Cohere')).toBe('Cohere');
  });
});
