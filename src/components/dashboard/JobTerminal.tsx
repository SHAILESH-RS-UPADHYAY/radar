'use client';

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Modal } from '@/components/hud/Modal';
import { headerLines, jdLines, salaryFromText, sectionLine, type JobFacts, type TermLine, type Tone } from '@/lib/jd';
import { drawWords } from '@/lib/status-words';
import { useApi } from '@/lib/use-api';
import { timeAgo, type MatchAction, type MatchedJob } from './types';

/** GET /api/jobs/:id */
export interface JobDetail {
  job: {
    id: string;
    title: string;
    company: string;
    via: string | null;
    category: string;
    fundingStage: string | null;
    source: string | null;
    provider: string | null;
    providerName: string | null;
    location: string | null;
    workType: string | null;
    salary: { min: number | null; max: number | null; currency: string | null };
    applyUrl: string;
    description: string;
  };
  match: { score: number; matching: string[]; missing: string[]; status: string } | null;
  /** The reader's experience, so "3+ years" lines can say whether they fit. */
  you?: { experienceYears: number | null };
  posting: { state: 'live' | 'closed' | 'unknown'; checkedAt: string | null; via: 'feed' | 'link' | 'none' };
}

// The reference: a colour terminal printing a code diff — Monokai colours on pure black,
// deep red / green diff bands, grey line numbers.
const TONE: Record<Tone, string> = {
  plain: 'text-[#f8f8f2]',
  bold: 'font-bold text-[#ffffff]',
  dim: 'text-[#8a8a8a]',
  kw: 'text-[#f92672]',
  decl: 'text-[#66d9ef]',
  fn: 'text-[#a6e22e]',
  str: 'text-[#e6db74]',
  num: 'text-[#ae81ff]',
  req: 'text-[#fd971f]',
  comment: 'text-[#8a8a8a]',
  head: 'font-bold text-[#66d9ef]',
  // Your skills: white on their green box; your gaps: yellow on their red box.
  have: 'font-bold text-white',
  gap: 'font-bold text-[#ffe66d] underline decoration-dotted underline-offset-4',
  tech: 'text-[#66d9ef]',
  link: 'text-[#66d9ef] underline underline-offset-4',
  // Only on banded lines: prose syntax-coloured like code in a diff.
  conj: 'text-[#f92672]',
  verb: 'text-[#a6e22e]',
  name: 'text-[#e6db74]',
};
// Keyword pink turns lighter on a red band, to stay readable there.
const ON_RED: Partial<Record<Tone, string>> = { conj: 'text-[#ff8fb1]' };
// '~' is a posting detail that touches neither: a deep blue band, so most of the briefing is banded.
const BAND = { '+': 'bg-[#003e00]', '-': 'bg-[#500000]', '~': 'bg-[#0c2340]' } as const;
const NUMBER = { '+': 'text-[#5fd35f]', '-': 'text-[#ff6b6b]', '~': 'text-[#6cb6ff]' } as const;
// The words that earned a line its colour get a brighter box, like changed characters in a diff.
const HL = {
  '+': 'rounded-[2px] bg-[#127a12]',
  '-': 'rounded-[2px] bg-[#9c1616]',
  '~': 'rounded-[2px] bg-[#1d4d80]',
} as const;
// Status line while a briefing types: each word decrypts itself in its own colour, next to a radar sweep.
const HUES = ['#66d9ef', '#f92672', '#ae81ff', '#e6db74', '#a6e22e'];
const WORD_MS = 1700;
const DECRYPT_MS = 420;
const NOISE_MS = 45;
const NOISE = '01<>/\\|{}[]#$%&*+=?!^~ABCDEF';

// Typing pace: a fast typist, uneven like a person, pausing at line ends — slow enough to read along.
const BASE_CPS = 140;
const MAX_MS = 13_000;
const PAUSE: Record<TermLine['kind'], number> = { section: 320, head: 200, code: 60, bullet: 90, text: 80, blank: 50 };

