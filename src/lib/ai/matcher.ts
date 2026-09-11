// ============================
// RADAR — AI Job Matcher
// ============================
// Composite: 60% vector similarity + 40% skill overlap, then a seniority penalty.

import { normalizeSkill } from '@/lib/scraper/utils';
import { cityAliases } from '@/lib/geo/city-companies';

export interface MatchResult {
  score: number;
  reasoning: string;
  matchingSkills: string[];
  missingSkills: string[];
  section: 'dream' | 'recommended' | 'startup';
}

// multilingual-e5-large cosine scores are compressed: unrelated text still lands around 0.7,
// strong matches around 0.85–0.9. Stretch that band onto 0–100 so the score spreads out.
// Tune these after looking at real scores (they are logged by the match pipeline).
const SIM_FLOOR = Number(process.env.RADAR_SIM_FLOOR || 0.72);
const SIM_CEIL = Number(process.env.RADAR_SIM_CEIL || 0.88);

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
}

/** +5 in one of your cities, -10 remote you did not ask for, -25 elsewhere. */
function locationFit(input: MatchInput): { delta: number; note: string } {
  const cities = (input.userCities || []).map((c) => c.trim()).filter(Boolean);
  if (!cities.length) return { delta: 0, note: '' };
  const wantsRemote = cities.some((c) => c.toLowerCase() === 'remote');
  const loc = (input.jobLocation || '').toLowerCase();
  const hit = cities
    .filter((c) => c.toLowerCase() !== 'remote')
    .find((c) => cityAliases(c).some((a) => loc.includes(a)));
  if (hit) return { delta: 5, note: 'In ' + hit };
  const isRemote = input.jobWorkType === 'remote' || loc.includes('remote');
  if (isRemote) return wantsRemote ? { delta: 3, note: 'Remote' } : { delta: -10, note: 'Remote (not in your cities)' };
  return { delta: -25, note: 'Outside your cities' };
}

export function computeMatchScore(input: MatchInput): MatchResult {
  const userSkills = new Set(input.userSkills.map(normalizeSkill));
  const jobSkills = [...new Set(input.jobSkills.map(normalizeSkill))];

  const matchingSkills = jobSkills.filter((s) => userSkills.has(s));
  const missingSkills = jobSkills.filter((s) => !userSkills.has(s));

  // No listed skills → neutral rather than zero
  const skillScore = jobSkills.length > 0 ? (matchingSkills.length / jobSkills.length) * 100 : 50;
  const vectorScore = vectorToScore(input.vectorSimilarity);
  let score = vectorScore * 0.6 + skillScore * 0.4;

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

  const finalScore = Math.round(Math.max(0, Math.min(100, score)));

  const section: MatchResult['section'] = input.isDreamCompany
    ? 'dream'
    : input.companyCategory === 'Startup'
      ? 'startup'
      : 'recommended';

  const parts: string[] = [];
  if (jobSkills.length) parts.push('Matches ' + matchingSkills.length + '/' + jobSkills.length + ' listed skills');
  if (missingSkills.length > 0 && missingSkills.length <= 4) parts.push('Missing: ' + missingSkills.join(', '));
  if (vectorScore >= 70) parts.push('Strong resume-JD alignment');
  else if (vectorScore >= 45) parts.push('Good resume-JD alignment');
  else parts.push('Weak resume-JD alignment');
  if (seniorityNote) parts.push(seniorityNote);
  if (loc.note) parts.push(loc.note);

  return {
    score: finalScore,
    reasoning: parts.join('. '),
    matchingSkills,
    missingSkills,
    section,
  };
}
