// ============================
// RADAR --- AI Embeddings via Pinecone Inference
// ============================
// Uses Pinecone's built-in embedding model (multilingual-e5-large)
// 384-dimension vectors, cosine similarity

import { Pinecone } from '@pinecone-database/pinecone';

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'radar-jobs';

export function getIndex() {
  return pc.index(INDEX_NAME);
}

/**
 * Generate embedding for a text using Pinecone's inference API
 */
export async function embedText(text: string): Promise<number[]> {
  const cleanText = text.replace(/\s+/g, ' ').trim().substring(0, 8000);

  const response = await pc.inference.embed({ model: 'multilingual-e5-large', inputs: [cleanText], parameters: {
    inputType: 'passage',
    truncate: 'END',
  } });

  return Array.from((response.data[0] as any).values as number[]);
}

/**
 * Upsert job vectors to Pinecone index
 */
export async function upsertJobVectors(
  jobs: Array<{ id: string; title: string; description: string | null; company_name: string; skills: string[]; location: string | null }>
) {
  const index = getIndex();
  const batchSize = 50;

  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    const texts = batch.map(j => {
      const parts = [j.title, j.company_name];
      if (j.skills.length) parts.push('Skills: ' + j.skills.join(', '));
      if (j.location) parts.push('Location: ' + j.location);
      if (j.description) parts.push(j.description.substring(0, 2000));
      return parts.join(' | ');
    });

    const embeddings = await pc.inference.embed({ model: 'multilingual-e5-large', inputs: texts, parameters: {
      inputType: 'passage',
      truncate: 'END',
    } });

    const vectors = batch.map((j, idx) => ({
      id: j.id,
      values: Array.from((embeddings.data[idx] as any).values as number[]),
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

/**
 * Search Pinecone for jobs matching a resume
 */
export async function searchSimilarJobs(resumeEmbedding: number[], topK: number = 50) {
  const index = getIndex();

  const results = await index.query({
    vector: resumeEmbedding,
    topK,
    includeMetadata: true,
  });

  return results.matches || [];
}

