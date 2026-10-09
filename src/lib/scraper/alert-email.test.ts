import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ALERT_SOURCES, parseAlertEmail, unwrapLink } from './alert-email';

const DATE = '2026-10-09T06:30:00.000Z';
const mail = (html: string, text = '') => ({ html, text, date: DATE });

describe('alert links', () => {
  it('turns each source’s job link into a stable id and a clean public URL', () => {
    const job = (provider: keyof typeof ALERT_SOURCES, href: string) => ALERT_SOURCES[provider].job(new URL(href));
    expect(job('indeed_email', 'https://www.indeed.com/rc/clk?jk=72B7A976CFCA9489&from=ja&tk=x')).toEqual({
      id: 'indeed:72b7a976cfca9489',
      url: 'https://in.indeed.com/viewjob?jk=72b7a976cfca9489',
    });
    expect(job('indeed_email', 'https://uk.indeed.com/viewjob?jk=72b7a976cfca9489')?.url).toBe(
      'https://uk.indeed.com/viewjob?jk=72b7a976cfca9489',
    );
    expect(
      job('linkedin_email', 'https://www.linkedin.com/comm/jobs/view/4012345678/?trackingId=a&otpToken=SECRET'),
    ).toEqual({ id: 'linkedin:4012345678', url: 'https://www.linkedin.com/jobs/view/4012345678/' });
    expect(job('linkedin_email', 'https://www.linkedin.com/jobs/view/backend-engineer-at-acme-4012345678')?.id).toBe(
      'linkedin:4012345678',
    );
    expect(job('linkedin_email', 'https://www.linkedin.com/comm/jobs/search?keywords=engineer')).toBeNull();
    expect(
      job('wttj_email', 'https://www.welcometothejungle.com/fr/companies/qonto/jobs/backend-engineer-go_paris?o=1'),
    ).toEqual({
      id: 'wttj:qonto/backend-engineer-go_paris',
      url: 'https://www.welcometothejungle.com/en/companies/qonto/jobs/backend-engineer-go_paris',
      company: 'Qonto',
    });
  });

  it('unwraps redirect parameters and packed tokens without opening them', () => {
    const target = 'https://www.welcometothejungle.com/en/companies/qonto/jobs/sre_paris';
    const redirect = 'https://click.mail.example/track?u=' + encodeURIComponent(target);
    expect(unwrapLink(redirect).map(String)).toContain(target);
    const gz = gzipSync('{"jk":"0123456789abcdef","src":"jobalert"}').toString('base64url');
    expect(unwrapLink('https://cts.indeed.com/v3/' + gz).map(String)).toContain(
      'https://in.indeed.com/viewjob?jk=0123456789abcdef',
    );
    expect(unwrapLink('not a url')).toEqual([]);
  });
});

describe('Indeed alerts', () => {
  it('reads cards from the HTML: title, company, place, pay', () => {
    const html = `
      <table>
        <tr><td>
          <a href="https://www.indeed.com/rc/clk?jk=1111222233334444&amp;from=ja"><span>Python Full Stack Developer</span></a>
          <span class="companyName">Antier Solutions</span>
          <span class="location">Mohali, Punjab</span>
          <div>Looking for 1-3 years experience in Python, FastAPI, and React. ₹6,00,000 - ₹12,00,000 a year</div>
        </td></tr>
        <tr><td>
          <a href="https://www.indeed.com/rc/clk?jk=5555666677778888&from=ja"><span>AI Engineer</span></a>
          <span>Fitelo</span><span>Chandigarh</span>
          <div>Work on LLM pipelines, RAG, and AI agents.</div>
        </td></tr>
      </table>`;
    const [a, b, ...rest] = parseAlertEmail('indeed_email', mail(html));
    expect(rest).toHaveLength(0);
    expect(a).toMatchObject({
      external_id: 'indeed:1111222233334444',
      title: 'Python Full Stack Developer',
      employer: 'Antier Solutions',
      location: 'Mohali, Punjab',
      apply_url: 'https://in.indeed.com/viewjob?jk=1111222233334444',
      salary_min: 600000,
      salary_max: 1200000,
      salary_currency: 'INR',
      posted_at: DATE,
    });
    expect(b).toMatchObject({ title: 'AI Engineer', employer: 'Fitelo', location: 'Chandigarh' });
  });

  it('reads the plain-text part and skips roles RADAR does not look for', () => {
    const text = `Here are your new job recommendations for Mohali:

React Native Developer
SmartData - Mohali, Punjab
https://www.indeed.com/rc/clk?jk=aabbccddeeff0011&from=ja

Sales Executive / Call Center
BPO Corp - Mohali
https://www.indeed.com/rc/clk?jk=9999888877776666

AI Software Engineer
Relinns Technologies - Chandigarh
https://www.indeed.com/rc/clk?jk=1122334455667788&from=ja`;
    const jobs = parseAlertEmail('indeed_email', mail('', text));
    expect(jobs.map((j) => [j.title, j.employer, j.location])).toEqual([
      ['React Native Developer', 'SmartData', 'Mohali, Punjab'],
      ['AI Software Engineer', 'Relinns Technologies', 'Chandigarh'],
    ]);
  });
});

