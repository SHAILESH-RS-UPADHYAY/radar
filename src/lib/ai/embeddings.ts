import { createHash } from 'node:crypto';
import { Pinecone } from '@pinecone-database/pinecone';
import { env, readEnv } from '@/lib/env';
import { createServerClient } from '@/lib/supabase/client';

function getPinecone() {
  return new Pinecone({ apiKey: env.pineconeApiKey() });
}

/** Length and a one-way fingerprint of the key this server holds, to compare with the key that works. */
function keyPrint(): string {
  const key = readEnv('PINECONE_API_KEY') || '';
  return `${key.length} chars · fp ${createHash('sha256').update(key).digest('hex').slice(0, 8)}`;
}

/** A rejected key is a deployment problem, not the user's: name the variable to fix, and which key is loaded. */
export function explainVectorError(err: unknown): string | null {
  const e = err as { name?: string; message?: string } | null;
  if (e?.name === 'PineconeAuthorizationError' || /api key you provided was rejected/i.test(e?.message || ''))
    return `Job search is offline: Pinecone rejected the server's PINECONE_API_KEY (${keyPrint()}). Set the exact key (no quotes) in Vercel → Settings → Environment Variables → Production, then redeploy.`;
  return null;
}

export function toVectorLiteral(values: number[]): string {
  return '[' + values.join(',') + ']';
}

export function parseEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value) && value.every((n) => typeof n === 'number')) {
    return value as number[];
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed as number[];
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * The model every vector in the index comes from: resumes and jobs must share it, so changing it means re-embedding
 * every job and clearing stored resume vectors (done once on 2026-10-14: 7,433 jobs, 1.9M tokens). Switched from multilingual-e5-large on
 * 2026-10-14, when e5's 5M-token monthly quota ran out; llama-text-embed-v2 has its own, at the index's 1024 dims.
 */
export const EMBED_MODEL = 'llama-text-embed-v2';

/** How much of a job description is embedded: the opening says what the role is; the rest costs tokens. */
export const JD_CHARS = 800;

/** One job's text for its vector. Pure. */
export function jobText(
  j: {
    title: string;
    company_name: string;
    skills: string[];
    location: string | null;
    description: string | null;
  },
  chars = JD_CHARS,
): string {
  const parts = [j.title, j.company_name];
  if (j.skills.length) parts.push('Skills: ' + j.skills.join(', '));
  if (j.location) parts.push('Location: ' + j.location);
  if (j.description) parts.push(j.description.replace(/\s+/g, ' ').trim().substring(0, chars));
  return parts.join(' | ');
}

/**
 * Passage embeddings. Many new jobs at once can hit Pinecone's tokens-per-minute limit, which the SDK reports as an
 * unexpected error: wait and try again (8s, then 16s) before giving up. A rejected key fails at once.
 */
async function embedPassages(inputs: string[]) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getPinecone().inference.embed({
        model: EMBED_MODEL,
        inputs,
        parameters: { inputType: 'passage', truncate: 'END' },
      });
    } catch (err) {
      if (attempt >= 2 || explainVectorError(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, 8_000 * 2 ** attempt));
    }
  }
}

// ---------- Vector spaces ----------
// v1: llama-text-embed-v2 (Pinecone inference), 1024 dims, the JD's first JD_CHARS characters (migration 013).
// v2: gemini-embedding-001 (free tier), 768 dims, the JD up to JD_CHARS_V2 characters (migration 014).
// Vectors of different models cannot be compared, so a resume and its jobs always come from the same space.
// ponytail: v1 is still written for new jobs as the fallback; drop it once v2 has run cleanly for a few weeks.
export type Space = 'v1' | 'v2';
const SPACE = {
  v1: { job: 'embedding', resume: 'resume_embedding', match: 'match_jobs', similarity: 'job_similarity' },
  v2: { job: 'embedding_v2', resume: 'resume_embedding_v2', match: 'match_jobs_v2', similarity: 'job_similarity_v2' },
} as const;
export const spaceColumns = (space: Space) => SPACE[space];

