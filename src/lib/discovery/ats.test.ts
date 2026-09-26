import { describe, expect, it } from 'vitest';
import {
  atsFromUrl,
  boardUrl,
  detectAts,
  extractLinks,
  greenhouseJobId,
  slugCandidates,
  teamtailorJobHost,
} from './ats';

describe('atsFromUrl', () => {
  it('reads the board from job links StartupMap and careers pages use', () => {
    const cases: [string, string | null][] = [
      ['https://jobs.ashbyhq.com/Abound/27c3af73?utm_source=startupmap&amp;utm_medium=referral', 'ashby:abound'],
      ['https://job-boards.eu.greenhouse.io/speechmatics/jobs/4987568101', 'greenhouse:speechmatics'],
      ['https://boards.greenhouse.io/embed/job_board/js?for=acme', 'greenhouse:acme'],
      ['https://jobs.lever.co/moneyboxapp/3644e369', 'lever:moneyboxapp'],
      ['https://jobs.eu.lever.co/Qonto/abc', 'lever:eu:qonto'],
      ['https://apply.workable.com/goodfit/j/39FCDFAF02/', 'workable:goodfit'],
      ['https://jobs.smartrecruiters.com/ServiceNow/7443', 'smartrecruiters:ServiceNow'],
      ['https://bunq.recruitee.com/o/backend', 'recruitee:bunq'],
      ['https://acme.jobs.personio.de/job/123', 'personio:acme'],
      ['https://chip.teamtailor.com/jobs/8429681-senior-data-analyst', 'teamtailor:chip.teamtailor.com'],
      [
        'https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/x',
        'workday:nvidia/wd5/NVIDIAExternalCareerSite',
      ],
      ['https://www.linkedin.com/company/pleo', null],
      ['https://helsing.ai/jobs/4982899101?gh_jid=4982899101', null],
      ['not a url', null],
    ];
    for (const [url, want] of cases) {
      const ref = atsFromUrl(url);
      expect(ref ? ref.provider + ':' + ref.identifier : null, url).toBe(want);
    }
  });

  it('ignores reserved subdomains', () => {
    expect(atsFromUrl('https://www.recruitee.com/')).toBeNull();
    expect(atsFromUrl('https://app.breezy.hr/signin')).toBeNull();
    expect(atsFromUrl('https://www.teamtailor.com/en/')).toBeNull();
  });
});

describe('detectAts', () => {
  it('takes the board most links point at', () => {
    const ref = detectAts([
      'https://jobs.ashbyhq.com/pleo/1',
      'https://jobs.ashbyhq.com/pleo/2',
      'https://jobs.lever.co/partner/9',
      'https://www.pleo.io',
    ]);
    expect(ref).toEqual({ provider: 'ashby', identifier: 'pleo' });
    expect(detectAts(['https://example.com'])).toBeNull();
  });
});

describe('custom-domain boards', () => {
  it('spots Greenhouse embeds and Teamtailor career sites', () => {
    expect(greenhouseJobId('https://careers.nothing.tech/?gh_jid=4954543101&amp;utm_source=x')).toBe('4954543101');
    expect(greenhouseJobId('https://careers.nothing.tech/')).toBeNull();
    expect(teamtailorJobHost('https://careers.neat.no/jobs/8452054-senior-ux-designer-web?utm_source=x')).toBe(
      'careers.neat.no',
    );
    expect(teamtailorJobHost('https://acme.com/jobs/backend-engineer')).toBeNull();
  });

  it('guesses board tokens from the domain and the name', () => {
    expect(slugCandidates('Helsing', 'https://helsing.ai')).toEqual(['helsing']);
    expect(slugCandidates('Isomorphic Labs', 'https://www.isomorphiclabs.com/')).toEqual([
      'isomorphiclabs',
      'isomorphic-labs',
      'isomorphic',
    ]);
  });
});

describe('boardUrl / extractLinks', () => {
  it('builds public board links', () => {
    expect(boardUrl({ provider: 'lever', identifier: 'eu:qonto' })).toBe('https://jobs.eu.lever.co/qonto');
    expect(boardUrl({ provider: 'teamtailor', identifier: 'careers.neat.no' })).toBe('https://careers.neat.no/jobs');
    expect(boardUrl({ provider: 'workday', identifier: 'nvidia/wd5/Site' })).toBe(
      'https://nvidia.wd5.myworkdayjobs.com/Site',
    );
  });

  it('resolves relative links and decodes entities', () => {
    const html =
      '<a href="/jobs/8452054-ux">UX</a><script src="https://jobs.ashbyhq.com/acme/embed?a=1&amp;b=2"></script><a href="mailto:x@y.z">m</a>';
    expect(extractLinks(html, 'https://careers.neat.no/')).toEqual([
      'https://careers.neat.no/jobs/8452054-ux',
      'https://jobs.ashbyhq.com/acme/embed?a=1&b=2',
    ]);
  });
});
