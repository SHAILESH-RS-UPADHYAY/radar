/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js';
import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.index('radar-jobs');

async function main() {
  console.log('Fetching jobs from Supabase...');
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, title, description, skills, location, companies(name)')
    .eq('is_active', true);

  if (error || !jobs) {
    console.error('Failed to fetch jobs:', error);
    return;
  }

  console.log('Found ' + jobs.length + ' jobs. Generating embeddings...');

  const batchSize = 50;
  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    
    const texts = batch.map(j => {
      const companyName = Array.isArray(j.companies) ? j.companies[0]?.name : (j.companies as any)?.name;
      const parts = [j.title, companyName || 'Unknown Company'];
      if (j.skills?.length) parts.push('Skills: ' + j.skills.join(', '));
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
      }
    });

    const vectors = batch.map((j, idx) => {
      const companyName = Array.isArray(j.companies) ? j.companies[0]?.name : (j.companies as any)?.name;
      const embeddingData = embeddings.data[idx] as any;
      return {
        id: j.id.toString(),
        values: Array.from(embeddingData.values as number[]),
        metadata: {
          title: j.title,
          company: companyName || 'Unknown',
          skills: j.skills?.join(',') || '',
          location: j.location || 'Not specified',
        },
      };
    });

    if (vectors.length > 0) {
      await index.upsert({ records: vectors });
      console.log('[EMBED] Upserted batch ' + (Math.floor(i / batchSize) + 1) + ' of ' + Math.ceil(jobs.length / batchSize));
    }
  }
  
  console.log('Done!');
}

main().catch(console.error);