export const GEMINI_EMBED_MODEL = 'gemini-embedding-001';
export const JD_CHARS_V2 = 8000;

/** Matching uses Gemini's space once at least 98% of open jobs have a vector there. */
export async function activeSpace(): Promise<Space> {
  const supabase = createServerClient();
  const [all, missing] = await Promise.all([
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('is_active', true).is('embedding_v2', null),
  ]);
  if (all.error || missing.error || !all.count || missing.count == null) return 'v1';
  return missing.count <= all.count * 0.02 ? 'v2' : 'v1';
}

// The score formula was tuned on v1 similarities (matcher.ts SIM_FLOOR..SIM_CEIL = 0.32..0.64). v2 similarities sit in
// another band, so they are mapped onto v1's before scoring: the Vault's 80% means the same in both spaces.
const V1_BAND = [0.32, 0.64];
const V2_BAND = [Number(process.env.RADAR_SIM_FLOOR_V2 || 0.6), Number(process.env.RADAR_SIM_CEIL_V2 || 0.8)];

/** A similarity on v1's scale. Pure. */
export function calibrate(similarity: number, space: Space): number {
  if (space === 'v1') return similarity;
  const t = (similarity - V2_BAND[0]) / (V2_BAND[1] - V2_BAND[0]);
  return V1_BAND[0] + t * (V1_BAND[1] - V1_BAND[0]);
}

// ---------- Gemini embeddings (v2) ----------
// The free tier allows 30,000 tokens a minute per project and model (Google's 429 said so, 2026-10-28). Tokens are
// estimated as characters / 4, and calls are paced to stay under the limit.
const GEMINI_TPM = 27_000;
const sent: { at: number; tokens: number }[] = [];
const tokensOf = (text: string) => Math.ceil(text.length / 4);

/** Ms to wait before `tokens` more fit in the last minute's budget (0 = now). */
function paceDelay(tokens: number, now = Date.now()): number {
  while (sent.length && now - sent[0].at >= 60_000) sent.shift();
  let used = sent.reduce((s, x) => s + x.tokens, 0);
  for (const x of sent) {
    if (used + tokens <= GEMINI_TPM) return 0;
    used -= x.tokens;
    if (used + tokens <= GEMINI_TPM) return x.at + 60_000 - now;
  }
  return used + tokens <= GEMINI_TPM ? 0 : 60_000;
}

export class EmbedQuotaError extends Error {}

/**
 * Gemini vectors for texts, in order. `wait: false` (the scrape) gives up at once when the minute's budget is spent or
 * Google answers 429, leaving those jobs to the backfill; `wait: true` paces and retries a 429 up to three times.
 */
