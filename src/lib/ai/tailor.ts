// ============================
// RADAR — OVERCLOCK: honest resume tailoring
// ============================
// The model rewrites the user's resume for one job using only facts already in it, lists what the job
// wants that the resume cannot back up, and RADAR measures the result with the same scorer as a scan.
// Any of three providers can do the writing — Anthropic, Google Gemini or xAI Grok — chosen with
// AI_PROVIDER; every other provider with a key set is a fallback when the first is down or rate limited.

import Anthropic from '@anthropic-ai/sdk';
import type { Portfolio } from '@/types';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { embedText, fetchJobVector } from '@/lib/ai/embeddings';
import { computeMatchScore } from '@/lib/ai/matcher';
import { readEnv } from '@/lib/env';
import { matchInput, profileSkills, type ScoringJob, type ScoringProfile } from '@/lib/pipeline/match';
import { extractSkills } from '@/lib/scraper/utils';

export type AiProvider = 'anthropic' | 'gemini' | 'grok';
const PROVIDERS: AiProvider[] = ['anthropic', 'gemini', 'grok'];
const KEY: Record<AiProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  grok: 'XAI_API_KEY',
};
const NAME: Record<AiProvider, string> = { anthropic: 'Anthropic', gemini: 'Gemini', grok: 'Grok' };
/** Defaults checked against each provider's model list (2026-09-26); override with ANTHROPIC_MODEL / GEMINI_MODEL / XAI_MODEL. */
const MODEL: Record<AiProvider, () => string> = {
  anthropic: () => readEnv('ANTHROPIC_MODEL') || 'claude-opus-5',
  gemini: () => readEnv('GEMINI_MODEL') || 'gemini-3.1-pro-preview',
  grok: () => readEnv('XAI_MODEL') || 'grok-4.7',
};
const TIMEOUT_MS = 170_000;

/** Providers to try, in order: AI_PROVIDER first, then every other one whose key is set. */
export function aiProviders(): AiProvider[] {
  const preferred = readEnv('AI_PROVIDER')?.toLowerCase() as AiProvider | undefined;
  const order =
    preferred && PROVIDERS.includes(preferred) ? [preferred, ...PROVIDERS.filter((p) => p !== preferred)] : PROVIDERS;
  return order.filter((p) => readEnv(KEY[p]));
}

/** The provider and model that will write the next tailoring, for the UI; null when no key is set. */
export function aiEngine(): { provider: AiProvider; name: string; model: string } | null {
  const p = aiProviders()[0];
  return p ? { provider: p, name: NAME[p], model: MODEL[p]() } : null;
}

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

// Providers without schema-enforced output get the schema in the instructions; zod checks the reply either way.
const JSON_RULE =
  '\n\nReply with a single JSON object and nothing else (no prose, no code fences). It must match this JSON Schema:\n' +
  JSON.stringify(z.toJSONSchema(TailorOutput));

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

/** A model's JSON reply → the checked tailoring, or a 502 the caller can retry on another provider. */
export function parseTailored(text: string): TailorOutput {
  const body = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new TailorError('The AI returned an unreadable resume. Try again.', 502);
  }
  const parsed = TailorOutput.safeParse(json);
  if (!parsed.success) throw new TailorError('The AI returned an incomplete resume. Try again.', 502);
  return parsed.data;
}

/** HTTP status from a provider's REST API → a TailorError that says what to fix. */
function httpError(provider: AiProvider, status: number, detail: string): TailorError {
  const who = NAME[provider];
  if (status === 401 || status === 403 || (status === 400 && /api[ _-]?key/i.test(detail)))
    return new TailorError(`${who} rejected ${KEY[provider]}. Check the key on the server.`, 503);
  if (status === 429) return new TailorError(`${who} is rate limited. Try again shortly.`, 429);
  return new TailorError(`${who} error (${status})${detail ? ': ' + detail.slice(0, 200) : ''}`, 502);
}

async function post(provider: AiProvider, url: string, headers: Record<string, string>, body: unknown) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new TailorError(`Could not reach ${NAME[provider]}. Try again.`, 502);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const error = data.error as { message?: string } | string | undefined;
    throw httpError(provider, res.status, typeof error === 'string' ? error : error?.message || '');
  }
  return data;
}

