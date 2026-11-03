// ============================
// RADAR — Resume audit: what a recruiter's six-second skim and an ATS check, run on your resume
// ============================
// No AI call: every check is a rule, so it is free, instant and the same every time. Each one says what it found
// and what to change. Weights follow what costs interviews most: no numbers, weak openers, no way to contact you. Pure.

import type { ResumeAudit } from '@/types';

const BULLET = /^\s*(?:[-•*▪◦‣–]|\d{1,2}[.)])\s+/;
const WEAK =
  /^(responsible for|worked on|helped(?: with)?|assisted(?: with| in)?|involved in|participated in|duties included|tasked with|handled)\b/i;
const BUZZ =
  /\b(hard[- ]?working|team player|go[- ]getter|results[- ]driven|detail[- ]oriented|self[- ]motivated|passionate|synergy|think outside the box)\b/gi;
const FIRST_PERSON = /\b(I|my|me)\b/;
const METRIC = /\d|%|[$₹€£]/;
const SECTIONS: [string, RegExp][] = [
  ['experience or projects', /^\s*(work |professional )?(experience|employment|projects?|internships?)\b/im],
  ['education', /^\s*education\b/im],
  ['skills', /^\s*(technical |core )?skills\b/im],
];

/** The audit of a resume's text (without the details typed during onboarding). */
export function auditResume(text: string): ResumeAudit {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  let bullets = lines.filter((l) => BULLET.test(l)).map((l) => l.replace(BULLET, ''));
  // ponytail: PDF text often loses the bullet glyphs; then long lines stand in for bullets. Wrapped lines count twice.
  if (bullets.length < 3) bullets = lines.filter((l) => l.length >= 40);
  const words = text.split(/\s+/).filter(Boolean).length;
  const quantified = bullets.filter((b) => METRIC.test(b)).length;
  const weak = bullets.filter((b) => WEAK.test(b));
  const buzz = [...new Set([...text.matchAll(BUZZ)].map((m) => m[1].toLowerCase()))];
  const firstPerson = bullets.filter((b) => FIRST_PERSON.test(b)).length;
  const contact = [
    ['email', /[\w.+-]+@[\w-]+\.[\w.]+/.test(text)],
    // Ten digits, so a date range like "2019 - 2023" is not a phone number.
    ['phone', (text.match(/\+?\d[\d\s().-]{8,}\d/g) || []).some((m) => m.replace(/\D/g, '').length >= 10)],
    ['LinkedIn', /linkedin\.com\//i.test(text)],
    ['GitHub or portfolio', /github\.com\/|gitlab\.com\/|behance\.net\/|https?:\/\/(?!(?:www\.)?linkedin)/i.test(text)],
  ] as const;
  const noContact = contact.filter(([, has]) => !has).map(([name]) => name);
  const noSection = SECTIONS.filter(([, re]) => !re.test(text)).map(([name]) => name);
  const share = bullets.length ? quantified / bullets.length : 0;

  const checks: (ResumeAudit['checks'][number] & { weight: number })[] = [
    {
      weight: 25,
      ok: share >= 0.4,
      label: 'Numbers in your bullets',
      detail:
        `${quantified} of ${bullets.length} lines carry a number. ` +
        (share >= 0.4 ? 'Good: results read as proof.' : 'Aim for 4 in 10: users, %, ms, ₹ saved, team size.'),
    },
    {
      weight: 15,
      ok: weak.length === 0,
      label: 'Strong openers',
      detail: weak.length
        ? `${weak.length} line${weak.length > 1 ? 's' : ''} open with "${weak[0].match(WEAK)![1]}". Lead with the verb: Built, Cut, Shipped, Led.`
        : 'Every line leads with what you did.',
    },
    {
      weight: 15,
      ok: noContact.length <= 1 && !noContact.includes('email'),
      label: 'Easy to reach',
      detail: noContact.length ? 'Missing: ' + noContact.join(', ') + '.' : 'Email, phone, LinkedIn and a work link.',
    },
    {
      weight: 15,
      ok: noSection.length === 0,
      label: 'Sections an ATS can read',
      detail: noSection.length
        ? 'No heading found for ' + noSection.join(', ') + '. Use plain headings an ATS knows.'
        : 'Experience, education and skills are all labelled.',
    },
    {
      weight: 10,
      ok: words >= 300 && words <= 900,
      label: 'Length',
      detail:
        `${words} words. ` +
        (words < 300
          ? 'Thin: add projects and outcomes.'
          : words > 900
            ? 'Over two pages: cut to the strongest lines.'
            : 'One to two pages.'),
    },
    {
      weight: 10,
      ok: buzz.length === 0,
      label: 'No filler words',
      detail: buzz.length ? `"${buzz.slice(0, 3).join('", "')}": show it with a result instead.` : 'No clichés found.',
    },
    {
      weight: 10,
      ok: firstPerson <= 1,
      label: 'No "I" in bullets',
      detail:
        firstPerson > 1
          ? `${firstPerson} lines use I, my or me. Drop the pronoun, keep the verb.`
          : 'Bullets read crisp.',
    },
  ];
  return {
    score: checks.reduce((sum, c) => sum + (c.ok ? c.weight : 0), 0),
    checks: checks.map(({ ok, label, detail }) => ({ ok, label, detail })),
  };
}
