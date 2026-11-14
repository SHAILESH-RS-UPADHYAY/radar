'use client';

import { useEffect, useRef, useState, type CSSProperties, type FC } from 'react';
import Link from 'next/link';
import { animate, useReducedMotion } from 'framer-motion';

// The five briefing pages. Each is one idea, drawn: `Copy` is the words, `Visual` is the scene that shows them.
// Every number comes from the code that runs RADAR: the catalog (counted on the server, passed in as `facts`),
// the matcher's weights (src/lib/ai/matcher.ts), the cron times (vercel.json).

export interface Facts {
  /** Job feeds on RADAR's list: companies' own careers feeds plus job boards and alert feeds. */
  feeds: number;
  /** How many of those are companies' own careers feeds. */
  tracked: number;
}
interface Scene {
  Copy: FC<{ signedIn: boolean; facts: Facts }>;
  Visual: FC<{ facts: Facts }>;
}

const v = (vars: Record<string, string | number>) => vars as CSSProperties;

/** Counts 0 → `to` once the scene is on screen; lands on `to` at once for people who asked for less motion. */
function useTicker(to: number, everyMs: number, startMs = 500) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    let id: ReturnType<typeof setInterval>;
    const start = setTimeout(
      () => {
        id = setInterval(() => setN((x) => (x >= to ? x : reduced ? to : x + 1)), reduced ? 1 : everyMs);
      },
      reduced ? 0 : startMs,
    );
    return () => {
      clearTimeout(start);
      clearInterval(id);
    };
  }, [to, everyMs, startMs, reduced]);
  return n;
}

/* ───────── 1 · WHAT — idea: the job hunt as a to-do list; RADAR's sweep crosses each chore out. ───────── */
const chores = (f: Facts): [string, string][] => [
  ['Open the same careers pages every morning', `scans ${f.feeds} job feeds, every 6 hours`],
  ['Guess whether a job fits you', 'scores each one from 0 to 100, and says why'],
  ['Rewrite your resume for it', 'rewrites your resume for that one job'],
  ['Type your name into one more form', 'opens the form already filled'],
  ['Wonder what happened after you applied', 'follows the replies, if you connect Gmail'],
];

const What: Scene = {
  Copy: () => (
    <>
      <h1 className="bf-h1 font-display">Job hunting by hand is a second job.</h1>
      <p className="bf-lede">
        RADAR does that job for you. It finds openings, scores them against you and fills the forms. You read the short
        list and decide.
      </p>
    </>
  ),
  Visual: ({ facts }) => (
    <div className="bf-chores">
      <p className="bf-note bf-flip">
        <span aria-hidden>Your week, by hand</span>
        <span>Your week, with RADAR</span>
      </p>
      <span className="bf-scanline" aria-hidden />
      <ol>
        {chores(facts).map(([chore, radar], i) => (
          <li key={chore} style={v({ '--i': i })}>
            <span className="bf-chore">
              <span className="sr-only">By hand: </span>
              {chore}
            </span>
            <span className="bf-does">
              <b>RADAR</b> {radar}
            </span>
          </li>
        ))}
      </ol>
    </div>
  ),
};

/* ───────── 2 · FIND — idea: a scope; the beam catches jobs at the rim, a ring cleans them, the rest reach you. ───────── */
const SOURCES = ['Greenhouse', 'Lever', 'Ashby', 'Workday', 'Job boards', 'Your job-alert emails'];
// [angle on the scope in degrees (180 = straight left), what happens to it, which of two turns of the beam catches it]
const BLIPS: [number, 'ok' | 'copy' | 'closed', 0 | 1][] = [
  [128, 'ok', 1],
  [140, 'ok', 0],
  [156, 'ok', 1],
  [163, 'copy', 1],
  [172, 'closed', 0],
  [188, 'ok', 0],
  [204, 'ok', 1],
  [211, 'copy', 1],
  [220, 'closed', 0],
  [234, 'ok', 0],
];
/** When the beam crosses an angle: it turns once in 3.6s and starts 45° past north (see .bf-sweep). */
const caughtAt = (angle: number, turn: number) => ((((angle + 45) % 360) / 360) * 3.6 + turn * 3.6).toFixed(2) + 's';