// Gemini's top model is a preview: when it is retired, rate limited or cut short, the newest stable Flash writes.
const GEMINI_FALLBACK = 'gemini-3.8-flash';

/** One Gemini JSON reply as text (refusals, cut-offs and HTTP errors become TailorErrors). */
async function geminiText(model: string, system: string, user: string): Promise<string> {
  const data = (await post(
    'gemini',
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { 'x-goog-api-key': readEnv('GEMINI_API_KEY')! },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      // Thinking tokens count toward the output limit, so leave the reasoning room on top of the resume.
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 32768 },
    },
  )) as {
    promptFeedback?: { blockReason?: string };
    candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
  };
  const candidate = data.candidates?.[0];
  if (data.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY')
    throw new TailorError('The AI declined to tailor this resume.', 422);
  if (candidate?.finishReason === 'MAX_TOKENS') throw new TailorError('The AI reply came back incomplete.', 502);
  return (candidate?.content?.parts || []).map((p) => p.text || '').join('');
}

const callGemini = async (model: string, user: string): Promise<TailorOutput> =>
  parseTailored(await geminiText(model, SYSTEM + JSON_RULE, user));

/**
 * One JSON reply for any prompt from the configured AI: AI_PROVIDER first, then the others, like tailoring.
 * The caller checks the JSON. Used for application-form answers.
 */
export async function completeJson(system: string, user: string): Promise<{ text: string; model: string }> {
  const providers = aiProviders();
  if (!providers.length)
    throw new TailorError(
      'AI is not configured. Set ANTHROPIC_API_KEY, GEMINI_API_KEY or XAI_API_KEY on the server.',
      503,
    );
  let last: TailorError | null = null;
  for (const provider of providers) {
    try {
      if (provider === 'gemini') {
        for (const model of [...new Set([MODEL.gemini(), GEMINI_FALLBACK])]) {
          try {
            return { text: await geminiText(model, system, user), model: 'gemini:' + model };
          } catch (err) {
            if (!(err instanceof TailorError) || err.status === 422 || err.status === 503) throw err;
            last = err;
          }
        }
        throw last!;
      }
      if (provider === 'grok') {
        const data = (await post(
          'grok',
          'https://api.x.ai/v1/chat/completions',
          { authorization: 'Bearer ' + readEnv('XAI_API_KEY') },
          {
            model: MODEL.grok(),
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            response_format: { type: 'json_object' },
          },
        )) as { choices?: { message?: { content?: string } }[] };
        return { text: data.choices?.[0]?.message?.content || '', model: 'grok:' + MODEL.grok() };
      }
      const client = new Anthropic({ apiKey: readEnv('ANTHROPIC_API_KEY')! });
      const response = await client.messages
        .create({
          model: MODEL.anthropic(),
          max_tokens: 8000,
          system: system + '\n\nReply with a single JSON object and nothing else.',
          messages: [{ role: 'user', content: user }],
        })
        .catch((err) => {
          if (err instanceof Anthropic.APIError && typeof err.status === 'number')
            throw httpError('anthropic', err.status, err.message);
          throw new TailorError('Could not reach Anthropic. Try again.', 502);
        });
      const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      return { text, model: 'anthropic:' + (response.model || MODEL.anthropic()) };
    } catch (err) {
      last = err instanceof TailorError ? err : new TailorError('AI error: ' + (err as Error).message, 502);
      if (last.status === 422) throw last;
      console.warn('[AI]', provider, 'failed:', last.message, providers.length > 1 ? '→ next provider' : '');
    }
  }
  throw last!;
}

