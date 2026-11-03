// ============================
// RADAR — COACH: everything around the application that decides whether it lands
// ============================
// Interview prep, mock interviews, follow-ups, the referral kit, offer negotiation, the upskill plan and the LinkedIn
// rewrite. Each kind is one JSON reply from the same AI chain as OVERCLOCK (completeJson: AI_PROVIDER first, free tiers
// before paid), checked with zod, built only from the resume, the profile and the posting. Answers are cached per user,
// job and kind in coach_notes (migrations 015, 016); kinds that depend on what you type (a mock interview turn, the
// offer you got) are never cached.

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { completeJson, parseJsonReply, TailorError } from '@/lib/ai/tailor';
import { guardPosting } from '@/lib/posting-guard';
import { marketBand } from '@/lib/pay';
import { toPortfolio } from '@/lib/profile';
import { isSchemaMissing } from '@/lib/supabase/errors';

export const Prep = z.object({
  company_brief: z.string(),
  role_focus: z.array(z.string()),
  questions: z.array(
    z.object({
      question: z.string(),
      why_they_ask: z.string(),
      // A STAR answer built from a real line of the resume; empty strings when the resume has nothing for it.
      story: z.object({ situation: z.string(), task: z.string(), action: z.string(), result: z.string() }),
    }),
  ),
  ask_them: z.array(z.string()),
  watch_out: z.array(z.string()),
});
export const MockTurn = z.object({ feedback: z.string(), score: z.number(), next_question: z.string() });
export const FollowUp = z.object({ subject: z.string(), body: z.string(), send_after: z.string() });
export const Upskill = z.object({
  plan: z.array(
    z.object({
      skill: z.string(),
      why: z.string(),
      steps: z.array(z.string()),
      proof_project: z.string(),
      hours: z.number(),
    }),
  ),
});
const Email = z.object({ subject: z.string(), body: z.string() });
export const Referral = z.object({
  people: z.array(z.object({ who: z.string(), why: z.string(), search: z.string() })),
  connection_note: z.string(),
  referral_ask: z.string(),
  cold_email: Email,
});
export const Negotiate = z.object({
  read: z.string(),
  counter: z.string(),
  walk_away: z.string(),
  levers: z.array(z.string()),
  email: Email,
  call_script: z.array(z.string()),
});
export const LinkedIn = z.object({
  headline: z.string(),
  about: z.string(),
  skills: z.array(z.string()),
  featured: z.array(z.string()),
  open_to_work: z.array(z.string()),
});

const SCHEMA = {
  prep: Prep,
  mock: MockTurn,
  followup: FollowUp,
  upskill: Upskill,
  referral: Referral,
  negotiate: Negotiate,
  linkedin: LinkedIn,
} as const;
export type CoachKind = keyof typeof SCHEMA;
export const COACH_KINDS = Object.keys(SCHEMA) as CoachKind[];
/** Kinds about you, not one job. */
export const JOBLESS: CoachKind[] = ['upskill', 'linkedin'];
/** Kinds that depend on what you type, so a cached answer would be wrong. */
const UNCACHED: CoachKind[] = ['mock', 'negotiate'];

const TRUTH =
  'Use only facts from <resume>, <profile> and <posting>. Never invent employers, metrics, people, offers or company facts; when you do not know, say what to check instead. Plain text, no markdown, no emojis.';

