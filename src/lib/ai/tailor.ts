// ============================
// RADAR — OVERCLOCK: honest resume tailoring
// ============================
// Claude rewrites the user's resume for one job using only facts already in it, lists what the job
// wants that the resume cannot back up, and RADAR measures the result with the same scorer as a scan.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { embedText, fetchJobVector } from '@/lib/ai/embeddings';
import { computeMatchScore } from '@/lib/ai/matcher';
import { matchInput, profileSkills, type ScoringJob, type ScoringProfile } from '@/lib/pipeline/match';
import { extractSkills } from '@/lib/scraper/utils';

export const TAILOR_MODEL = 'claude-opus-5';

const Resume = z.object({
  name: z.string(),
  headline: z.string(),
  contact: z.array(z.string()),
  summary: z.string(),
  skills: z.array(z.object({ group: z.string(), items: z.array(z.string()) })),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      location: z.string(),
      dates: z.string(),
      bullets: z.array(z.string()),
    }),
  ),
  projects: z.array(z.object({ name: z.string(), stack: z.string(), link: z.string(), bullets: z.array(z.string()) })),
  education: z.array(z.object({ degree: z.string(), school: z.string(), dates: z.string(), details: z.string() })),
  extras: z.array(z.object({ heading: z.string(), items: z.array(z.string()) })),
});

export const TailorOutput = z.object({
  resume: Resume,
  gaps: z.array(z.object({ requirement: z.string(), advice: z.string() })),
  changes: z.array(z.string()),
  cover_note: z.string(),
});
export type TailoredResume = z.infer<typeof Resume>;
export type TailorOutput = z.infer<typeof TailorOutput>;

const SYSTEM = `You tailor a candidate's resume to one job posting. You are editing a real person's record, so accuracy outranks persuasion.

Rules:
- Use only facts present in the resume and profile. Never invent employers, titles, dates, degrees, metrics, links or skills.
- You may reorder sections and bullets, rewrite bullets for clarity and impact, merge or cut weaker ones, and use the posting's wording where it truthfully describes the same thing.
- Lead with the experience and projects most relevant to this posting. Keep the resume to one page (about 450 to 650 words).
- Skills: only skills the resume or profile shows, grouped (for example Languages, AI/ML, Backend, Tools).
- If the posting asks for something the resume does not show, keep it out of the resume and add it to gaps with one line of honest advice: add it if the candidate genuinely has it, otherwise how to close the gap.
- changes: each edit you made, one short line each.
- cover_note: two or three sentences the candidate can paste into a "why this role" field, grounded only in the resume.
- Plain text only: no markdown, no emojis. Use an empty string or empty list when the resume has nothing for a field.`;

export class TailorError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export interface TailorJob extends ScoringJob {
  description: string | null;
  company: string;
}