// Each provider returns the tailoring and the model that actually wrote it.
const CALL: Record<AiProvider, (user: string) => Promise<{ output: TailorOutput; model: string }>> = {
  async anthropic(user) {
    let response;
    try {
      const client = new Anthropic({ apiKey: readEnv('ANTHROPIC_API_KEY')! });
      response = await client.beta.messages.parse({
        model: MODEL.anthropic(),
        max_tokens: 16000,
        // If a safety classifier declines, the API retries on its recommended fallback model instead of failing.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM,
        messages: [{ role: 'user', content: user }],
        output_config: { format: betaZodOutputFormat(TailorOutput) },
      });
    } catch (err) {
      if (err instanceof Anthropic.APIError && typeof err.status === 'number')
        throw httpError('anthropic', err.status, err.message);
      if (err instanceof Anthropic.APIConnectionError)
        throw new TailorError('Could not reach Anthropic. Try again.', 502);
      throw err;
    }
    if (response.stop_reason === 'refusal') throw new TailorError('The AI declined to tailor this resume.', 422);
    if (response.stop_reason === 'max_tokens') throw new TailorError('The tailored resume came back incomplete.', 502);
    if (!response.parsed_output) throw new TailorError('The AI returned an unreadable resume. Try again.', 502);
    return { output: response.parsed_output, model: response.model || MODEL.anthropic() };
  },

  async gemini(user) {
    let last: TailorError | null = null;
    for (const model of [...new Set([MODEL.gemini(), GEMINI_FALLBACK])]) {
      try {
        return { output: await callGemini(model, user), model };
      } catch (err) {
        // A refusal or a rejected key is the same on every model; anything else gets the next one.
        if (!(err instanceof TailorError) || err.status === 422 || err.status === 503) throw err;
        last = err;
        console.warn('[OVERCLOCK] gemini', model, 'failed:', err.message);
      }
    }
    throw last!;
  },

  async grok(user) {
    const data = (await post(
      'grok',
      'https://api.x.ai/v1/chat/completions',
      { authorization: 'Bearer ' + readEnv('XAI_API_KEY') },
      {
        model: MODEL.grok(),
        messages: [
          { role: 'system', content: SYSTEM + JSON_RULE },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
      },
    )) as { choices?: { finish_reason?: string; message?: { content?: string } }[] };
    const choice = data.choices?.[0];
    if (choice?.finish_reason === 'content_filter')
      throw new TailorError('The AI declined to tailor this resume.', 422);
    if (choice?.finish_reason === 'length') throw new TailorError('The tailored resume came back incomplete.', 502);
    return { output: parseTailored(choice?.message?.content || ''), model: MODEL.grok() };
  },
};

/**
 * Ask the configured AI for a tailored resume. Tries AI_PROVIDER first, then any other configured provider when
 * one is down, rate limited or rejects its key. Throws TailorError with an HTTP status for the route to return.
 * `model` ("gemini:gemini-3.1-pro-preview") is stored with the result.
 */
export async function tailorResume(
  resumeText: string,
  profile: ScoringProfile,
  job: TailorJob,
  portfolio?: Portfolio | null,
): Promise<{ output: TailorOutput; model: string }> {
  const providers = aiProviders();
  if (!providers.length)
    throw new TailorError(
      'AI tailoring is not configured. Set ANTHROPIC_API_KEY, GEMINI_API_KEY or XAI_API_KEY on the server.',
      503,
    );
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
    // Links and built projects from Preferences are facts from the profile: usable in contact lines and projects.
    ...(['portfolio', 'github', 'linkedin', 'website'] as const)
      .filter((k) => portfolio?.[k])
      .map((k) => k.toUpperCase() + ': ' + portfolio![k]),
    ...(portfolio?.projects || []).map(
      (p) => 'PROJECT YOU BUILT: ' + p.name + ' (' + p.url + ')' + (p.note ? ' - ' + p.note : ''),
    ),
  ]
    .filter(Boolean)
    .join('\n');
  const user = `<posting>\n${posting}\n</posting>\n\n<profile>\n${candidate}\n</profile>\n\n<resume>\n${resumeText}\n</resume>`;

  let last: TailorError | null = null;
  for (const provider of providers) {
    try {
      const { output, model } = await CALL[provider](user);
      return { output, model: provider + ':' + model };
    } catch (err) {
      last = err instanceof TailorError ? err : new TailorError('AI error: ' + (err as Error).message, 502);
      // A refusal is about the content; another provider will not see it differently.
      if (last.status === 422) throw last;
      console.warn('[OVERCLOCK]', provider, 'failed:', last.message, providers.length > 1 ? '→ next provider' : '');
    }
  }
  throw last!;
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