const lineLength = (l: TermLine) => l.segs.reduce((n, s) => n + s.text.length, 0) || 1;
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

interface Beat {
  start: number;
  end: number;
  len: number;
}

/** When each line starts and finishes typing. Long briefings speed up to finish within MAX_MS. */
function schedule(lines: TermLine[]): { beats: Beat[]; total: number } {
  const raw = lines.map((l, i) => {
    const len = lineLength(l);
    const jitter = 0.78 + ((((i + 1) * 7919) % 97) / 97) * 0.5; // steady per line, 0.78–1.28×
    return { len, ms: (len / (BASE_CPS * jitter)) * 1000, pause: PAUSE[l.kind] };
  });
  const natural = raw.reduce((t, r) => t + r.ms + r.pause, 0);
  const k = natural > MAX_MS ? MAX_MS / natural : 1;
  let t = 0;
  const beats = raw.map((r) => {
    const start = t + r.pause * k;
    t = start + r.ms * k;
    return { start, end: t, len: r.len };
  });
  return { beats, total: t };
}

const Caret = ({ blink }: { blink: boolean }) => (
  <span
    className={
      'ml-px inline-block h-[1.15em] w-[0.58em] translate-y-[3px] bg-[#e8e8e8] ' + (blink ? 'caret-blink' : '')
    }
  />
);

/** A tiny radar scope: the beam turns while RADAR works. */
const Sweep = ({ color }: { color: string }) => (
  <span
    className="relative inline-block size-[0.95em] shrink-0 overflow-hidden rounded-full border"
    style={{ borderColor: color + '80' }}
  >
    <span
      className="absolute inset-0 animate-spin rounded-full [animation-duration:1.4s] motion-reduce:animate-none"
      style={{ background: `conic-gradient(transparent 65%, ${color})` }}
    />
    <span
      className="absolute left-1/2 top-1/2 size-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{ background: color }}
    />
  </span>
);

/** Random glyphs settle into the word, left to right, then the RADAR glitch flickers over it now and then. */
function Decrypt({ word, color, reduce }: { word: string; color: string; reduce: boolean }) {
  const solid = useRef<HTMLSpanElement>(null);
  const noise = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const s = solid.current;
    const n = noise.current;
    if (!s || !n) return;
    if (reduce) {
      s.textContent = word;
      n.textContent = '';
      return;
    }
    let raf = 0;
    let t0 = 0;
    let rolled = -Infinity;
    let glyphs: string[] = [];
    const frame = (t: number) => {
      if (!t0) t0 = t;
      const settled = Math.min(word.length, Math.floor(((t - t0) / DECRYPT_MS) * word.length));
      if (t - rolled > NOISE_MS) {
        rolled = t;
        glyphs = [...word].map((c) => (c === ' ' ? ' ' : NOISE[Math.floor(Math.random() * NOISE.length)]));
      }
      s.textContent = word.slice(0, settled);
      n.textContent = glyphs.slice(settled).join('');
      if (settled < word.length) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [word, reduce]);

  // React never renders text into these spans, so the effect can rewrite them every frame.
  return (
    <span className="shrink-0" style={{ color, textShadow: `0 0 10px ${color}66` }}>
      <span className="glitch" data-text={word}>
        <span ref={solid} />
        <span ref={noise} className="opacity-50" />
      </span>
      <span className="caret-blink">_</span>
    </span>
  );
}