const SYSTEM: Record<CoachKind, string> = {
  prep: `You are an interview coach preparing a candidate for one interview. ${TRUTH}
company_brief: what the company does and what this team likely cares about, from the posting only (3-4 sentences).
role_focus: the 4-6 things this interview will test.
questions: 8 likely questions (technical and behavioural mixed). For each, a STAR story taken from a real resume line; leave the story fields empty when the resume has nothing that fits, and say so in why_they_ask.
ask_them: 4 sharp questions the candidate should ask.
watch_out: gaps an interviewer will probe and how to answer them honestly.`,
  mock: `You are the interviewer for this role, running a mock interview. ${TRUTH}
Read the transcript. If there is an answer to the last question, give feedback in 2-3 sentences (what landed, what was missing, one concrete improvement) and score it 1-10; on the first turn give feedback "" and score 0.
next_question: your next question, one at a time, mixing technical and behavioural, harder when answers are strong. After 6 questions, ask the candidate if they have questions for you.`,
  followup: `You write a short follow-up email for a job application. ${TRUTH}
Match the stage: applied or screening with no reply = a polite check-in that restates one concrete fit point; interview = a thank-you referencing the role; rejected = a gracious note asking for one line of feedback and to be kept in mind; offer = a thank-you that asks for the written offer and the decision date.
Under 120 words. subject: short. send_after: when to send it, e.g. "7 days after applying".`,
  upskill: `You are a career coach. <gaps> lists skills that open roles ask for and the candidate's resume lacks, with how many roles asked. ${TRUTH}
plan: the 5 skills worth learning first (most demanded, quickest to prove, closest to what the candidate already does). For each: why (with the demand count), 3-5 concrete learning steps with free resources named generically (official docs, a known free course type), one small proof_project to put on GitHub, and realistic hours.`,
  referral: `You help a candidate get referred for one job. A referral beats a cold application, but only when the ask is specific and easy to say yes to. ${TRUTH}
people: the 4 kinds of people at this company most likely to help, best first: an engineer or peer on the team this role joins, the likely title of the hiring manager, alumni of the candidate's college or past employers when the resume names them, a recruiter for this function. who: the title to look for; why: one line; search: the words to type into LinkedIn people search, company name first (e.g. "Northwind backend engineer", "Northwind IIT Delhi").
connection_note: at most 200 characters (LinkedIn's limit on a free account), naming the role and one real shared point; do not ask for the referral yet.
referral_ask: the message once they accept, under 90 words: the job title, the placeholder [JOB LINK], two proof points from the resume, and an easy way to say no.
cold_email: to the hiring manager, under 120 words, subject under 8 words.`,
  negotiate: `You coach a candidate through pay talks for one job. ${TRUTH}
<market> is what similar roles pay, read from real postings (percentiles, sample size); it may be missing. <kit> is the candidate's current and expected pay. <offer> is the offer in their words; when it is empty, the candidate is being asked for their expected pay.
read: 2-3 sentences on where the offer (or their expectation) sits against the market and their current pay.
counter: the number or package to ask for, anchored in the market's upper half and the candidate's strongest proof. Never suggest inventing a competing offer.
walk_away: the lowest package worth accepting, and why.
levers: 4-6 things to trade when the base is fixed (joining bonus, notice-period buyout, ESOPs, remote days, title, a pay review in 6 months, relocation).
email: a short, warm counter (or the answer to "what is your expected pay?").
call_script: 5-7 short lines to say on the call, in order.`,
  linkedin: `You rewrite a candidate's LinkedIn profile so recruiters searching for <targets> find and message them. ${TRUTH}
headline: at most 220 characters: the target role, 2-3 strongest skills or domains, one proof; no "aspiring", no emojis.
about: 150 to 300 words in first person: what they build, two proof points from the resume, the roles they want, how to reach them. The first two lines must stand alone (LinkedIn cuts the rest).
skills: the 5 skills to pin, from the resume, chosen for what the targets ask for.
featured: 3 things to pin in Featured, from the projects and links in <profile>.
open_to_work: up to 5 job titles for Open to Work.`,
};

const jsonRule = (kind: CoachKind) =>
  '\n\nReply with a single JSON object and nothing else. It must match this JSON Schema:\n' +
  JSON.stringify(z.toJSONSchema(SCHEMA[kind]));

/** One coach reply for the given context, checked against its schema. */
export async function coach(kind: CoachKind, context: string): Promise<{ output: unknown; model: string }> {
  const { text, model } = await completeJson(SYSTEM[kind] + jsonRule(kind), context);
  const parsed = SCHEMA[kind].safeParse(parseJsonReply(text));
  if (!parsed.success) throw new TailorError('The AI returned an incomplete answer. Try again.', 502);
  return { output: parsed.data, model };
}

export class CoachError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export interface MockLine {
  question: string;
  answer: string;
}

/** The candidate's targets, skills, links and projects, for the kinds that speak for the whole profile. */
function profileBlock(profile: any): string {
  const portfolio = toPortfolio(profile.portfolio);
  return [
    '<targets>\n' + (profile.current_role || '(not set)') + '\n</targets>',
    '<profile>',
    'SKILLS: ' + (profile.skills || []).join(', '),
    'EXPERIENCE: ' + (profile.is_fresher ? 'fresher' : (profile.experience_years ?? 0) + ' years'),
    ...(['portfolio', 'github', 'linkedin', 'website'] as const)
      .filter((k) => portfolio[k])
      .map((k) => k.toUpperCase() + ': ' + portfolio[k]),
    ...portfolio.projects.map((p) => `PROJECT: ${p.name} (${p.url})${p.note ? ' - ' + p.note : ''}`),
    '</profile>',
  ].join('\n');
}

/**
 * Run one coach request for a user. Every kind but the jobless ones needs `matchId`. Cached kinds come back from
 * coach_notes unless `force`.
 */