const Find: Scene = {
  Copy: ({ facts }) => (
    <>
      <h1 className="bf-h1 font-display">It reads the company’s own page.</h1>
      <p className="bf-lede">
        Not reposts. RADAR asks the hiring systems that companies post on first, then job boards. A job board’s copy of
        the same job is dropped. A job that closed is removed.
      </p>
      <p className="bf-fact">
        <strong>{facts.feeds}</strong>
        <span>
          job feeds on its list, {facts.tracked} of them companies’ own careers feeds. A scan runs every 6 hours: 2 am,
          8 am, 2 pm and 8 pm, India time.
        </span>
      </p>
    </>
  ),
  Visual: () => (
    <div className="bf-scope">
      <svg
        viewBox="-190 0 790 600"
        role="img"
        aria-label="A radar scope. Jobs appear at the rim as the beam passes them and move inward. At the cleaning ring, job-board copies and closed jobs drop out. The rest reach the centre: your list."
      >
        <circle cx="300" cy="300" r="280" className="bf-ring" />
        <circle cx="300" cy="300" r="170" className="bf-ring bf-ring--clean" />
        <circle cx="300" cy="300" r="64" className="bf-ring bf-ring--you" />
        <g className="bf-sweep">
          <path d="M300 300V20a280 280 0 0 1 198 82Z" className="bf-wedge" />
          <path d="M300 300 498 102" className="bf-beam" />
        </g>
        {SOURCES.map((s, i) => {
          const a = ((140 + i * 16) * Math.PI) / 180;
          return (
            <text
              key={s}
              x={Math.round(300 + 296 * Math.cos(a))}
              y={Math.round(305 + 296 * Math.sin(a))}
              textAnchor="end"
              className="bf-src"
            >
              {s}
            </text>
          );
        })}
        {BLIPS.map(([a, kind, turn]) => (
          <g key={a} transform={`rotate(${a} 300 300)`}>
            <circle
              cx="580"
              cy="300"
              r="9"
              className={'bf-blip bf-blip--' + kind}
              style={v({ '--d': caughtAt(a, turn) })}
            />
          </g>
        ))}
        <text x="300" y="296" textAnchor="middle" className="bf-you">
          your
        </text>
        <text x="300" y="316" textAnchor="middle" className="bf-you">
          list
        </text>
        <text x="300" y="492" textAnchor="middle" className="bf-src">
          cleaning ring
        </text>
      </svg>
      <p className="bf-srclist">From: {SOURCES.join(', ')}.</p>
      <ul className="bf-legend">
        <li data-k="ok">
          <i className="bf-key bf-key--ok" />
          reaches your list
        </li>
        <li data-k="copy">
          <i className="bf-key bf-key--copy" />a job board’s copy, dropped
        </li>
        <li data-k="closed">
          <i className="bf-key bf-key--closed" />
          closed, removed
        </li>
      </ul>
    </div>
  ),
};

/* ───────── 3 · MATCH — idea: a height chart 0–100 with a line at 80; a job climbs it reason by reason. ───────── */
// A worked example with the matcher's real weights: 60% meaning (65 × 0.6), 40% skills (4 of 5 × 0.4),
// +10 target role, +5 your city, +5 posted in the last 4 days.
const REASONS: [number, string, string][] = [
  [39, 'Meaning', 'your resume and the job describe the same kind of work'],
  [32, 'Skills', 'you have 4 of the 5 skills it lists'],
  [10, 'Role', 'the title is a role you asked for'],
  [5, 'City', 'it is in one of your cities'],
  [5, 'Fresh', 'it was posted 2 days ago'],
];
/** The score before each reason is added. */
const BEFORE = REASONS.map((_, i) => REASONS.slice(0, i).reduce((s, r) => s + r[0], 0));
const TOTAL = REASONS.reduce((s, r) => s + r[0], 0);

