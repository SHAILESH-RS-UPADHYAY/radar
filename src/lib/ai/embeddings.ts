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
export function jobText(j: {
  title: string;
  company_name: string;
  skills: string[];
  location: string | null;
  description: string | null;
}): string {
  const parts = [j.title, j.company_name];
  if (j.skills.length) parts.push('Skills: ' + j.skills.join(', '));
  if (j.location) parts.push('Location: ' + j.location);
  if (j.description) parts.push(j.description.replace(/\s+/g, ' ').trim().substring(0, JD_CHARS));
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

export async function embedText(text: string): Promise<number[]> {
  const response = await embedPassages([text.replace(/\s+/g, ' ').trim().substring(0, 8000)]);
  const values = (response.data[0] as { values: number[] }).values;
  if (!values?.length) throw new Error('Pinecone returned an empty embedding');
  return Array.from(values);
}

/** A job's stored vector, or null if it was never embedded. */
export async function fetchJobVector(id: string): Promise<number[] | null> {
  const { data, error } = await createServerClient().from('jobs').select('embedding').eq('id', id).maybeSingle();
  if (error) throw new Error('Reading the job vector failed: ' + error.message);
  return parseEmbedding(data?.embedding);
}

/** Cosine similarity of a resume to specific jobs (pgvector, migration 013); jobs never embedded are left out. */
export async function similarityTo(embedding: number[], ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const query_embedding = toVectorLiteral(embedding);
  for (let i = 0; i < ids.length; i += 500) {
    const { data, error } = await createServerClient().rpc('job_similarity', {
      query_embedding,
      job_ids: ids.slice(i, i + 500),
    });
    if (error) throw new Error('job_similarity failed: ' + error.message);
    for (const r of (data || []) as { id: string; similarity: number }[]) out.set(r.id, r.similarity);
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
async function saveVector(supabase: ReturnType<typeof createServerClient>, id: string, embedding: string) {
  for (let attempt = 0; ; attempt++) {
    const { error } = await supabase.from('jobs').update({ embedding }).eq('id', id);
    if (!error) return;
    if (attempt >= 1)
      throw new Error(
        'Saving job vectors failed: ' + error.message + (error.details ? ' · ' + error.details.slice(0, 300) : ''),
      );
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

/** Embed jobs with Pinecone inference and store each vector in jobs.embedding. */
export async function upsertJobVectors(jobs: JobForVector[]) {
  const supabase = createServerClient();
  for (let i = 0; i < jobs.length; i += 50) {
    const batch = jobs.slice(i, i + 50);
    const embeddings = await embedPassages(batch.map(jobText));
    const vectors = batch.map((j, idx) => ({
      id: j.id,
      embedding: toVectorLiteral(Array.from((embeddings.data[idx] as { values: number[] }).values)),
    }));
    // Ten saves at a time: fifty at once had connections reset after a few thousand jobs ("fetch failed").
    for (let k = 0; k < vectors.length; k += 10)
      await Promise.all(vectors.slice(k, k + 10).map((v) => saveVector(supabase, v.id, v.embedding)));
    console.log('[EMBED] Stored batch', i / 50 + 1, '(' + batch.length + ' vectors)');
  }
}

/**
 * Embed open jobs that have no vector yet (all of them right after migration 013, then only the odd miss).
 * Returns how many were embedded; `max` keeps one call inside the function time limit.
 */
export async function backfillEmbeddings(max = 500): Promise<number> {
  const { data, error } = await createServerClient()
    .from('jobs')
    .select('id, title, description, skills, location, employer, companies!inner(name)')
    .eq('is_active', true)
    .is('embedding', null)
    .limit(max);
  if (error) throw new Error('Reading jobs to embed failed: ' + error.message);
  const jobs = (data || []).map((j) => {
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
  await upsertJobVectors(jobs);
  return jobs.length;
}

/** The open jobs nearest to a resume (pgvector, migration 013). */
export async function searchSimilarJobs(resumeEmbedding: number[], topK: number = 50) {
  const { data, error } = await createServerClient().rpc('match_jobs', {
    query_embedding: toVectorLiteral(resumeEmbedding),
    match_count: topK,
  });
  if (error) throw new Error('match_jobs failed: ' + error.message);
  return ((data || []) as { id: string; similarity: number }[]).map((r) => ({ id: r.id, score: r.similarity }));
}
