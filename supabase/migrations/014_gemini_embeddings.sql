-- 014: a second vector space from Gemini (gemini-embedding-001, 768 dims, the JD up to 8,000 characters).
-- The first space (`embedding`, llama-text-embed-v2 via Pinecone inference, 1024 dims, the JD's first 800 characters)
-- keeps working until open jobs are covered here; matching then moves over by itself (activeSpace in embeddings.ts).
-- Vectors from different models cannot be compared, so the spaces never mix: each has its own columns and functions.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS embedding_v2 vector(768);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS resume_embedding_v2 vector(768);

-- The open jobs nearest to a resume (cosine), optionally only those whose location mentions a city. No vector index
-- on purpose, see 013.
CREATE OR REPLACE FUNCTION match_jobs_v2(query_embedding vector(768), match_count int DEFAULT 400, filter_city text DEFAULT NULL)
RETURNS TABLE (id uuid, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT j.id, 1 - (j.embedding_v2 <=> query_embedding) AS similarity
  FROM jobs j
  WHERE j.is_active AND j.embedding_v2 IS NOT NULL
    AND (filter_city IS NULL OR j.location ILIKE '%' || filter_city || '%')
  ORDER BY j.embedding_v2 <=> query_embedding
  LIMIT match_count;
$$;

-- A resume's similarity to specific jobs (your cities, your alert emails), wherever they rank.
CREATE OR REPLACE FUNCTION job_similarity_v2(query_embedding vector(768), job_ids uuid[])
RETURNS TABLE (id uuid, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT j.id, 1 - (j.embedding_v2 <=> query_embedding) AS similarity
  FROM jobs j
  WHERE j.id = ANY (job_ids) AND j.embedding_v2 IS NOT NULL;
$$;