export async function runCoach(
  supabase: SupabaseClient,
  userId: string,
  kind: CoachKind,
  {
    matchId,
    history = [],
    offer = '',
    force = false,
  }: { matchId?: string; history?: MockLine[]; offer?: string; force?: boolean },
): Promise<{ output: unknown; cached: boolean }> {
  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle();
  if (!profile?.resume_text) throw new CoachError('Upload your resume in Preferences first.', 400);
  const resume = `<resume>\n${profile.resume_text}\n</resume>`;

  let context: string;
  let jobId: string | null = null;
  if (kind === 'upskill') {
    const { data: rows } = await supabase
      .from('match_scores')
      .select('missing_skills')
      .eq('user_id', userId)
      .gte('score', 50)
      .limit(500);
    const demand = new Map<string, number>();
    for (const r of rows || []) for (const s of r.missing_skills || []) demand.set(s, (demand.get(s) || 0) + 1);
    const top = [...demand].sort((a, b) => b[1] - a[1]).slice(0, 25);
    if (!top.length) throw new CoachError('No skill gaps yet. Run a scan first.', 400);
    context = `<gaps>\n${top.map(([s, n]) => `${s}: ${n} roles`).join('\n')}\n</gaps>\n\n${resume}`;
  } else if (kind === 'linkedin') {
    context = profileBlock(profile) + '\n\n' + resume;
  } else {
    if (!matchId) throw new CoachError('Expected matchId', 400);
    const { data: match } = await supabase
      .from('match_scores')
      .select(
        'job_id, stage, applied_at, jobs!inner(id, title, employer, description, location, salary_min, salary_max, salary_currency, companies!inner(name))',
      )
      .eq('user_id', userId)
      .eq('id', matchId)
      .maybeSingle();
    if (!match) throw new CoachError('Match not found', 404);
    const job = (Array.isArray(match.jobs) ? match.jobs[0] : match.jobs) as any;
    const company = job.employer || (Array.isArray(job.companies) ? job.companies[0] : job.companies)?.name;
    jobId = match.job_id;
    const pay = [job.salary_currency, job.salary_min, job.salary_max].filter(Boolean).join(' ');
    const parts = [
      `<posting>\nJOB: ${job.title} at ${company}\nLOCATION: ${job.location || ''}${pay ? '\nSTATED PAY: ' + pay : ''}\n${guardPosting(job.description).text}\n</posting>`,
      `STAGE: ${match.stage || 'applied'}${match.applied_at ? ' (applied ' + match.applied_at.slice(0, 10) + ')' : ''}`,
      resume,
    ];
    if (kind === 'mock')
      parts.push(
        '<transcript>\n' +
          history.map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer}`).join('\n') +
          '\n</transcript>',
      );
    if (kind === 'negotiate') {
      const kit = profile.application_kit || {};
      const yours = String(kit.currency || '')
        .trim()
        .toUpperCase();
      const band = await marketBand(
        supabase,
        job,
        job.salary_currency || (/^[A-Z]{3}$/.test(yours) ? yours : null),
      ).catch(() => null);
      parts.push(
        band
          ? `<market>\n${band.currency}: 25th percentile ${band.p25}, median ${band.p50}, 75th percentile ${band.p75} (${band.n} similar postings)\n</market>`
          : '<market>\n(not enough similar postings with pay)\n</market>',
        `<kit>\nCURRENT PAY: ${kit.current_ctc || '(not set)'}\nEXPECTED PAY: ${kit.expected_ctc || '(not set)'}\nCURRENCY: ${kit.currency || '(not set)'}\nNOTICE PERIOD: ${kit.notice_period || '(not set)'}\n</kit>`,
        `<offer>\n${offer}\n</offer>`,
      );
    }
    context = parts.join('\n\n');
  }

  const cache = !UNCACHED.includes(kind);
  if (cache && !force) {
    let q = supabase.from('coach_notes').select('content').eq('user_id', userId).eq('kind', kind);
    q = jobId ? q.eq('job_id', jobId) : q.is('job_id', null);
    const { data } = await q.maybeSingle();
    if (data) return { output: data.content, cached: true };
  }

  const { output, model } = await coach(kind, context);
  if (cache) {
    // Before migration 015 (016 for the newer kinds) the answer is still returned, only not remembered.
    const del = supabase.from('coach_notes').delete().eq('user_id', userId).eq('kind', kind);
    await (jobId ? del.eq('job_id', jobId) : del.is('job_id', null));
    const { error } = await supabase
      .from('coach_notes')
      .insert({ user_id: userId, job_id: jobId, kind, content: output, model });
    if (error && !isSchemaMissing(error)) console.warn('[COACH] not cached:', error.message);
  }
  return { output, cached: false };
}
