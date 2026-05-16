-- ============================
-- RADAR — Vector Migration (1024-dim)
-- ============================
-- Run this in Supabase SQL Editor

-- 1. Alter user_profiles table to store 1024-dimension embeddings
ALTER TABLE user_profiles ALTER COLUMN resume_embedding TYPE vector(1024);

-- 2. Alter jobs table to store 1024-dimension embeddings
ALTER TABLE jobs ALTER COLUMN embedding TYPE vector(1024);
