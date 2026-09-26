import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/embeddings', () => ({ embedText: vi.fn(), fetchJobVector: vi.fn() }));

import { embedText, fetchJobVector } from '@/lib/ai/embeddings';
import { cosine, projectScore, resumeToText, type TailoredResume } from './tailor';

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
    companyCategory: 'Growth',
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
