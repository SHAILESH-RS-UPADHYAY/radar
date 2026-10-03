import { afterEach, describe, expect, it } from 'vitest';
import {
  extractSkills,
  htmlToText,
  inferExperience,
  inferWorkType,
  isRelevantTitle,
  jobKey,
  normalizeSkill,
  parseSalaryRange,
  toIso,
} from './utils';

describe('htmlToText', () => {
  it('decodes Greenhouse double-escaped HTML and keeps paragraphs apart from lists', () => {
    expect(htmlToText('&lt;p&gt;Build &amp;amp; ship&lt;/p&gt;&lt;ul&gt;&lt;li&gt;APIs&lt;/li&gt;&lt;/ul&gt;')).toBe(
      'Build & ship\n\n• APIs',
    );
  });
  it('keeps the shape of a real posting: headings, paragraphs, bullets', () => {
    expect(
      htmlToText(
        '<h2><strong>About the role</strong></h2><p>You will <b>own</b> the API.<br>Remote OK.</p><h3>Requirements</h3><ul><li>3+ years</li><li>Go</li></ul>',
      ),
    ).toBe('About the role\n\nYou will own the API.\nRemote OK.\n\nRequirements\n\n• 3+ years\n• Go');
  });
  it('handles plain HTML and empty input', () => {
    expect(htmlToText('<b>Hi</b>&nbsp;there')).toBe('Hi there');
    expect(htmlToText(null)).toBe('');
  });
});

describe('extractSkills', () => {
  it('uses word boundaries so Go ≠ Google and Java ≠ JavaScript', () => {
    expect(extractSkills('We use Google Docs')).not.toContain('go');
    expect(extractSkills('JavaScript only')).toEqual(['javascript']);
  });
  it('maps aliases to one canonical skill', () => {
    expect(extractSkills('ReactJS, k8s and Postgres')).toEqual(
      expect.arrayContaining(['react', 'kubernetes', 'postgresql']),
    );
    expect(extractSkills('C++ and C#')).toEqual(expect.arrayContaining(['c++', 'c#']));
  });
  it('does not read "Go-to-market" as the Go language', () => {
    expect(extractSkills('Own the Go-to-market plan and go to market fast')).not.toContain('go');
    expect(extractSkills('Services in Go and Python')).toEqual(expect.arrayContaining(['go', 'python']));
  });
  it('does not read the English verb "go" as the Go language', () => {
    for (const text of [
      'where our AI roadmap needs to go next',
      "You're happy to actually go use v0 to build things",
      'Go beyond the obvious. Ready to go live?',
    ])
      expect(extractSkills(text)).not.toContain('go');
    for (const text of ['Golang microservices', 'exceptional coding skills in Java or Go.', 'Go, Rust or C++'])
      expect(extractSkills(text)).toContain('go');
  });
  it('recognises AI engineering skills', () => {
    expect(extractSkills('Built RAG agents with LangChain, OpenAI and Pinecone; fine-tuning via LoRA')).toEqual(
      expect.arrayContaining(['rag', 'langchain', 'openai', 'vector database', 'fine-tuning']),
    );
  });
});

describe('normalizeSkill', () => {
  it('canonicalizes user-typed skills', () => {
    expect(normalizeSkill(' ReactJS ')).toBe('react');
    expect(normalizeSkill('golang')).toBe('go');
    expect(normalizeSkill('Haskell')).toBe('haskell');
  });
});

describe('inferExperience', () => {
  it('reads seniority from the title first', () => {
    expect(inferExperience('Software Engineer Intern')).toBe('fresher');
    expect(inferExperience('Senior Backend Engineer', '1+ years')).toBe('0-1');
    expect(inferExperience('Senior Backend Engineer')).toBeNull();
    expect(inferExperience('Associate Engineer')).toBe('0-1');
  });
  it('falls back to years in the description', () => {
    expect(inferExperience('Backend Engineer', 'You have 3-5 years of experience')).toBe('1-3');
    expect(inferExperience('Backend Engineer', '6+ years')).toBe('5+');
    expect(inferExperience('Backend Engineer', 'no numbers here')).toBeNull();
  });
});

