// ============================
// RADAR — Domain types (mirror supabase/migrations/*.sql)
// ============================

export type AtsProvider =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workable'
  | 'smartrecruiters'
  | 'recruitee'
  | 'personio'
  | 'breezy'
  | 'teamtailor'
  | 'workday'
  | 'amazon';
/** Sources that list many employers each; the real employer is stored on the job. */
export const BOARD_PROVIDERS = [
  'hackernews',
  'remotive',
  'remoteok',
  'arbeitnow',
  'himalayas',
  'jobicy',
  'themuse',
  'adzuna',
  'jooble',
] as const;
export type BoardProvider = (typeof BOARD_PROVIDERS)[number];
export type Provider = AtsProvider | BoardProvider | 'custom';

export type CompanyCategory = 'MNC' | 'Growth' | 'Startup' | 'Board';
export type WorkType = 'remote' | 'hybrid' | 'in-office';
export type ExperienceLevel = 'fresher' | '0-1' | '1-3' | '3-5' | '5+';
export type JobSection = 'dream' | 'recommended' | 'startup';
export type MatchStatus = 'new' | 'saved' | 'applied' | 'dismissed';

/** Where an application stands (C2 · OPS). Only matches with status 'applied' have one. */
export const STAGES = ['applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn'] as const;
export type Stage = (typeof STAGES)[number];

export interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  careers_url: string;
  ats_provider: Provider | null;
  ats_identifier: string | null;
  category: CompanyCategory;
  country: string;
  city: string | null;
  last_scraped_at: string | null;
  is_active: boolean;
}

export interface Job {
  id: string;
  company_id: string;
  external_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  work_type: WorkType | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  experience_required: ExperienceLevel | null;
  skills: string[];
  apply_url: string;
  department: string | null;
  /** Real employer when the job came from a job board. */
  employer: string | null;
  posted_at: string | null;
  content_hash: string | null;
  is_active: boolean;
  scraped_at: string;
}

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  is_fresher: boolean;
  experience_years: number;
  skills: string[];
  /** Comma-separated target cities; may include "Remote". */
  location: string | null;
  /** Comma-separated target roles, e.g. "AI Engineer, Software Engineer". */
  current_role: string | null;
  country: string;
  resume_text: string | null;
  vault_min_score: number;
  auto_vault: boolean;
  last_matched_at: string | null;
  created_at: string;
}

/** GET /api/settings (and POST /api/settings/resume): the editable profile, without resume text or vectors. */
export interface SettingsProfile {
  full_name: string | null;
  location: string | null;
  is_fresher: boolean;
  experience_years: number;
  skills: string[];
  target_roles: string[];
  has_resume: boolean;
  /** Skills found in the resume; used for matching until the user confirms their own. */
  resume_skills: string[];
  vault_min_score: number;
  auto_vault: boolean;
  /** Auto-OVERCLOCK (migration 007); null until that migration has run. */
  auto_overclock: boolean | null;
  overclock_daily_cap: number;
  last_matched_at: string | null;
  /** Links and built projects (migration 008); null until that migration has run. */
  portfolio: Portfolio | null;
}

export interface PortfolioProject {
  name: string;
  url: string;
  /** One line: what you built or did there. */
  note: string;
}

export interface Portfolio {
  portfolio: string;
  github: string;
  linkedin: string;
  website: string;
  projects: PortfolioProject[];
}

export interface MatchScore {
  id: string;
  user_id: string;
  job_id: string;
  score: number;
  reasoning: string | null;
  matching_skills: string[];
  missing_skills: string[];
  section: JobSection;
  status: MatchStatus;
  auto_saved: boolean;
  status_changed_at: string | null;
  first_seen_at: string;
  computed_at: string;
  stage: Stage | null;
  stage_changed_at: string | null;
  applied_at: string | null;
  notes: string | null;
}