/** Ask Claude for a tailored resume. Throws TailorError with an HTTP status for the route to return. */
export async function tailorResume(resumeText: string, profile: ScoringProfile, job: TailorJob): Promise<TailorOutput> {
  const posting = [
    'JOB: ' + job.title + ' at ' + job.company,
    job.location ? 'LOCATION: ' + job.location : '',
    job.skills?.length ? 'LISTED SKILLS: ' + job.skills.join(', ') : '',
    'DESCRIPTION:\n' + (job.description || '(no description provided)'),
  ]
    .filter(Boolean)
    .join('\n');
  const candidate = [
    profile.current_role ? 'TARGET ROLES: ' + profile.current_role : '',
    'EXPERIENCE: ' + (profile.is_fresher ? 'fresher / intern' : (profile.experience_years ?? 0) + ' years'),
    profile.skills?.length ? 'CONFIRMED SKILLS: ' + profile.skills.join(', ') : '',
  ]
    .filter(Boolean)
    .join('\n');

  let response;
  try {
    const client = new Anthropic();
    response = await client.beta.messages.parse({
      model: TAILOR_MODEL,
      max_tokens: 16000,
      // If a safety classifier declines, the API retries on its recommended fallback model instead of failing.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `<posting>\n${posting}\n</posting>\n\n<profile>\n${candidate}\n</profile>\n\n<resume>\n${resumeText}\n</resume>`,
        },
      ],
      output_config: { format: betaZodOutputFormat(TailorOutput) },
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      throw new TailorError('Claude API key is missing or invalid. Set ANTHROPIC_API_KEY on the server.', 503);
    }
    if (err instanceof Anthropic.RateLimitError)
      throw new TailorError('Claude is rate limited. Try again shortly.', 429);
    if (err instanceof Anthropic.APIConnectionError) throw new TailorError('Could not reach Claude. Try again.', 502);
    if (err instanceof Anthropic.APIError) throw new TailorError('Claude error: ' + err.message, 502);
    // The SDK throws a plain Error at construction when no credentials are configured at all.
    if (err instanceof Error && /api.?key|auth/i.test(err.message)) {
      throw new TailorError('Claude is not configured. Set ANTHROPIC_API_KEY on the server.', 503);
    }
    throw err;
  }

  if (response.stop_reason === 'refusal') throw new TailorError('Claude declined to tailor this resume.', 422);
  if (response.stop_reason === 'max_tokens') throw new TailorError('The tailored resume came back incomplete.', 502);
  if (!response.parsed_output) throw new TailorError('Claude returned an unreadable resume. Try again.', 502);
  return response.parsed_output;
}

/** Plain-text rendering, used for scoring and as the body of the PDF. */
export function resumeToText(r: TailoredResume): string {
  const lines: string[] = [r.name, r.headline, r.contact.join(' | '), '', r.summary];
  if (r.skills.length) lines.push('', 'SKILLS', ...r.skills.map((g) => g.group + ': ' + g.items.join(', ')));
  if (r.experience.length) {
    lines.push('', 'EXPERIENCE');
    for (const e of r.experience)
      lines.push(
        [e.title, e.company, e.location, e.dates].filter(Boolean).join(' | '),
        ...e.bullets.map((b) => '- ' + b),
      );
  }
  if (r.projects.length) {
    lines.push('', 'PROJECTS');
    for (const p of r.projects)
      lines.push([p.name, p.stack, p.link].filter(Boolean).join(' | '), ...p.bullets.map((b) => '- ' + b));
  }
  if (r.education.length) {
    lines.push('', 'EDUCATION');
    for (const e of r.education) lines.push([e.degree, e.school, e.dates, e.details].filter(Boolean).join(' | '));
  }
  for (const x of r.extras)
    if (x.items.length) lines.push('', x.heading.toUpperCase(), ...x.items.map((i) => '- ' + i));
  return lines.join('\n').trim();
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/**
 * Projected score for the tailored resume. The original and tailored texts are measured the same way
 * against the job's vector, and only the difference is applied to the job's current score, so the
 * projection never mixes two scoring methods. Returns null when the job has no vector.
 */
export async function projectScore(opts: {
  currentScore: number;
  originalText: string;
  tailoredText: string;
  profile: ScoringProfile;
  job: ScoringJob;
  jobId: string;
  isDreamCompany: boolean;
  companyCategory: string;
}): Promise<number | null> {
  const jobVector = await fetchJobVector(opts.jobId);
  if (!jobVector) return null;
  const [original, tailored] = await Promise.all([embedText(opts.originalText), embedText(opts.tailoredText)]);
  const score = (vector: number[], extraSkills: string[]) =>
    computeMatchScore(
      matchInput(opts.profile, opts.job, cosine(vector, jobVector), {
        isDreamCompany: opts.isDreamCompany,
        companyCategory: opts.companyCategory,
        userSkills: [...new Set([...profileSkills(opts.profile), ...extraSkills])],
      }),
    ).score;
  const delta = score(tailored, extractSkills(opts.tailoredText)) - score(original, extractSkills(opts.originalText));
  return Math.max(0, Math.min(100, opts.currentScore + delta));
}
