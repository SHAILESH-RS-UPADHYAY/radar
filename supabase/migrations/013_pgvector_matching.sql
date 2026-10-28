-- 013: job search moves from the Pinecone index to pgvector in Supabase.
-- Pinecone's free plan allows 1 GB of reads a month and RADAR used it up (2026-10-27), which stopped every match.
-- Pinecone now only turns text into vectors (inference); the vectors live in jobs.embedding and are searched here.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- No vector index, on purpose (measured 2026-10-28, 9,148 open jobs): an HNSW index made every job update cost about
-- 80 ms (48 rows took 3.8 s, so scrape upserts hit the 8 s statement timeout), while an exact scan takes 0.5 s warm
-- and 5.4 s cold, once per user per run, and always returns all match_count rows.
-- ponytail: exact scan; past ~50k open jobs add an IVFFlat index (cheap inserts) and set ivfflat.probes in match_jobs.
DROP INDEX IF EXISTS jobs_embedding_hnsw;

-- The open jobs nearest to a resume (cosine). Closed jobs keep their row but never reach a match.
CREATE OR REPLACE FUNCTION match_jobs(query_embedding vector(1024), match_count int DEFAULT 400)
RETURNS TABLE (id uuid, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT j.id, 1 - (j.embedding <=> query_embedding) AS similarity
  FROM jobs j
  WHERE j.is_active AND j.embedding IS NOT NULL
  ORDER BY j.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- A resume's similarity to specific jobs (your cities, your alert emails), wherever they rank.
CREATE OR REPLACE FUNCTION job_similarity(query_embedding vector(1024), job_ids uuid[])
RETURNS TABLE (id uuid, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT j.id, 1 - (j.embedding <=> query_embedding) AS similarity
  FROM jobs j
  WHERE j.id = ANY (job_ids) AND j.embedding IS NOT NULL;
$$;