/** One row: "⎿" section lines outside the gutter; numbered lines with a +/- band like a diff. */
const Row = memo(function Row({
  line,
  n,
  chars,
  caret,
  blink,
}: {
  line: TermLine;
  n: number | null;
  chars: number;
  caret: boolean;
  blink: boolean;
}) {
  let left = chars;
  const parts = [];
  for (let i = 0; i < line.segs.length && left > 0; i++) {
    const text = line.segs[i].text.slice(0, left);
    left -= text.length;
    const seg = line.segs[i];
    const box = seg.tone === 'have' ? '+' : seg.tone === 'gap' ? '-' : line.mark;
    parts.push(
      <span
        key={i}
        className={((line.mark === '-' && ON_RED[seg.tone]) || TONE[seg.tone]) + (seg.hl && box ? ' ' + HL[box] : '')}
      >
        {text}
      </span>,
    );
  }
  const content = (
    <span className="min-w-0 flex-1 whitespace-pre-wrap break-words pr-4">
      {parts}
      {caret && <Caret blink={blink} />}
    </span>
  );
  if (line.kind === 'section')
    return (
      <div className="flex pt-1.5">
        <span className="w-[2.5ch] shrink-0 select-none text-center text-[#8a8a8a]">⎿</span>
        {content}
      </div>
    );
  const mark = line.mark;
  return (
    <div className="flex">
      <span className="w-[2.5ch] shrink-0" />
      <div className={'flex min-w-0 flex-1 ' + (mark ? BAND[mark] : '')}>
        <span className={'w-[4.5ch] shrink-0 select-none text-right ' + (mark ? NUMBER[mark] : 'text-[#6e6e6e]')}>
          {n}
        </span>
        <span className={'w-[2.5ch] shrink-0 select-none text-center ' + (mark ? NUMBER[mark] : '')}>
          {mark === '-' ? '−' : mark || ''}
        </span>
        {content}
      </div>
    </div>
  );
});