const MatchVisual: FC = () => {
  const n = useTicker(REASONS.length, 850);
  const reduced = useReducedMotion();
  const [hot, setHot] = useState(-1);
  const num = useRef<HTMLParagraphElement>(null);
  const shown = useRef(0);
  const score = BEFORE[n] ?? TOTAL;
  const saved = score >= 80;

  // The big number rolls from the old score to the new one.
  useEffect(() => {
    const el = num.current;
    if (!el) return;
    const from = shown.current;
    shown.current = score;
    if (reduced || from === score) {
      el.textContent = String(score);
      return;
    }
    const run = animate(from, score, {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (x) => (el.textContent = String(Math.round(x))),
    });
    return () => run.stop();
  }, [score, reduced]);

  return (
    <div className="bf-match">
      <div className="bf-ruler" data-hot={hot >= 0 || undefined} aria-hidden>
        {[100, 80, 60, 40, 20, 0].map((t) => (
          <span key={t} className="bf-tick" style={{ bottom: t + '%' }}>
            {t}
          </span>
        ))}
        {REASONS.map(([pts, name], i) => (
          <span
            key={name}
            className="bf-seg"
            data-on={i < n || undefined}
            data-hot={hot === i || undefined}
            style={{ bottom: BEFORE[i] + '%', height: pts + '%' }}
          />
        ))}
        <span className="bf-bar">Vault line</span>
        <span className="bf-zone bf-zone--vault" data-on={saved || undefined}>
          The Vault
        </span>
        <span className="bf-zone bf-zone--disc" data-on={!saved || undefined}>
          Discovery
        </span>
        <span className="bf-climb" style={{ transform: `translateY(${100 - score}%)` }}>
          <span className="bf-job">This job</span>
        </span>
      </div>
      <div className="bf-tally">
        <p ref={num} className="bf-score" aria-hidden>
          0
        </p>
        <p className="sr-only">
          Example: {REASONS.map((r) => r[0]).join(' + ')} = {TOTAL}. That is above 80, so the job is saved to the Vault.
        </p>
        <ol>
          {REASONS.map(([pts, name, why], i) => (
            <li key={name} data-on={i < n || undefined} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(-1)}>
              <b>+{pts}</b>
              <span>
                <strong>{name}:</strong> {why}
              </span>
            </li>
          ))}
        </ol>
        <p className="bf-note">An example: a Backend Engineer job. Your scores come from your own resume.</p>
      </div>
    </div>
  );
};

const Match: Scene = {
  Copy: () => (
    <>
      <h1 className="bf-h1 font-display">Every job gets a score. Every score says why.</h1>
      <p className="bf-lede">
        0 to 100. A job at 80 or more is saved to your Vault by itself. The rest wait in Discovery, best first. The line
        is yours to move, from 40 to 95.
      </p>
    </>
  ),
  Visual: MatchVisual,
};

/* ───────── 4 · APPLY — idea: an application form that types itself, then stops at Submit. ───────── */
const FIELDS: [string, string][] = [
  ['Full name', 'Asha Rao'],
  ['Email', 'asha.rao@example.com'],
  ['Phone', '+91 98765 43210'],
  [
    'Why this role?',
    'I built a billing API in Python last year. Your payments team works on the same kind of problem.',
  ],
];
/** Characters typed before each field starts. */
const STARTS = FIELDS.map((_, i) => FIELDS.slice(0, i).reduce((s, f) => s + f[1].length, 0));
const CHARS = FIELDS.reduce((s, f) => s + f[1].length, 0);

const ApplyVisual: FC = () => {
  const c = useTicker(CHARS, 26, 700);
  const done = c >= CHARS;
  return (
    <div className="bf-form hud-panel">
      <p className="bf-note">An application form, as the RADAR extension fills it</p>
      {FIELDS.map(([label, value], i) => {
        const shown = Math.max(0, Math.min(value.length, c - STARTS[i]));
        return (
          <div key={label} className="bf-field" data-long={i === 3 || undefined}>
            <span>{label}</span>
            <p>
              <span aria-hidden>{value.slice(0, shown)}</span>
              {shown > 0 && shown < value.length && <i className="bf-caret" aria-hidden />}
              <span className="sr-only">{value}</span>
            </p>
          </div>
        );
      })}
      <div className="bf-field">
        <span>Resume</span>
        <p className="bf-file" data-on={done || undefined}>
          Asha_Rao_resume.pdf <em>your resume, or the one OVERCLOCK rewrote for this job</em>
        </p>
      </div>
      <div className="bf-submit" data-on={done || undefined}>
        <span className="bf-submit-btn bg-phosphor text-black">Submit application</span>
        <svg viewBox="0 0 120 44" aria-hidden>
          <path d="M116 30C92 40 52 40 14 16" />
          <path d="M26 12 13 15l5 13" />
        </svg>
        <span className="bf-hand">RADAR stops here. This press is yours.</span>
      </div>
    </div>
  );
};

