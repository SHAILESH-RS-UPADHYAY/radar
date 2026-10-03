// ============================
// RADAR — AI Job Matcher
// ============================
// Composite: 60% vector similarity + 40% skill overlap, then role, seniority and location adjustments.

import { normalizeSkill } from '@/lib/scraper/utils';
import { placeFit } from '@/lib/geo/city-companies';

export interface MatchResult {
  score: number;
  reasoning: string;
  matchingSkills: string[];
  missingSkills: string[];
  section: 'dream' | 'recommended' | 'startup';
  /** The role asks for clearly more experience than you have; never auto-vaulted. */
  tooSenior: boolean;
}

// multilingual-e5-large cosine scores are compressed: unrelated text still lands around 0.7,
// strong matches around 0.85–0.9. Stretch that band onto 0–100 so the score spreads out.
// Tune these after looking at real scores (they are logged by the match pipeline).
export const SIM_FLOOR = Number(process.env.RADAR_SIM_FLOOR || 0.72);
export const SIM_CEIL = Number(process.env.RADAR_SIM_CEIL || 0.88);

export function vectorToScore(similarity: number): number {
  const scaled = (similarity - SIM_FLOOR) / (SIM_CEIL - SIM_FLOOR);
  return Math.max(0, Math.min(1, scaled)) * 100;
}

export interface MatchInput {
  userSkills: string[];
  jobSkills: string[];
  vectorSimilarity: number;
  isDreamCompany: boolean;
  companyCategory: string;
  userIsFresher: boolean;
  userExperienceYears: number;
  jobExperience: string | null;
  /** User target cities; "Remote" means remote roles are welcome. Empty = no location preference. */
  userCities?: string[];
  jobLocation?: string | null;
  jobWorkType?: string | null;
  /** Roles the user is aiming for, e.g. ["AI Engineer", "Software Engineer"]. */
  targetRoles?: string[];
  jobTitle?: string | null;
  /** When the posting went up (ISO); unknown = no freshness adjustment. */
  postedAt?: string | null;
  now?: number;
}

const SENIORITY_WORDS = new Set(['senior', 'sr', 'junior', 'jr', 'lead', 'staff', 'principal', 'i', 'ii', 'iii', 'iv']);
const titleTokens = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter(Boolean);

/** A target role matches when every word of it (ignoring seniority) appears in the job title. */
export function matchedRole(targetRoles: string[] | undefined, jobTitle: string | null | undefined): string | null {
  if (!targetRoles?.length || !jobTitle) return null;
  const title = new Set(titleTokens(jobTitle));
  return (
    targetRoles.find((role) => {
      const words = titleTokens(role).filter((w) => !SENIORITY_WORDS.has(w));
      return words.length > 0 && words.every((w) => title.has(w));
    }) ?? null
  );
}

/** +5 in one of your cities, -10 remote you did not ask for, -25 elsewhere. */
function locationFit(input: MatchInput): { delta: number; note: string } {
  const fit = placeFit(input.userCities || [], input.jobLocation, input.jobWorkType);
  switch (fit.kind) {
    case 'any':
      return { delta: 0, note: '' };
    case 'city':
      return { delta: 5, note: 'In ' + fit.city };
    case 'remote':
      return fit.wanted ? { delta: 3, note: 'Remote' } : { delta: -10, note: 'Remote (not in your cities)' };
    case 'elsewhere':
      return { delta: -25, note: 'Outside your cities' };
  }
}

/**
 * Early applicants get read: postings in their first 96 hours get a small lift, stale ones fade.
 * (TalentWorks: applying within 96h made an interview up to 8x more likely.)
 */
export function freshness(postedAt: string | null | undefined, now = Date.now()): { delta: number; note: string } {
  const posted = postedAt ? Date.parse(postedAt) : NaN;
  if (Number.isNaN(posted)) return { delta: 0, note: '' };
  const days = Math.max(0, Math.floor((now - posted) / 86_400_000));
  if (days <= 4) return { delta: 5, note: days === 0 ? 'Posted today' : 'Posted ' + days + 'd ago' };
  if (days > 90) return { delta: -10, note: 'Posted 90+ days ago' };
  if (days > 45) return { delta: -5, note: 'Posted 45+ days ago' };
  return { delta: 0, note: '' };
}

/** A role asking for clearly more experience than you have: the auto-vault and autopilot both leave it out. */
export function tooSeniorFor(jobExperience: string | null | undefined, years: number): boolean {
  return (jobExperience === '5+' && years < 4) || (jobExperience === '3-5' && years < 2);
}

export function computeMatchScore(input: MatchInput): MatchResult {
  const userSkills = new Set(input.userSkills.map(normalizeSkill));
  const jobSkills = [...new Set(input.jobSkills.map(normalizeSkill))];

  const matchingSkills = jobSkills.filter((s) => userSkills.has(s));
  const missingSkills = jobSkills.filter((s) => !userSkills.has(s));

  // Without skills on both sides there is nothing to compare, so rank on semantics alone.
  // (A fixed "neutral" skill score used to lift non-tech jobs, which list no tech skills, above real matches.)
  const vectorScore = vectorToScore(input.vectorSimilarity);
  const comparable = jobSkills.length > 0 && userSkills.size > 0;
  let score = comparable ? vectorScore * 0.6 + (matchingSkills.length / jobSkills.length) * 100 * 0.4 : vectorScore;

  const role = matchedRole(input.targetRoles, input.jobTitle);
  if (role) score += 10;

  // Seniority fit
  const years = input.userIsFresher ? 0 : input.userExperienceYears;
  let seniorityNote = '';
  if (input.jobExperience === '5+' && years < 4) {
    score -= 30;
    seniorityNote = 'Senior role (5+ yrs)';
  } else if (input.jobExperience === '3-5' && years < 2) {
    score -= 15;
    seniorityNote = 'Asks for 3-5 yrs';
  } else if ((input.jobExperience === 'fresher' || input.jobExperience === '0-1') && years <= 2) {
    score += 5;
    seniorityNote = 'Entry-level friendly';
  }

  const loc = locationFit(input);
  score += loc.delta;

  const fresh = freshness(input.postedAt, input.now);
  score += fresh.delta;

  const finalScore = Math.round(Math.max(0, Math.min(100, score)));

  const section: MatchResult['section'] = input.isDreamCompany
    ? 'dream'
    : input.companyCategory === 'Startup'
      ? 'startup'
      : 'recommended';

  const parts: string[] = [];
  if (role) parts.push('Title matches ' + role);
  if (comparable) parts.push('Matches ' + matchingSkills.length + '/' + jobSkills.length + ' listed skills');
  if (missingSkills.length > 0 && missingSkills.length <= 4) parts.push('Missing: ' + missingSkills.join(', '));
  if (vectorScore >= 70) parts.push('Strong resume-JD alignment');
  else if (vectorScore >= 45) parts.push('Good resume-JD alignment');
  else parts.push('Weak resume-JD alignment');
  if (seniorityNote) parts.push(seniorityNote);
  if (loc.note) parts.push(loc.note);
  if (fresh.note) parts.push(fresh.note);

  return {
    score: finalScore,
    reasoning: parts.join('. '),
    matchingSkills,
    missingSkills,
    section,
    tooSenior: tooSeniorFor(input.jobExperience, years),
  };
}
