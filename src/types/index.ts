// ============================
// RADAR — Domain types shared by the pages, the API and the pipeline
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
  | 'amazon'
  | 'eightfold';
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
  'weworkremotely',
  'workingnomads',
  'hasjob',
  'indeed_email',
  'linkedin_email',
  'wttj_email',
  'jsearch',
  'googlejobs',
] as const;
export type BoardProvider = (typeof BOARD_PROVIDERS)[number];

/**
 * Roles per company: your applications plus what RADAR holds for you there. At two, a company's other roles leave
 * the Vault and Discovery, so one employer (ElevenLabs, Amazon) never floods your lists or gets a third application.
 */
export const PER_COMPANY = 2;
export type Provider = AtsProvider | BoardProvider | 'custom';

export type CompanyCategory = 'MNC' | 'Growth' | 'Startup' | 'Board';
export type WorkType = 'remote' | 'hybrid' | 'in-office';
export type ExperienceLevel = 'fresher' | '0-1' | '1-3' | '3-5' | '5+';
export type MatchStatus = 'new' | 'saved' | 'applied' | 'dismissed';

/** Where an application stands (C2 · OPS). Only matches with status 'applied' have one. */
export const STAGES = ['applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn'] as const;
export type Stage = (typeof STAGES)[number];

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
  /** What application forms ask (migration 009); null until that migration has run. */
  application_kit: ApplicationKit | null;
}

/** Answers application forms ask for again and again, saved once. Every value is plain text; '' = not set. */
export interface ApplicationKit {
  phone: string;
  current_company: string;
  current_title: string;
  notice_period: string;
  current_ctc: string;
  expected_ctc: string;
  currency: string;
  work_authorization: string;
  needs_sponsorship: '' | 'yes' | 'no';
  willing_to_relocate: '' | 'yes' | 'no';
  gender: string;
  pronouns: string;
  veteran_status: string;
  disability_status: string;
  /** Facts and phrasing in the candidate's own words, for AI-drafted answers. */
  voice_notes: string;
  /** Answers you taught RADAR from a form ("What is your current salary?" → "12 LPA"), by question. */
  learned?: Record<string, string>;
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
