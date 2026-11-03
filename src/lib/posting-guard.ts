// ============================
// RADAR — Posting guard and deal-breaker gate
// ============================
// A job description is text a stranger wrote, and it goes straight into the AI prompt. guardPosting strips what a
// reader never sees (zero-width and control characters) and pulls out lines that talk to an AI instead of a person,
// so OVERCLOCK writes from the posting, not from orders hidden inside it. gateJob turns the user's deal-breakers and
// languages into a hard "no" the scorer cannot outvote. Pure.

const INVISIBLE = /[​-‏‪-‮⁠-⁤﻿­]|[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
const INJECTION =
  /\b(ignore|disregard|forget)\b.{0,40}\b(previous|prior|above|all)\b.{0,20}\b(instructions?|prompts?|rules)\b|\b(you are|act as)\s+(an? )?(helpful )?(ai|assistant|language model|llm|chatgpt|claude|gemini)\b|\b(if you are|as) an? (ai|llm|language model)\b|\bsystem prompt\b|\bin your (reply|response|cover letter),? (include|mention|write)\b/i;

export interface GuardedPosting {
  text: string;
  /** Lines taken out because they address an AI rather than a candidate. */
  flagged: string[];
}

export function guardPosting(raw: string | null): GuardedPosting {
  const flagged: string[] = [];
  const text = (raw || '')
    .replace(INVISIBLE, '')
    .split('\n')
    .filter((line) => {
      if (!INJECTION.test(line)) return true;
      flagged.push(line.trim().slice(0, 200));
      return false;
    })
    .join('\n');
  return { text, flagged };
}

// Languages a posting can require; "fluent German" / "German required" / "native French" count, "German market" does not.
const LANGUAGES =
  'german|french|spanish|dutch|italian|portuguese|japanese|mandarin|chinese|korean|arabic|polish|swedish|danish|norwegian|finnish|czech|turkish|russian|hebrew|hindi';
const LANG_ASK = new RegExp(
  `\\b(?:fluent|fluency|native|business[- ]level|proficient|proficiency|c1|c2|b2)\\b[^.\\n]{0,30}\\b(${LANGUAGES})\\b|\\b(${LANGUAGES})\\b[^.\\n]{0,25}\\b(?:required|mandatory|is a must|must|fluency|speaking|native)\\b`,
  'gi',
);

/** Languages the posting demands, lowercased. */
export function requiredLanguages(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(LANG_ASK)) out.add((m[1] || m[2]).toLowerCase());
  return [...out];
}

/**
 * Why the user would never take this job, or null. `dealBreakers` and `languages` are the comma-separated Kit fields;
 * a deal-breaker is a phrase matched as whole words against the title, employer, location and description.
 */
export function gateJob(
  job: { title: string; employer?: string | null; location?: string | null; description?: string | null },
  kit: { deal_breakers?: string; languages?: string } | null | undefined,
): string | null {
  const haystack = [job.title, job.employer, job.location, job.description].filter(Boolean).join('\n');
  for (const phrase of (kit?.deal_breakers || '').split(',').map((s) => s.trim().toLowerCase())) {
    if (phrase.length > 1 && new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(haystack))
      return 'Deal-breaker: ' + phrase;
  }
  // No languages set = the gate stays off: RADAR does not guess what you speak.
  const spoken = (kit?.languages || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (spoken.length) {
    const missing = requiredLanguages(haystack).filter((l) => !spoken.includes(l));
    if (missing.length) return 'Needs ' + missing.join(', ');
  }
  return null;
}

// ---- Posting flags: reasons to think twice before spending an application on a job.

// A fifth of open postings are this old (2026-10-30); 45 days flagged a third of all jobs and meant nothing.
const STALE_DAYS = 90;
const JUNIOR = /\b(junior|jr\.?|entry[- ]level|graduate|intern(ship)?|trainee|fresher)\b/i;
const YEARS_ASKED =
  /(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*\+?\s*)?(?:years?|yrs?)(?:\s+of)?[^.\n]{0,40}\bexperience\b/gi;
const RED_FLAGS: [RegExp, string][] = [
  [
    /\b(registration|training|joining|security|processing)\s+(fee|deposit|charges?)\b/gi,
    'asks for a fee: likely a scam',
  ],
  // Not "unpaid leave", and not the FAQ line "Is it a paid/unpaid internship?".
  [
    /(?<!paid ?\/ ?|paid or )\b(unpaid|no stipend|without (?:pay|stipend))\b(?!\s+(?:leave|time off|vacation|holidays?))/gi,
    'unpaid',
  ],
  [/\bcommission[- ](?:only|based)\b/gi, 'commission-only pay'],
  [
    /\b(?:send|share|message|contact|ping|dm)\b[^.\n]{0,40}\b(?:whats\s?app|telegram)\b|\b(?:whats\s?app|telegram)\b[^.\n]{0,20}\+?\d[\d\s-]{8,}/gi,
    'recruiting over WhatsApp/Telegram: verify the recruiter',
  ],
  // Not "we're family friendly" or "a family-owned business".
  [
    /\b(?:we are|we['’]re|like)\s+(?:a|one big)\s+family\b(?![- ](?:friendly|owned|run|business|company))/gi,
    '“we are a family” pitch',
  ],
  [/\b(?:rock\s?star|ninja)s?\b/gi, 'buzzword hiring (“rockstar”, “ninja”)'],
  [/\bwear (?:many|multiple|lots of) hats\b/gi, '“wear many hats”: expect a broad, shifting scope'],
];
// "We never charge a registration fee" is the opposite of a red flag. Dutch and German JDs say it too ("Geen ninjas").
const NEGATED =
  /\b(?:no|never|not|don't|do not|doesn't|does not|won't|will not|zero|free of|geen|kein|keine|nicht)\b[^.\n]{0,25}$/i;

/** Reasons to think twice before applying: a stale listing, a junior title asking for years, scam and culture flags. */
export function postingFlags(
  job: { title: string; description?: string | null; posted_at?: string | null },
  now = Date.now(),
): string[] {
  const flags: string[] = [];
  const text = job.description || '';
  const age = job.posted_at ? Math.floor((now - Date.parse(job.posted_at)) / 86_400_000) : NaN;
  if (age >= STALE_DAYS) flags.push(`posted ${age}d ago: may be evergreen or already filled`);
  if (JUNIOR.test(job.title)) {
    const most = Math.max(0, ...[...text.matchAll(YEARS_ASKED)].map((m) => Number(m[1])));
    if (most >= 3) flags.push(`junior title asks for ${most}+ years`);
  }
  for (const [re, label] of RED_FLAGS)
    if ([...text.matchAll(re)].some((m) => !NEGATED.test(text.slice(Math.max(0, m.index! - 40), m.index!))))
      flags.push(label);
  return flags;
}