export async function embedGemini(
  texts: string[],
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY',
  { wait = true } = {},
): Promise<number[][]> {
  const key = readEnv('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const out: number[][] = [];
  for (let i = 0; i < texts.length;) {
    // One request: at most 100 texts and about 12,000 tokens.
    const group: string[] = [];
    let tokens = 0;
    while (i < texts.length && group.length < 100 && (group.length === 0 || tokens + tokensOf(texts[i]) <= 12_000)) {
      tokens += tokensOf(texts[i]);
      group.push(texts[i++]);
    }
    for (let attempt = 0; ; attempt++) {
      const delay = paceDelay(tokens);
      if (delay && !wait) throw new EmbedQuotaError('Gemini embedding budget for this minute is spent');
      if (delay) await new Promise((r) => setTimeout(r, delay));
      sent.push({ at: Date.now(), tokens });
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:batchEmbedContents`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            requests: group.map((text) => ({
              model: 'models/' + GEMINI_EMBED_MODEL,
              content: { parts: [{ text }] },
              taskType,
              outputDimensionality: 768,
            })),
          }),
        },
      );
      if (res.ok) {
        const body = (await res.json()) as { embeddings: { values: number[] }[] };
        out.push(...body.embeddings.map((e) => e.values));
        break;
      }
      const text = await res.text();
      if (res.status !== 429 || !wait || attempt >= 3) {
        if (res.status === 429) throw new EmbedQuotaError('Gemini embedding quota: ' + text.slice(0, 200));
        throw new Error(`Gemini embedding failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
      }
      // Google says how long to wait ("retryDelay": "23s").
      const seconds = Number(/"retryDelay":\s*"(\d+)/.exec(text)?.[1] || 30);
      await new Promise((r) => setTimeout(r, Math.min(seconds + 1, 65) * 1_000));
    }
  }
  return out;
}

/** A resume's (or any query text's) vector in a space. */
export async function embedText(text: string, space: Space = 'v1'): Promise<number[]> {
  const clean = text.replace(/\s+/g, ' ').trim().substring(0, 8000);
  if (space === 'v2') return (await embedGemini([clean], 'RETRIEVAL_QUERY'))[0];
  const response = await embedPassages([clean]);
  const values = (response.data[0] as { values: number[] }).values;
  if (!values?.length) throw new Error('Pinecone returned an empty embedding');
  return Array.from(values);
}

/** A job's stored vector in a space, or null if it was never embedded there. */
export async function fetchJobVector(id: string, space: Space = 'v1'): Promise<number[] | null> {
  const column = SPACE[space].job;
  const { data, error } = await createServerClient().from('jobs').select(column).eq('id', id).maybeSingle();
  if (error) throw new Error('Reading the job vector failed: ' + error.message);
  return parseEmbedding((data as Record<string, unknown> | null)?.[column]);
}

/** Similarity (on v1's scale) of a resume to specific jobs; jobs never embedded in the space are left out. */
export async function similarityTo(
  embedding: number[],
  ids: string[],
  space: Space = 'v1',
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const query_embedding = toVectorLiteral(embedding);
  for (let i = 0; i < ids.length; i += 500) {
    const { data, error } = await createServerClient().rpc(SPACE[space].similarity, {
      query_embedding,
      job_ids: ids.slice(i, i + 500),
    });
    if (error) throw new Error(SPACE[space].similarity + ' failed: ' + error.message);
    for (const r of (data || []) as { id: string; similarity: number }[]) out.set(r.id, calibrate(r.similarity, space));
  }
  return out;
}

type JobForVector = {
  id: string;
  title: string;
  description: string | null;
  company_name: string;
  skills: string[];
  location: string | null;
};

/** Save one vector; a failed save is retried once (writing the same vector twice is harmless). */
async function saveVector(supabase: ReturnType<typeof createServerClient>, id: string, column: string, vector: string) {
  for (let attempt = 0; ; attempt++) {
    const { error } = await supabase
      .from('jobs')
      .update({ [column]: vector })
      .eq('id', id);
    if (!error) return;
    if (attempt >= 1)
      throw new Error(
        'Saving job vectors failed: ' + error.message + (error.details ? ' · ' + error.details.slice(0, 300) : ''),
      );
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

/** Store vectors (ten saves at a time: fifty at once had connections reset, "fetch failed"). */
async function saveVectors(column: string, rows: { id: string; values: number[] }[]) {
  const supabase = createServerClient();
  for (let k = 0; k < rows.length; k += 10)
    await Promise.all(
      rows.slice(k, k + 10).map((r) => saveVector(supabase, r.id, column, toVectorLiteral(Array.from(r.values)))),
    );
}

/** Embed jobs into one space and store the vectors. v2 with `wait: false` stops at the first quota answer. */
async function embedJobs(jobs: JobForVector[], space: Space, wait = true): Promise<number> {
  let done = 0;
  for (let i = 0; i < jobs.length; i += 50) {
    const batch = jobs.slice(i, i + 50);
    let vectors: number[][];
    if (space === 'v1') {
      const res = await embedPassages(batch.map((j) => jobText(j)));
      vectors = res.data.map((d) => (d as { values: number[] }).values);
    } else {
      try {
        vectors = await embedGemini(
          batch.map((j) => jobText(j, JD_CHARS_V2)),
          'RETRIEVAL_DOCUMENT',
          { wait },
        );
      } catch (err) {
        if (err instanceof EmbedQuotaError && done) return done; // keep what was stored; the backfill does the rest
        throw err;
      }
    }
    await saveVectors(
      SPACE[space].job,
      batch.map((j, idx) => ({ id: j.id, values: vectors[idx] })),
    );
    done += batch.length;
    console.log('[EMBED]', space, 'stored', done, 'of', jobs.length);
  }
  return done;
}

/**
 * New jobs from a scrape: v1 always (the fallback space), v2 as far as this minute's Gemini budget goes without
 * waiting. Jobs left without a v2 vector are embedded by the backfill.
 */
export async function upsertJobVectors(jobs: JobForVector[]) {
  await embedJobs(jobs, 'v1');
  await embedJobs(jobs, 'v2', false).catch((e) => {
    if (!(e instanceof EmbedQuotaError)) console.error('[EMBED] v2 skipped:', e instanceof Error ? e.message : e);
  });
}

/**
 * Embed open jobs that have no vector in a space yet. Returns how many were embedded; `max` keeps one call inside the
 * function time limit. Vault and Discovery jobs (anyone's saved or new match) go first.
 */
export async function backfillEmbeddings(max = 500, space: Space = 'v1'): Promise<number> {
  const supabase = createServerClient();
  const column = SPACE[space].job;
  const select = 'id, title, description, skills, location, employer, companies!inner(name)';
  const { data: matched } = await supabase
    .from('match_scores')
    .select('job_id')
    .in('status', ['saved', 'new'])
    .limit(5000);
  const preferred = [...new Set((matched || []).map((m) => m.job_id as string))];
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < preferred.length && rows.length < max; i += 200) {
    const { data, error } = await supabase
      .from('jobs')
      .select(select)
      .eq('is_active', true)
      .is(column, null)
      .in('id', preferred.slice(i, i + 200))
      .limit(max - rows.length);
    if (error) throw new Error('Reading jobs to embed failed: ' + error.message);
    rows.push(...(data || []));
  }
  if (rows.length < max) {
    const { data, error } = await supabase
      .from('jobs')
      .select(select)
      .eq('is_active', true)
      .is(column, null)
      .limit(max);
    if (error) throw new Error('Reading jobs to embed failed: ' + error.message);
    const have = new Set(rows.map((r) => r.id));
    for (const r of data || []) if (!have.has(r.id) && rows.length < max) rows.push(r);
  }
  const jobs = rows.map((j) => {
    const c = j.companies as { name: string } | { name: string }[];
    return {
      id: j.id as string,
      title: j.title as string,
      description: j.description as string | null,
      skills: (j.skills as string[] | null) || [],
      location: j.location as string | null,
      company_name: (j.employer as string | null) || (Array.isArray(c) ? c[0]?.name : c.name) || '',
    };
  });
  return embedJobs(jobs, space);
}

/** The open jobs nearest to a resume, with similarities on v1's scale. */
export async function searchSimilarJobs(resumeEmbedding: number[], topK: number = 50, space: Space = 'v1') {
  const { data, error } = await createServerClient().rpc(SPACE[space].match, {
    query_embedding: toVectorLiteral(resumeEmbedding),
    match_count: topK,
  });
  if (error) throw new Error(SPACE[space].match + ' failed: ' + error.message);
  return ((data || []) as { id: string; similarity: number }[]).map((r) => ({
    id: r.id,
    score: calibrate(r.similarity, space),
  }));
}