describe('inferWorkType', () => {
  it('prefers hybrid over remote when both appear', () => {
    expect(inferWorkType('Hybrid - Remote friendly')).toBe('hybrid');
    expect(inferWorkType('Remote, India')).toBe('remote');
    expect(inferWorkType('Bengaluru')).toBeNull();
  });
});

describe('parseSalaryRange', () => {
  it('parses currency, k-suffix and ranges', () => {
    expect(parseSalaryRange('$120K – $150K')).toEqual({ min: 120000, max: 150000, currency: 'USD' });
    expect(parseSalaryRange('€75k–110k')).toEqual({ min: 75000, max: 110000, currency: 'EUR' });
    expect(parseSalaryRange('12 LPA')).toEqual({ min: 1200000, max: null, currency: 'INR' });
    expect(parseSalaryRange(null)).toEqual({ min: null, max: null, currency: null });
  });
});

describe('toIso', () => {
  it('accepts epoch seconds, epoch ms and Recruitee-style strings', () => {
    expect(toIso(1_700_000_000)).toBe('2023-11-14T22:13:20.000Z');
    expect(toIso(1_700_000_000_000)).toBe('2023-11-14T22:13:20.000Z');
    expect(toIso('2026-09-07 12:04:00 UTC')).toBe('2026-09-07T12:04:00.000Z');
    expect(toIso('garbage')).toBeNull();
  });
});

describe('isRelevantTitle', () => {
  afterEach(() => {
    delete process.env.RADAR_TITLE_FILTER;
    delete process.env.RADAR_TITLE_KEYWORDS;
    delete process.env.RADAR_TITLE_EXCLUDE;
  });
  it('keeps tech roles and drops non-tech ones', () => {
    expect(isRelevantTitle('Senior Software Engineer')).toBe(true);
    expect(isRelevantTitle('Frontend Developer')).toBe(true);
    expect(isRelevantTitle('Copywriting Intern')).toBe(false);
    expect(isRelevantTitle('Video Editor Intern')).toBe(false);
    expect(isRelevantTitle('Account Executive')).toBe(false);
  });
  it('drops sales, management and leadership titles that only mention a tech word', () => {
    for (const title of [
      'Account Executive, AI Sales',
      'Senior Manager - Data Science',
      'Product Manager - Data Platform',
      'Customer Success Engineer',
      'Director, Engineering - AI Studio',
    ])
      expect(isRelevantTitle(title)).toBe(false);
    for (const title of ['Forward-Deployed AI Engineer', 'Payments Analyst', 'Staff Software Engineer'])
      expect(isRelevantTitle(title)).toBe(true);
    process.env.RADAR_TITLE_EXCLUDE = 'intern';
    expect(isRelevantTitle('Product Manager - Data Platform')).toBe(true);
    expect(isRelevantTitle('Data Intern')).toBe(false);
    delete process.env.RADAR_TITLE_EXCLUDE;
  });
  it('can be turned off or customised by env', () => {
    process.env.RADAR_TITLE_FILTER = 'off';
    expect(isRelevantTitle('Account Executive')).toBe(true);
    delete process.env.RADAR_TITLE_FILTER;
    process.env.RADAR_TITLE_KEYWORDS = 'designer';
    expect(isRelevantTitle('Product Designer')).toBe(true);
    expect(isRelevantTitle('Software Engineer')).toBe(false);
  });
});

describe('jobKey', () => {
  it('matches one job across sources despite punctuation, case and company suffixes', () => {
    expect(jobKey('Acme, Inc.', 'Senior Engineer (Remote)')).toBe(jobKey('ACME', 'Senior Engineer - Remote'));
    expect(jobKey('Acme Pvt Ltd', 'Backend Engineer')).toBe('acme|backend engineer');
    expect(jobKey('Acme', 'Backend Engineer')).not.toBe(jobKey('Acme', 'Frontend Engineer'));
  });
});