const Apply: Scene = {
  Copy: () => (
    <>
      <h1 className="bf-h1 font-display">The form fills itself. Submit stays yours.</h1>
      <dl className="bf-ways">
        <div>
          <dt>One click</dt>
          <dd>The RADAR extension (Chrome, on a computer) opens the real form with your answers and resume in it.</dd>
        </div>
        <div>
          <dt>OVERCLOCK</dt>
          <dd>Rewrites your resume for one job, using only facts already in it. Nothing is made up.</dd>
        </div>
        <div>
          <dt>ZERO-DAY</dt>
          <dd>
            Lines up today’s best jobs and fills them one after another. Dry run sends nothing. Live presses Submit
            after a 5-second countdown you can stop.
          </dd>
        </div>
      </dl>
    </>
  ),
  Visual: ApplyVisual,
};

/* ───────── 5 · START — idea: your file; solid sheets are kept, dashed ones never are. ───────── */
const KEPT = [
  'Your name and email',
  'The text of your resume',
  'Your roles, skills and cities',
  'Answers you save for application forms',
  'Your scores, and what you saved or applied to',
];
const NEVER = [
  'The resume PDF itself (it stays in your browser)',
  'Passwords and one-time codes',
  'Card or payment details',
];

const Start: Scene = {
  Copy: ({ signedIn }) => (
    <>
      <h1 className="bf-h1 font-display">You can see everything RADAR keeps.</h1>
      <p className="bf-lede">
        No ads. Nothing is sold or shown to employers. Delete your account and all of it goes. Setup is 7 short steps,
        and a resume is optional.
      </p>
      <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link
          href={signedIn ? '/dashboard' : '/sign-up'}
          className="bf-btn bf-btn--big bg-phosphor font-bold text-black hover:bg-phosphor-hi"
        >
          {signedIn ? 'Back to dashboard' : 'Create your account'}
        </Link>
        {!signedIn && (
          <Link href="/sign-in" className="bf-quiet underline underline-offset-4">
            I have an account. Log in
          </Link>
        )}
      </div>
      <p className="bf-soft mt-4 text-sm">
        The full list is on the{' '}
        <Link href="/privacy" className="underline underline-offset-4">
          privacy page
        </Link>
        .
      </p>
    </>
  ),
  Visual: () => (
    <div className="bf-file-wrap">
      <div className="bf-sheet bf-sheet--kept hud-panel">
        <h2>Kept</h2>
        <ul>
          {KEPT.map((k) => (
            <li key={k}>{k}</li>
          ))}
          <li className="bf-from-mail">From Gmail: the subject, the sender’s name, and the result</li>
        </ul>
      </div>
      {/* A reply arrives: its subject line is filed under Kept, the rest falls through to Never kept. */}
      <div className="bf-letter" aria-hidden>
        <span className="bf-letter-cap">A reply lands in your Gmail</span>
        <span className="bf-letter-strip">Interview invitation, from the Talent Team</span>
        <i />
        <i />
        <i />
      </div>
      <div className="bf-sheet bf-sheet--never">
        <h2>Never kept</h2>
        <ul>
          <li className="bf-mail-body">The body of any email</li>
          {NEVER.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      </div>
      <p className="bf-note bf-gmail">
        Gmail is optional and read-only. RADAR cannot send or delete mail. Skip it and everything else still works.
      </p>
    </div>
  ),
};

export const SCENES: Scene[] = [What, Find, Match, Apply, Start];
