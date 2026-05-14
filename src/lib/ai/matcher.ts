// ============================
// RADAR — AI Job Matcher
// ============================
// Computes match scores between user profile and jobs
// Composite: 60% vector similarity + 40% skill overlap

export interface MatchResult {
  jobId: string;
  score: number;
  reasoning: string;
  matchingSkills: string[];
  missingSkills: string[];
  section: 'dream' | 'recommended' | 'startup';
}

/**
 * Compute match score between a user and a job
 */
export function computeMatchScore(
  userSkills: string[],
  jobSkills: string[],
  vectorSimilarity: number,
  isDreamCompany: boolean,
  companyCategory: string,
): MatchResult {
  // Skill overlap scoring
  const userSkillsLower = userSkills.map(s => s.toLowerCase());
  const jobSkillsLower = jobSkills.map(s => s.toLowerCase());

  const matchingSkills = jobSkillsLower.filter(s => userSkillsLower.includes(s));
  const missingSkills = jobSkillsLower.filter(s => !userSkillsLower.includes(s));

  const skillScore = jobSkillsLower.length > 0
    ? (matchingSkills.length / jobSkillsLower.length) * 100
    : 50; // If no skills listed, neutral score

  // Composite score: 60% vector + 40% skill
  const vectorScore = Math.max(0, vectorSimilarity * 100);
  const compositeScore = Math.round(vectorScore * 0.6 + skillScore * 0.4);
  const finalScore = Math.min(100, Math.max(0, compositeScore));

  // Section assignment
  let section: 'dream' | 'recommended' | 'startup';
  if (isDreamCompany) {
    section = 'dream';
  } else if (companyCategory === 'Startup') {
    section = 'startup';
  } else {
    section = 'recommended';
  }

  // Reasoning
  const parts: string[] = [];
  if (matchingSkills.length > 0) {
    parts.push('Matches ' + matchingSkills.length + '/' + jobSkillsLower.length + ' required skills');
  }
  if (missingSkills.length > 0 && missingSkills.length <= 3) {
    parts.push('Missing: ' + missingSkills.join(', '));
  }
  if (vectorSimilarity > 0.8) {
    parts.push('Strong resume-JD alignment');
  } else if (vectorSimilarity > 0.6) {
    parts.push('Good resume-JD alignment');
  }
  const reasoning = parts.join('. ') || 'Based on overall profile match';

  return {
    jobId: '',
    score: finalScore,
    reasoning,
    matchingSkills,
    missingSkills,
    section,
  };
}

