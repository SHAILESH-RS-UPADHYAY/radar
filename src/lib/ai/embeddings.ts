import { createHash } from 'node:crypto';
import { Pinecone } from '@pinecone-database/pinecone';
import { env, readEnv } from '@/lib/env';

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

export function getIndex() {
  return getPinecone().index(env.pineconeIndex());
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
 * e5-large passage embeddings. Many new jobs at once can hit Pinecone's tokens-per-minute limit, which the SDK
 * reports as an unexpected error: wait and try again (8s, then 16s) before giving up. A rejected key fails at once.
 */
async function embedPassages(inputs: string[]) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getPinecone().inference.embed({
        model: 'multilingual-e5-large',
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

/** A job's stored vector, or null if it was never embedded (or has been removed). */
export async function fetchJobVector(id: string): Promise<number[] | null> {
  const { records } = await getIndex().fetch({ ids: [id] });
  const values = records[id]?.values;
  return values?.length ? Array.from(values) : null;
}

/** Cosine similarity of a resume to specific jobs (by their stored vectors); jobs never embedded are left out. */
export async function similarityTo(embedding: number[], ids: string[]): Promise<Map<string, number>> {
  const norm = (v: ArrayLike<number>) => Math.sqrt(Array.from(v).reduce((s, x) => s + x * x, 0)) || 1;
  const mine = norm(embedding);
  const out = new Map<string, number>();
  // Small batches: fetch puts the ids in the URL, and a long one fails.
  for (let i = 0; i < ids.length; i += 100) {
    const { records } = await getIndex().fetch({ ids: ids.slice(i, i + 100) });
    for (const [id, r] of Object.entries(records)) {
      const v = r.values;
      if (!v?.length) continue;
      let dot = 0;
      for (let k = 0; k < v.length; k++) dot += v[k] * (embedding[k] || 0);
      out.set(id, dot / (norm(v) * mine));
    }
  }
  return out;
}

/** Drop vectors of closed jobs so they stop taking top-K slots in searchSimilarJobs. */
export async function deleteJobVectors(ids: string[]) {
  const index = getIndex();
  for (let i = 0; i < ids.length; i += 1000) await index.deleteMany({ ids: ids.slice(i, i + 1000) });
}

export async function upsertJobVectors(
  jobs: Array<{
    id: string;
    title: string;
    description: string | null;
    company_name: string;
    skills: string[];
    location: string | null;
  }>,
) {
  const pc = getPinecone();
  const index = pc.index(env.pineconeIndex());
  const batchSize = 50;

  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    const texts = batch.map((j) => {
      const parts = [j.title, j.company_name];
      if (j.skills.length) parts.push('Skills: ' + j.skills.join(', '));
      if (j.location) parts.push('Location: ' + j.location);
      if (j.description) parts.push(j.description.substring(0, 2000));
      return parts.join(' | ');
    });

    const embeddings = await embedPassages(texts);

    const vectors = batch.map((j, idx) => ({
      id: j.id,
      values: Array.from((embeddings.data[idx] as { values: number[] }).values as number[]),
      metadata: {
        title: j.title,
        company: j.company_name,
        skills: j.skills.join(','),
        location: j.location || 'Not specified',
      },
    }));

    await index.upsert({ records: vectors });
    console.log('[EMBED] Upserted batch', Math.floor(i / batchSize) + 1, '(' + vectors.length + ' vectors)');
  }
}

export async function searchSimilarJobs(resumeEmbedding: number[], topK: number = 50) {
  const index = getIndex();
  const results = await index.query({
    vector: resumeEmbedding,
    topK,
    includeMetadata: true,
  });
  return results.matches || [];
}
