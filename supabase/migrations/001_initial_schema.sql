-- ============================
-- RADAR — Database Migration
-- ============================
-- Run this in Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================
-- COMPANIES TABLE
-- ============================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  careers_url TEXT NOT NULL,
  ats_provider TEXT CHECK (ats_provider IN ('greenhouse', 'lever', 'ashby', 'workday', 'custom')),
  ats_identifier TEXT,
  category TEXT NOT NULL CHECK (category IN ('MNC', 'Growth', 'Startup')),
  country TEXT DEFAULT 'India',
  city TEXT,
  lat FLOAT,
  lng FLOAT,
  last_scraped_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================
-- JOBS TABLE
-- ============================
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  external_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  work_type TEXT CHECK (work_type IN ('remote', 'hybrid', 'in-office')),
  salary_min INT,
  salary_max INT,
  salary_currency TEXT DEFAULT 'INR',
  experience_required TEXT CHECK (experience_required IN ('fresher', '0-1', '1-3', '3-5', '5+')),
  skills TEXT[] DEFAULT '{}',
  apply_url TEXT NOT NULL,
  department TEXT,
  embedding vector(384),
  is_active BOOLEAN DEFAULT true,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE(company_id, external_id)
);

-- ============================
-- USER PROFILES TABLE
-- ============================
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  email TEXT,
  phone TEXT,
  full_name TEXT,
  is_fresher BOOLEAN DEFAULT true,
  experience_years INT DEFAULT 0,
  skills TEXT[] DEFAULT '{}',
  location TEXT,
  lat FLOAT,
  lng FLOAT,
  country TEXT DEFAULT 'India',
  resume_url TEXT,
  resume_text TEXT,
  resume_embedding vector(384),
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  razorpay_subscription_id TEXT,
  paypal_subscription_id TEXT,
  subscription_expires_at TIMESTAMPTZ,
  free_trial_used BOOLEAN DEFAULT false,
  free_trial_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================
-- USER DREAM COMPANIES
-- ============================
CREATE TABLE IF NOT EXISTS user_dream_companies (
  user_id TEXT REFERENCES user_profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, company_id)
);

-- ============================
-- MATCH SCORES
-- ============================
CREATE TABLE IF NOT EXISTS match_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES user_profiles(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  score INT CHECK (score >= 0 AND score <= 100),
  reasoning TEXT,
  matching_skills TEXT[] DEFAULT '{}',
  missing_skills TEXT[] DEFAULT '{}',
  section TEXT CHECK (section IN ('dream', 'recommended', 'startup')),
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, job_id)
);

-- ============================
-- SCRAPE LOGS
-- ============================
CREATE TABLE IF NOT EXISTS scrape_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('success', 'failed', 'partial')),
  jobs_found INT DEFAULT 0,
  error_message TEXT,
  duration_ms INT,
  scraped_at TIMESTAMPTZ DEFAULT now()
);

-- ============================
-- INDEXES
-- ============================
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_active ON jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_work_type ON jobs(work_type);
CREATE INDEX IF NOT EXISTS idx_match_user ON match_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_match_section ON match_scores(section);
CREATE INDEX IF NOT EXISTS idx_match_score ON match_scores(score DESC);

-- ============================
-- ROW LEVEL SECURITY
-- ============================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_dream_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_scores ENABLE ROW LEVEL SECURITY;

-- Companies and jobs are public (read)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Companies are viewable by everyone"
  ON companies FOR SELECT USING (true);

CREATE POLICY "Jobs are viewable by everyone"
  ON jobs FOR SELECT USING (true);

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT USING (id = current_setting('request.jwt.claims')::json->>'sub');

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE USING (id = current_setting('request.jwt.claims')::json->>'sub');

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT WITH CHECK (id = current_setting('request.jwt.claims')::json->>'sub');

CREATE POLICY "Users can view own dream companies"
  ON user_dream_companies FOR ALL USING (user_id = current_setting('request.jwt.claims')::json->>'sub');

CREATE POLICY "Users can view own match scores"
  ON match_scores FOR SELECT USING (user_id = current_setting('request.jwt.claims')::json->>'sub');