describe('LinkedIn alerts', () => {
  const view = (id: string, n: number) =>
    `https://www.linkedin.com/comm/jobs/view/${id}/?trackingId=abc%3D%3D&amp;refId=x&amp;trk=eml-email_job_alert_digest_01-job_card-${n}-view_job&amp;otpToken=SECRET`;
  const html = `
    <table role="presentation">
      <tr><td><a href="${view('4012345678', 0)}"><img alt="Cohere" src="https://media.licdn.com/x.png"></a></td>
          <td><a href="${view('4012345678', 0)}" style="color:#0a66c2">Forward Deployed Engineer</a>
              <p>Cohere · Toronto, ON (Hybrid)</p>
              <p>CA$140K-CA$190K / year</p>
              <p>Actively recruiting</p><p>Easy Apply</p></td></tr>
      <tr><td><a href="${view('4099999999', 1)}"><img alt="Stripe"></a></td>
          <td><a href="${view('4099999999', 1)}">Backend Engineer, Payments</a>
              <p>Stripe</p><p>Bengaluru, Karnataka, India</p><p>3 connections</p></td></tr>
    </table>
    <a href="https://www.linkedin.com/comm/jobs/search?keywords=engineer">See all jobs</a>
    <p>You are receiving Job Alert emails.</p>`;

  it('reads every card from the HTML, with no tracking or login token left in the link', () => {
    const jobs = parseAlertEmail('linkedin_email', mail(html));
    expect(jobs.map((j) => [j.external_id, j.title, j.employer, j.location])).toEqual([
      ['linkedin:4012345678', 'Forward Deployed Engineer', 'Cohere', 'Toronto, ON (Hybrid)'],
      ['linkedin:4099999999', 'Backend Engineer, Payments', 'Stripe', 'Bengaluru, Karnataka, India'],
    ]);
    expect(jobs.every((j) => !j.apply_url.includes('?'))).toBe(true);
    expect(jobs[0].description).toContain('LinkedIn job alert');
  });

  it('reads the plain-text "View job:" layout, and merges it with the HTML by job id', () => {
    const text = `Your job alert for engineer

Forward Deployed Engineer
Cohere
Toronto, ON (Hybrid)
View job: https://www.linkedin.com/comm/jobs/view/4012345678/?trackingId=abc

---------------------------------------------------------

Platform Engineer
Razorpay
Bengaluru
View job: https://www.linkedin.com/comm/jobs/view/4055555555/?trackingId=def`;
    const jobs = parseAlertEmail('linkedin_email', mail(html, text));
    expect(jobs.map((j) => j.external_id)).toEqual([
      'linkedin:4012345678',
      'linkedin:4099999999',
      'linkedin:4055555555',
    ]);
    expect(jobs[2]).toMatchObject({ title: 'Platform Engineer', employer: 'Razorpay', location: 'Bengaluru' });
  });
});

describe('Welcome to the Jungle alerts', () => {
  it('reads cards, and takes the company from the link when the card does not name it', () => {
    const html = `
      <a href="https://www.welcometothejungle.com/en/companies/qonto/jobs/backend-engineer-go_paris?utm_source=alert">
        <strong>Backend Engineer - Go</strong></a>
      <div>Paris</div>
      <a href="https://www.welcometothejungle.com/en/companies/doctolib/jobs/sre_berlin?utm_source=alert">Site Reliability Engineer</a>
      <div>Doctolib</div><div>Berlin, Germany</div>`;
    const jobs = parseAlertEmail('wttj_email', mail(html));
    expect(jobs.map((j) => [j.title, j.employer, j.location])).toEqual([
      ['Backend Engineer - Go', 'Qonto', 'Paris'],
      ['Site Reliability Engineer', 'Doctolib', 'Berlin, Germany'],
    ]);
  });
});
