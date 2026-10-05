import { describe, expect, it } from 'vitest';
import { cleanIndeedUrl, extractJobsFromHtml, extractJobsFromText, parseIndeedEmailContent } from './indeed-email';

describe('Indeed Email Ingestion', () => {
  describe('cleanIndeedUrl', () => {
    it('extracts canonical jk parameter and cleans tracking noise', () => {
      const dirty =
        'https://www.indeed.com/rc/clk?jk=72b7a976cfca9489&from=ja&qd=123&tk=xyz&utm_source=jobseeker_emails';
      const cleaned = cleanIndeedUrl(dirty);
      expect(cleaned.jk).toBe('72b7a976cfca9489');
      expect(cleaned.url).toBe('https://in.indeed.com/viewjob?jk=72b7a976cfca9489');
    });

    it('retains non-jk URLs while stripping utm parameters', () => {
      const dirty = 'https://in.indeed.com/viewjob?id=12345&utm_source=newsletter';
      const cleaned = cleanIndeedUrl(dirty);
      expect(cleaned.jk).toBeNull();
      expect(cleaned.url).not.toContain('utm_source');
    });
  });

  describe('extractJobsFromHtml', () => {
    it('parses multiple job cards from an Indeed Job Alert HTML email', () => {
      const html = `
        <html>
          <body>
            <div>
              <table>
                <tr>
                  <td>
                    <a href="https://www.indeed.com/rc/clk?jk=1111222233334444&from=ja">
                      <span>Python Full Stack Developer</span>
                    </a>
                    <span class="companyName">Antier Solutions</span>
                    <span class="location">Mohali, Punjab</span>
                    <div>Looking for 1-3 years experience in Python, FastAPI, and React. ₹6,00,000 - ₹12,00,000 a year</div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="https://www.indeed.com/rc/clk?jk=5555666677778888&from=ja">
                      <span>AI Engineer</span>
                    </a>
                    <span class="companyName">Fitelo</span>
                    <span class="location">Chandigarh</span>
                    <div>Work on LLM pipelines, RAG, and AI agents.</div>
                  </td>
                </tr>
              </table>
            </div>
          </body>
        </html>
      `;

      const jobs = extractJobsFromHtml(html, '2026-10-04T10:00:00Z');
      expect(jobs.length).toBe(2);

      const [j1, j2] = jobs;
      expect(j1.title).toBe('Python Full Stack Developer');
      expect(j1.employer).toBe('Antier Solutions');
      expect(j1.location).toBe('Mohali, Punjab');
      expect(j1.apply_url).toBe('https://in.indeed.com/viewjob?jk=1111222233334444');
      expect(j1.external_id).toBe('indeed:1111222233334444');
      expect(j1.salary_min).toBe(600000);
      expect(j1.salary_max).toBe(1200000);

      expect(j2.title).toBe('AI Engineer');
      expect(j2.employer).toBe('Fitelo');
      expect(j2.location).toBe('Chandigarh');
      expect(j2.apply_url).toBe('https://in.indeed.com/viewjob?jk=5555666677778888');
      expect(j2.external_id).toBe('indeed:5555666677778888');
    });

    it('skips non-engineering roles', () => {
      const html = `
        <div>
          <a href="https://www.indeed.com/rc/clk?jk=9999888877776666">
            <span>Sales Executive / Call Center</span>
          </a>
          <span class="companyName">BPO Corp</span>
          <span class="location">Mohali</span>
        </div>
      `;
      const jobs = extractJobsFromHtml(html);
      expect(jobs.length).toBe(0);
    });
  });

  describe('extractJobsFromText', () => {
    it('parses fallback plain text Indeed alert emails', () => {
      const text = `
Here are your new job recommendations for Mohali:

React Native Developer
SmartData - Mohali, Punjab
https://www.indeed.com/rc/clk?jk=aabbccddeeff0011&from=ja

AI Software Engineer
Relinns Technologies - Chandigarh
https://www.indeed.com/rc/clk?jk=1122334455667788&from=ja
      `;

      const jobs = extractJobsFromText(text, '2026-10-04T12:00:00Z');
      expect(jobs.length).toBe(2);

      expect(jobs[0].title).toBe('React Native Developer');
      expect(jobs[0].employer).toBe('SmartData');
      expect(jobs[0].location).toBe('Mohali, Punjab');
      expect(jobs[0].external_id).toBe('indeed:aabbccddeeff0011');

      expect(jobs[1].title).toBe('AI Software Engineer');
      expect(jobs[1].employer).toBe('Relinns Technologies');
      expect(jobs[1].location).toBe('Chandigarh');
      expect(jobs[1].external_id).toBe('indeed:1122334455667788');
    });
  });

  describe('parseIndeedEmailContent', () => {
    it('auto-detects HTML and parses accordingly', () => {
      const html = `
        <a href="https://in.indeed.com/viewjob?jk=1234567812345678">
          <h3>Backend Developer (Node.js/Go)</h3>
        </a>
        <span class="company">Zomato</span>
        <span class="location">Gurugram</span>
      `;
      const jobs = parseIndeedEmailContent(html);
      expect(jobs.length).toBe(1);
      expect(jobs[0].title).toBe('Backend Developer (Node.js/Go)');
      expect(jobs[0].employer).toBe('Zomato');
      expect(jobs[0].location).toBe('Gurugram');
    });
  });
});
