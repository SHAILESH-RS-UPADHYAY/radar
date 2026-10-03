import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/embeddings', () => ({ embedText: vi.fn(), fetchJobVector: vi.fn() }));

import { embedText, fetchJobVector } from '@/lib/ai/embeddings';
import {
  aiEngine,
  aiProviders,
  cosine,
  parseTailored,
  projectScore,
  resumeToText,
  tailorResume,
  TailorError,
  type TailoredResume,
} from './tailor';

const r: TailoredResume = {
  name: 'Asha Rao',
  headline: 'AI Engineer',
  contact: ['asha@example.com'],
  summary: 'Builds RAG systems.',
  skills: [{ group: 'AI', items: ['Python', 'RAG'] }],
  experience: [{ title: 'ML Engineer', company: 'Acme', location: '', dates: '2025', bullets: ['Shipped search.'] }],
  projects: [],
  education: [],
  extras: [{ heading: 'Awards', items: [] }],
};

describe('resumeToText', () => {
  it('renders filled sections and skips empty ones', () => {
    const text = resumeToText(r);
    expect(text).toContain('SKILLS\nAI: Python, RAG');
    expect(text).toContain('ML Engineer | Acme | 2025\n- Shipped search.');
    expect(text).not.toContain('PROJECTS');
    expect(text).not.toContain('AWARDS');
  });
});

describe('cosine', () => {
  it('measures direction, not length', () => {
    expect(cosine([1, 0], [2, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 3])).toBeCloseTo(0);
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });
});

describe('projectScore', () => {
  afterEach(() => vi.resetAllMocks());
  const base = {
    currentScore: 64,
    originalText: 'original resume',
    tailoredText: 'tailored resume',
    profile: {
      skills: ['python'],
      resume_text: '',
      current_role: null,
      location: null,
      is_fresher: false,
      experience_years: 1,
    },
    job: { title: 'AI Engineer', skills: ['python'], experience_required: null, location: null, work_type: null },
    jobId: 'job-1',
    isDreamCompany: false,
    companyCategory: 'MNC',
  };

  it('applies only the measured improvement to the current score', async () => {
    vi.mocked(fetchJobVector).mockResolvedValue([1, 0]);
    // Original sits at the similarity floor (0.72), tailored at the ceiling (0.88): +60 meaning points x 0.6.
    vi.mocked(embedText).mockImplementation(async (t: string) =>
      t === 'tailored resume' ? [0.88, Math.sqrt(1 - 0.88 ** 2)] : [0.72, Math.sqrt(1 - 0.72 ** 2)],
    );
    expect(await projectScore(base)).toBe(100);
    expect(await projectScore({ ...base, currentScore: 20 })).toBe(80);
  });

  it('returns null when the job has no vector to compare against', async () => {
    vi.mocked(fetchJobVector).mockResolvedValue(null);
    expect(await projectScore(base)).toBeNull();
    expect(embedText).not.toHaveBeenCalled();
  });
});

describe('AI providers (Anthropic · Gemini · Grok)', () => {
  const output = {
    resume: { ...r },
    gaps: [{ requirement: 'Kubernetes', advice: 'Add it only if you have used it.' }],
    changes: ['Led with the RAG project.'],
    cover_note: 'I build retrieval systems.',
  };
  const profile = {
    skills: ['python'],
    resume_text: 'x',
    current_role: null,
    location: null,
    is_fresher: false,
    experience_years: 2,
  };
  const job = {
    title: 'AI Engineer',
    company: 'Northwind',
    description: 'RAG',
    skills: ['python'],
    experience_required: null,
    location: null,
    work_type: null,
  };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  const gemini = (text: string, finishReason = 'STOP') => ({
    candidates: [{ finishReason, content: { parts: [{ text }] } }],
  });
  const grok = (content: string) => ({ choices: [{ finish_reason: 'stop', message: { content } }] });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('orders providers: AI_PROVIDER first, then any other with a key', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', 'g');
    vi.stubEnv('XAI_API_KEY', 'x');
    vi.stubEnv('AI_PROVIDER', 'grok');
    expect(aiProviders()).toEqual(['grok', 'gemini']);
    vi.stubEnv('AI_PROVIDER', '');
    expect(aiProviders()).toEqual(['gemini', 'grok']);
    expect(aiEngine()).toMatchObject({ provider: 'gemini', model: 'gemini-3.1-pro-preview' });
  });

  it('reads fenced or bare JSON and rejects replies that miss the schema', () => {
    expect(parseTailored('```json\n' + JSON.stringify(output) + '\n```').cover_note).toBe('I build retrieval systems.');
    expect(() => parseTailored('not json')).toThrow(TailorError);
    expect(() => parseTailored(JSON.stringify({ resume: {} }))).toThrow(TailorError);
  });

  it('tailors with Gemini, and falls back to Grok when Gemini is rate limited', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', 'g');
    vi.stubEnv('XAI_API_KEY', 'x');
    vi.stubEnv('AI_PROVIDER', 'gemini');
    const fetchMock = vi.fn<(url: RequestInfo | URL) => Promise<Response>>(async () =>
      reply(200, gemini(JSON.stringify(output))),
    );
    vi.stubGlobal('fetch', fetchMock);
    const first = await tailorResume('resume', profile, job);
    expect(first.model).toBe('gemini:gemini-3.1-pro-preview');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/models/gemini-3.1-pro-preview:generateContent');

    // The top model is a preview: when it is gone, the newest stable Flash writes instead.
    fetchMock.mockImplementation(async (url: RequestInfo | URL) =>
      String(url).includes('gemini-3.1-pro-preview')
        ? reply(404, { error: { message: 'model not found' } })
        : reply(200, gemini(JSON.stringify(output))),
    );
    expect((await tailorResume('resume', profile, job)).model).toBe('gemini:gemini-3.8-flash');

    fetchMock.mockImplementation(async (url: RequestInfo | URL) =>
      String(url).includes('googleapis')
        ? reply(429, { error: { message: 'quota' } })
        : reply(200, grok(JSON.stringify(output))),
    );
    const second = await tailorResume('resume', profile, job);
    expect(second.model).toBe('grok:grok-4.7');
    expect(second.output.gaps[0].requirement).toBe('Kubernetes');
  });

  it('stops at a refusal, and explains a missing configuration', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', 'g');
    vi.stubEnv('XAI_API_KEY', 'x');
    vi.stubEnv('AI_PROVIDER', 'gemini');
    const fetchMock = vi.fn<(url: RequestInfo | URL) => Promise<Response>>(async () =>
      reply(200, gemini('', 'SAFETY')),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(tailorResume('resume', profile, job)).rejects.toMatchObject({ status: 422 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('XAI_API_KEY', '');
    await expect(tailorResume('resume', profile, job)).rejects.toMatchObject({ status: 503 });
  });
});
