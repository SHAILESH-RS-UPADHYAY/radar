import { afterEach, describe, expect, it } from 'vitest';
import {
  extractSkills,
  htmlToText,
  inferExperience,
  inferWorkType,
  isRelevantTitle,
  normalizeSkill,
  parseSalaryRange,
  toIso,
} from './utils';

describe('htmlToText', () => {
  it('decodes Greenhouse double-escaped HTML', () => {
    expect(htmlToText('&lt;p&gt;Build &amp;amp; ship&lt;/p&gt;&lt;ul&gt;&lt;li&gt;APIs&lt;/li&gt;&lt;/ul&gt;')).toBe(
      'Build & ship\n• APIs',
    );
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
    expect(inferExperience('Senior Backend Engineer', '1+ years')).toBe('5+');
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
  });
  it('keeps tech roles and drops non-tech ones', () => {
    expect(isRelevantTitle('Senior Software Engineer')).toBe(true);
    expect(isRelevantTitle('Frontend Developer')).toBe(true);
    expect(isRelevantTitle('Copywriting Intern')).toBe(false);
    expect(isRelevantTitle('Video Editor Intern')).toBe(false);
    expect(isRelevantTitle('Account Executive')).toBe(false);
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
