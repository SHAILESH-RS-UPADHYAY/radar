import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '@/lib/env';

function getPinecone() {
  return new Pinecone({ apiKey: env.pineconeApiKey() });
}

/** A rejected key is a deployment problem, not the user's: name the variable to fix. */
export function explainVectorError(err: unknown): string | null {
  const e = err as { name?: string; message?: string } | null;
  if (e?.name === 'PineconeAuthorizationError' || /api key you provided was rejected/i.test(e?.message || ''))
    return "Job search is offline: Pinecone rejected the server's PINECONE_API_KEY. Set the exact key (no quotes) in Vercel → Settings → Environment Variables, then redeploy.";
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

export async function embedText(text: string): Promise<number[]> {
  const pc = getPinecone();
  const cleanText = text.replace(/\s+/g, ' ').trim().substring(0, 8000);

  const response = await pc.inference.embed({
    model: 'multilingual-e5-large',
    inputs: [cleanText],
    parameters: {
      inputType: 'passage',
      truncate: 'END',
    },
  });

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

    const embeddings = await pc.inference.embed({
      model: 'multilingual-e5-large',
      inputs: texts,
      parameters: {
        inputType: 'passage',
        truncate: 'END',
      },
    });

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