function buildLines(d: JobDetail, fallback: MatchedJob): TermLine[] {
  const { job, match, posting } = d;
  const have = match?.matching ?? fallback.matching_skills;
  const missing = match?.missing ?? fallback.missing_skills;
  const feedPay =
    job.salary.min || job.salary.max
      ? [
          job.salary.currency,
          [job.salary.min, job.salary.max]
            .filter(Boolean)
            .map((n) => n!.toLocaleString('en-US'))
            .join(' – '),
        ]
          .filter(Boolean)
          .join(' ')
      : null;
  const jdPay = feedPay ? null : salaryFromText(job.description);
  const origin =
    job.source === 'startupmap' ? 'found on StartupMap' : job.source === 'import' ? 'from your import' : null;
  const state = posting.state === 'live' ? 'LIVE' : posting.state === 'closed' ? 'CLOSED' : 'UNVERIFIED';
  const checked =
    posting.state === 'closed'
      ? 'taken down' + (posting.checkedAt ? ' · seen ' + timeAgo(posting.checkedAt) : '')
      : posting.via === 'feed'
        ? `in ${job.providerName || 'the company'} feed ${timeAgo(posting.checkedAt) || ''}`.trim()
        : posting.via === 'link'
          ? posting.state === 'live'
            ? 'apply link checked ' + (timeAgo(posting.checkedAt) || 'just now')
            : 'apply link could not be checked right now'
          : 'a forum post — confirm on the thread';
  const facts: JobFacts = {
    title: job.title,
    company: job.company,
    companyNote: [job.fundingStage, origin, job.via ? 'via ' + job.via : null].filter(Boolean).join(' · ') || null,
    where:
      [
        job.location,
        job.workType && !(job.location || '').toLowerCase().includes(job.workType) ? job.workType.toUpperCase() : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'Not specified',
    salary: feedPay || jdPay,
    salaryNote: feedPay || jdPay ? null : 'not disclosed',
    score: match?.score ?? fallback.score,
    have,
    missing,
    posting: state,
    postingNote: checked,
  };
  const body: TermLine[] = job.description.trim()
    ? jdLines(job.description, have, missing, { years: d.you?.experienceYears ?? null, company: job.company })
    : [
        {
          kind: 'text',
          mark: null,
          segs: [{ text: '// No description published. Open the posting.', tone: 'comment' }],
        },
      ];
  const plus = body.filter((l) => l.mark === '+').length;
  const minus = body.filter((l) => l.mark === '-').length;
  return [
    sectionLine(`Opened job://${slug(job.company)}/${slug(job.title)}`, `(match ${facts.score}% · ${state})`),
    ...headerLines(facts),
    sectionLine('Read briefing.md', `(+${plus} −${minus})`),
    ...body,
    sectionLine('DONE', `(${checked})`),
  ];
}

function TerminalView({
  match,
  demo,
  onClose,
  onAction,
  onInfiltrate,
  onHack,
}: {
  match: MatchedJob;
  demo?: JobDetail;
  onClose: () => void;
  onAction?: (id: string, action: MatchAction) => void;
  onInfiltrate?: (id: string) => void;
  onHack?: (id: string) => void;
}) {
  const api = useApi();
  const reduce = useReducedMotion();
  const [detail, setDetail] = useState<JobDetail | null>(demo ?? null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [copied, setCopied] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const lastTop = useRef(0);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    api(`/api/jobs/${match.job.id}?verify=1`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
        if (!cancelled) setDetail(d);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [api, match.job.id, attempt, demo]);

  const lines = useMemo(() => (detail ? buildLines(detail, match) : []), [detail, match]);
  const { beats, total } = useMemo(() => schedule(lines), [lines]);
  const numbers = useMemo(() => {
    let n = 0;
    return lines.map((l) => (l.kind === 'section' ? null : ++n));
  }, [lines]);
  const done = lines.length > 0 && (skipped || !!reduce || elapsed >= total);

  // Fresh status words for every briefing, a new one every WORD_MS until the typing is done.
  const [words] = useState(() => drawWords(16));
  const [wordIdx, setWordIdx] = useState(0);
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setWordIdx((i) => Math.min(i + 1, words.length - 1)), WORD_MS);
    return () => clearInterval(id);
  }, [done, words.length]);

  // The typewriter clock. Rows read it to know how much of each line to show.
  useEffect(() => {
    if (!lines.length || skipped || reduce) return;
    let raf = 0;
    let t0 = 0;
    const tick = (t: number) => {
      if (!t0) t0 = t;
      const e = t - t0;
      setElapsed(e);
      const el = scroller.current;
      if (el && follow.current) {
        const gap = el.scrollHeight - el.clientHeight - el.scrollTop;
        if (gap > 0.5) {
          el.scrollTop += Math.max(1, gap * 0.16);
          lastTop.current = el.scrollTop;
        }
      }
      if (e < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lines, total, skipped, reduce]);

  // Rows up to the one being typed. Finished rows keep stable props, so only the live row re-renders.
  const rows: { i: number; chars: number }[] = [];
  let typed = 0;
  for (let i = 0; i < lines.length; i++) {
    const b = beats[i];
    if (!done && elapsed < b.start) break;
    const chars = done
      ? b.len
      : Math.min(b.len, Math.floor(b.len * Math.min(1, (elapsed - b.start) / Math.max(1, b.end - b.start))));
    typed += chars;
    rows.push({ i, chars });
  }
  const last = rows.length - 1;

  // Skipping means "show me all of it": start reading from line 1.
  useLayoutEffect(() => {
    if (skipped) scroller.current?.scrollTo({ top: 0 });
  }, [skipped]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const top = el.scrollTop;
    const bottom = el.scrollHeight - top - el.clientHeight < 40;
    setAtBottom(bottom);
    if (bottom) follow.current = true;
    else if (top < lastTop.current - 4) follow.current = false;
    lastTop.current = top;
  };
  const jump = useCallback(
    (to: 'top' | 'bottom') => {
      const el = scroller.current;
      el?.scrollTo({ top: to === 'top' ? 0 : el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
    },
    [reduce],
  );

  const status = match.status;
  const applyUrl = detail?.job.applyUrl || match.job.apply_url;
  // ↯ HACK: one click, the form opens filled (RADAR extension). On the landing page's sample it leads to sign-up.
  const canHack = status !== 'applied' && (!!onHack || !!demo);
  const hack = useCallback(() => {
    if (!canHack) return;
    if (!onHack) return window.location.assign(applyUrl);
    onClose();
    onHack(match.id);
  }, [canHack, onHack, applyUrl, onClose, match.id]);
  const vault = useCallback(() => status === 'new' && onAction?.(match.id, 'SAVE'), [status, onAction, match.id]);
  // INFILTRATE ▸: the step-by-step run (tailored resume, every answer of the form, then the form).
  const canInfiltrate = status !== 'applied' && !!onInfiltrate;
  const infiltrate = useCallback(() => {
    if (!canInfiltrate) return;
    onClose();
    onInfiltrate!(match.id);
  }, [canInfiltrate, onInfiltrate, onClose, match.id]);
  const copy = useCallback(async () => {
    await navigator.clipboard
      .writeText(
        [`${match.job.title} — ${match.job.company.name}`, applyUrl, '', detail?.job.description || ''].join('\n'),
      )
      .catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [detail, match.job.title, match.job.company.name, applyUrl]);

  // Any key skips the typing. After that: H hack · I infiltrate · V vault · C copy · Home / End jump.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Tab' || e.metaKey || e.altKey) return;
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
      if (!done) {
        if (lines.length) {
          e.preventDefault();
          setSkipped(true);
        }
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        jump('bottom');
      } else if (e.key === 'Home') {
        e.preventDefault();
        jump('top');
      } else if (!e.ctrlKey) {
        const k = e.key.toLowerCase();
        if (k === 'h') hack();
        else if (k === 'i') infiltrate();
        else if (k === 'v') vault();
        else if (k === 'c') void copy();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, lines.length, hack, infiltrate, vault, copy, jump]);

  const posting = detail?.posting.state;
  const hue = HUES[wordIdx % HUES.length];
  const cps = elapsed > 300 ? Math.round(typed / (elapsed / 1000)) : 0;
  const hint = 'rounded-sm px-2 py-1 transition-colors hover:bg-[#1f1f1f] focus-visible:bg-[#1f1f1f]';
  const key = 'mr-1.5 text-[#8a8a8a]';

  return (
    <div className="flex h-full min-h-0 flex-col font-mono text-[12.5px] leading-[1.7] sm:text-[13.5px] 2xl:text-[14.5px]">
      {/* The prompt that opened this, as the reference terminal shows the last command. */}
      <div className="flex shrink-0 items-center gap-3 bg-[#2b2b2b] px-3 py-1.5 text-[#a3a3a3]">
        <p className="min-w-0 flex-1 truncate">
          &gt; radar open &quot;{match.job.title}&quot; --company {match.job.company.name}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close (Esc)"
          className="shrink-0 px-1 text-[#8a8a8a] transition-colors hover:text-white"
        >
          esc ✕
        </button>
      </div>

      <div className="sr-only" aria-live="polite">
        {detail ? `${detail.job.title} at ${detail.job.company}.` : 'Loading job'}
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={onScroll}
          onClick={() => !done && lines.length && setSkipped(true)}
          aria-label="Job description"
          tabIndex={0}
          className="custom-scrollbar absolute inset-0 overflow-y-auto px-1 pb-10 pt-2 focus:outline-none sm:px-3"
        >
          {error ? (
            <div className="flex pt-1.5">
              <span className="w-[2.5ch] shrink-0 text-center text-[#8a8a8a]">⎿</span>
              <span className="text-[#ff6b6b]">
                Error: could not open this job ({error}).{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setAttempt((a) => a + 1);
                  }}
                  className="text-[#66d9ef] underline underline-offset-4"
                >
                  retry
                </button>
              </span>
            </div>
          ) : !detail ? (
            <div className="flex pt-1.5 text-[#8a8a8a]">
              <span className="w-[2.5ch] shrink-0 text-center">⎿</span>
              <span>
                Opening job://{slug(match.job.company.name)} and checking the posting
                <Caret blink />
              </span>
            </div>
          ) : (
            <>
              <div aria-hidden="true">
                {rows.map(({ i, chars }) => (
                  <Row
                    key={i}
                    line={lines[i]}
                    n={numbers[i]}
                    chars={chars}
                    caret={i === last}
                    blink={done || chars >= beats[i].len}
                  />
                ))}
              </div>
              {/* Screen readers get the whole description at once instead of the animation. */}
              <div className="sr-only">{detail.job.description}</div>
            </>
          )}
        </div>

        {done && !atBottom && (
          <button
            type="button"
            onClick={() => jump('bottom')}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#3a3a3a] px-3 py-0.5 text-[#ececec] transition-colors hover:bg-[#4a4a4a]"
          >
            Jump to bottom<span className="hidden sm:inline"> (ctrl+End)</span> ↓
          </button>
        )}
      </div>

      <div className="shrink-0 px-3 pb-2 pt-1 sm:px-4">
        {!done ? (
          !error && (
            <p aria-hidden="true" className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
              <Sweep color={hue} />
              <Decrypt word={words[wordIdx]} color={hue} reduce={!!reduce} />
              <span className="tabular-nums text-[#8a8a8a]">
                T+{(elapsed / 1000).toFixed(1)}s<span className="text-[#4a4a4a]"> │ </span>
                {(typed / 1000).toFixed(1)}k chars
                <span className="hidden sm:inline">
                  <span className="text-[#4a4a4a]"> │ </span>
                  {cps} c/s
                </span>
              </span>
              <span className="ml-auto hidden text-[#6e6e6e] sm:inline">[any key] skip</span>
            </p>
          )
        ) : (
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
            {canHack && (
              <button type="button" onClick={hack} className={hint}>
                <span className={key}>h</span>
                <span className="text-[#a6e22e]">↯ hack</span>
              </button>
            )}
            {canInfiltrate && (
              <button type="button" onClick={infiltrate} className={hint}>
                <span className={key}>i</span>
                <span className="text-[#f92672]">infiltrate ▸</span>
              </button>
            )}
            {status === 'new' && onAction && (
              <button type="button" onClick={vault} className={hint}>
                <span className={key}>v</span>
                <span className="text-[#66d9ef]">add to vault</span>
              </button>
            )}
            <button type="button" onClick={() => void copy()} className={hint}>
              <span className={key}>c</span>
              <span className="text-[#f8f8f2]">{copied ? 'copied ✓' : 'copy'}</span>
            </button>
            <span className="ml-auto flex items-center gap-4 px-2 text-[#8a8a8a]">
              <span
                className={
                  posting === 'live' ? 'text-[#a6e22e]' : posting === 'closed' ? 'text-[#ff6b6b]' : 'text-[#e6db74]'
                }
              >
                ● {posting === 'live' ? 'live' : posting === 'closed' ? 'closed' : 'unverified'}
              </span>
              <span className="hidden sm:inline">esc to close</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** The JD terminal: click any job card to open it. */
export function JobTerminal({
  match,
  demo,
  onClose,
  onAction,
  onInfiltrate,
  onHack,
}: {
  match: MatchedJob | null;
  /** Preloaded detail instead of fetching (the landing page sample). */
  demo?: JobDetail;
  onClose: () => void;
  onAction?: (id: string, action: MatchAction) => void;
  onInfiltrate?: (id: string) => void;
  onHack?: (id: string) => void;
}) {
  return (
    <Modal open={!!match} onClose={onClose} label={match ? `Job: ${match.job.title}` : 'Job'} variant="terminal">
      {match && (
        <TerminalView
          key={match.id}
          match={match}
          demo={demo}
          onClose={onClose}
          onAction={onAction}
          onInfiltrate={onInfiltrate}
          onHack={onHack}
        />
      )}
    </Modal>
  );
}
