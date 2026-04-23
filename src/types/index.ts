// ============================
// RADAR — Core Type Definitions
// ============================

export type ATSProvider = 'greenhouse' | 'lever' | 'ashby' | 'workday' | 'custom';
export type CompanyCategory = 'MNC' | 'Growth' | 'Startup';
export type WorkType = 'remote' | 'hybrid' | 'in-office';
export type ExperienceLevel = 'fresher' | '0-1' | '1-3' | '3-5' | '5+';
export type UserTier = 'free' | 'pro';
export type JobSection = 'dream' | 'recommended' | 'startup';
export type SortMode = 'match' | 'location' | 'pay' | 'remote';

export interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  careers_url: string;
  ats_provider: ATSProvider | null;
  ats_identifier: string | null;
  category: CompanyCategory;
  country: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  last_scraped_at: string | null;
  is_active: boolean;
}

export interface Job {
  id: string;
  company_id: string;
  company?: Company;
  external_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  work_type: WorkType | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  experience_required: ExperienceLevel | null;
  skills: string[];
  apply_url: string;
  department: string | null;
  is_active: boolean;
  scraped_at: string;
}

export interface UserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  is_fresher: boolean;
  experience_years: number;
  skills: string[];
  location: string | null;
  lat: number | null;
  lng: number | null;
  country: string;
  resume_url: string | null;
  resume_text: string | null;
  tier: UserTier;
  stripe_customer_id: string | null;
  subscription_expires_at: string | null;
  created_at: string;
}

export interface MatchScore {
  id: string;
  user_id: string;
  job_id: string;
  job?: Job;
  score: number;
  reasoning: string | null;
  matching_skills: string[];
  missing_skills: string[];
  section: JobSection;
  computed_at: string;
}

export interface ScrapeLog {
  id: string;
  company_id: string;
  status: 'success' | 'failed' | 'partial';
  jobs_found: number;
  error_message: string | null;
  duration_ms: number;
  scraped_at: string;
}

// Dashboard display types
export interface JobCard {
  job: Job;
  company: Company;
  matchScore: number;
  matchingSkills: string[];
  missingSkills: string[];
  distance_km: number | null;
}

export interface DashboardSection {
  title: string;
  section: JobSection;
  icon: string;
  jobs: JobCard[];
  sortMode: SortMode;
}
