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
  | 'workday'
  | 'amazon';
export type BoardProvider = 'hackernews' | 'remotive' | 'remoteok' | 'arbeitnow' | 'himalayas';
export type Provider = AtsProvider | BoardProvider | 'custom';

export type CompanyCategory = 'MNC' | 'Growth' | 'Startup' | 'Board';
export type WorkType = 'remote' | 'hybrid' | 'in-office';
export type ExperienceLevel = 'fresher' | '0-1' | '1-3' | '3-5' | '5+';
export type JobSection = 'dream' | 'recommended' | 'startup';
export type MatchStatus = 'new' | 'saved' | 'applied' | 'dismissed';

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
  last_matched_at: string | null;
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
}
