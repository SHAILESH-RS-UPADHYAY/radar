'use client';

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Modal } from '@/components/hud/Modal';
import { StatusLight, type Tone as LightTone } from '@/components/hud/Hud';
import { headerLines, jdLines, type JobFacts, type TermLine, type Tone } from '@/lib/jd';
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
  posting: { state: 'live' | 'closed' | 'unknown'; checkedAt: string | null; via: 'feed' | 'link' | 'none' };
}

// Claude Code's diff view: black, salmon keywords, teal names, lime strings, green/red bands.
const TONE: Record<Tone, string> = {
  plain: 'text-[#e6edf3]',
  dim: 'text-[#6e7681]',
  kw: 'text-[#ff7b72]',
  type: 'text-[#56d4bc]',
  str: 'text-[#c3e88d]',
  num: 'text-[#f2cc60]',
  comment: 'text-[#8b949e]',
  head: 'font-bold text-[#ff7b72]',
  have: 'font-bold text-[#7ee787]',
  gap: 'font-bold text-[#ffa198] underline decoration-dotted underline-offset-2',
  link: 'text-[#79c0ff] underline underline-offset-2',
};
const BAND = { '+': 'bg-[#0f3d1a]', '-': 'bg-[#4c1418]' } as const;
const GUTTER = { '+': 'text-[#7ee787]', '-': 'text-[#ffa198]' } as const;

const lineLength = (l: TermLine) => l.segs.reduce((n, s) => n + s.text.length, 0) || 1;
/** Fast enough to feel like someone hammering keys: ~1s for a short JD, never more than ~2.6s. */
const typingMs = (chars: number) => Math.min(2600, Math.max(900, 600 + chars * 0.14));
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

const Caret = ({ blink }: { blink: boolean }) => (
  <span
    className={
      'ml-px inline-block h-[1.1em] w-[0.6em] translate-y-[3px] bg-phosphor shadow-[0_0_8px_#00FF41] ' +
      (blink ? 'caret-blink' : '')
    }
  />
);

/** One diff-style row: line number, +/- marker, then the first `chars` characters of its segments. */
const Row = memo(function Row({
  line,
  n,
  chars,
  caret,
  blink,
}: {
  line: TermLine;
  n: number;
  chars: number;
  caret: boolean;
  blink: boolean;
}) {
  if (line.kind === 'fold')
    return (
      <div className="flex text-[#6e7681]">
        <span className="w-10 shrink-0 select-none pr-3 text-right sm:w-12">...</span>
      </div>
    );
  let left = chars;
  const parts = [];
  for (let i = 0; i < line.segs.length && left > 0; i++) {
    const text = line.segs[i].text.slice(0, left);
    left -= text.length;
    parts.push(
      <span key={i} className={TONE[line.segs[i].tone]}>
        {text}
      </span>,
    );
  }
  const mark = line.mark;
  return (
    <div className={'flex ' + (mark ? BAND[mark] : '')}>
      <span className={'w-10 shrink-0 select-none pr-3 text-right sm:w-12 ' + (mark ? GUTTER[mark] : 'text-[#5c6370]')}>
        {n}
      </span>
      <span className={'w-4 shrink-0 select-none ' + (mark ? GUTTER[mark] : '')}>{mark || ' '}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words pr-3">
        {parts}
        {caret && <Caret blink={blink} />}
      </span>
    </div>
  );
});

function buildLines(d: JobDetail, fallback: MatchedJob): TermLine[] {
  const { job, match, posting } = d;
  const have = match?.matching ?? fallback.matching_skills;
  const missing = match?.missing ?? fallback.missing_skills;
  const pay =
    job.salary.min || job.salary.max
      ? [job.salary.currency, [job.salary.min, job.salary.max].filter(Boolean).join(' – ')].filter(Boolean).join(' ')
      : null;
  const origin =
    job.source === 'startupmap' ? 'found on StartupMap' : job.source === 'import' ? 'from your import' : null;
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
    pay,
    score: match?.score ?? fallback.score,
    matched: have.length,
    gaps: missing.length,
    posting: posting.state === 'live' ? 'LIVE' : posting.state === 'closed' ? 'CLOSED' : 'UNVERIFIED',
    postingNote:
      posting.state === 'closed'
        ? 'taken down' + (posting.checkedAt ? ' · seen ' + timeAgo(posting.checkedAt) : '')
        : posting.via === 'feed'
          ? `in ${job.providerName || 'the company'} feed ${timeAgo(posting.checkedAt) || ''}`.trim()
          : posting.via === 'link'
            ? posting.state === 'live'
              ? 'apply link checked ' + (timeAgo(posting.checkedAt) || 'just now')
              : 'apply link could not be checked right now'
            : 'a forum post — confirm on the thread',
  };
  const body = job.description.trim()
    ? jdLines(job.description, have, missing)
    : [
        {
          kind: 'text' as const,
          mark: null,
          segs: [{ text: '// No description published. Open the posting.', tone: 'comment' as const }],
        },
      ];
  return [...headerLines(facts), ...body];
}

function TerminalView({
  match,
  demo,
  onClose,
  onAction,
  onRun,
}: {
  match: MatchedJob;
  demo?: JobDetail;
  onClose: () => void;
  onAction?: (id: string, action: MatchAction) => void;
  onRun?: (id: string) => void;
}) {
  const api = useApi();
  const reduce = useReducedMotion();
  const [detail, setDetail] = useState<JobDetail | null>(demo ?? null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [shown, setShown] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [copied, setCopied] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const follow = useRef(true);

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
  const starts = useMemo(() => {
    const out: number[] = [];
    lines.reduce((at, l) => (out.push(at), at + lineLength(l)), 0);
    return out;
  }, [lines]);
  const total = lines.length ? starts[starts.length - 1] + lineLength(lines[lines.length - 1]) : 0;
  const done = total > 0 && (skipped || !!reduce || shown >= total);
  const visible = done ? total : shown;

  // The typewriter: characters per frame scale with the JD, so every briefing lands in about two seconds.
  useEffect(() => {
    if (!total || skipped || reduce) return;
    let raf = 0;
    let last = 0;
    let count = 0;
    const perMs = total / typingMs(total);
    const tick = (t: number) => {
      if (last) count = Math.min(total, count + Math.max(1, Math.round((t - last) * perMs)));
      last = t;
      setShown(count);
      if (count < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total, skipped, reduce]);

  // Follow the output like a terminal while it types; once done, go back to line 1 to read.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && !done && follow.current) el.scrollTop = el.scrollHeight;
  }, [visible, done]);
  useEffect(() => {
    if (done && follow.current) scroller.current?.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }, [done, reduce]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    setAtBottom(bottom);
    if (!done) follow.current = bottom;
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
  const apply = useCallback(() => {
    window.open(applyUrl, '_blank', 'noopener,noreferrer');
    if (status !== 'applied') onAction?.(match.id, 'APPLY');
  }, [applyUrl, status, onAction, match.id]);
  const vault = useCallback(() => status === 'new' && onAction?.(match.id, 'SAVE'), [status, onAction, match.id]);
  const hack = useCallback(() => {
    if (status !== 'saved' || !onRun) return;
    onClose();
    onRun(match.id);
  }, [status, onRun, onClose, match.id]);
  const copy = useCallback(async () => {
    const d = detail?.job;
    await navigator.clipboard
      .writeText([`${match.job.title} — ${match.job.company.name}`, applyUrl, '', d?.description || ''].join('\n'))
      .catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [detail, match.job.title, match.job.company.name, applyUrl]);

  // Any key skips the typing. After that: A apply · V vault · H hack · C copy · Home / Ctrl+End jump.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Tab' || e.metaKey || e.altKey) return;
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
      if (!done) {
        if (total) {
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
        if (k === 'a') apply();
        else if (k === 'v') vault();
        else if (k === 'h') hack();
        else if (k === 'c') void copy();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, total, apply, vault, hack, copy, jump]);

  const posting = detail?.posting;
  const [light, lightTone]: [string, LightTone] = !detail
    ? ['CHECKING', 'idle']
    : posting!.state === 'live'
      ? ['LIVE', 'ok']
      : posting!.state === 'closed'
        ? ['CLOSED', 'alert']
        : ['UNVERIFIED', 'warn'];
  const plus = lines.filter((l) => l.mark === '+' && l.kind !== 'code').length;
  const minus = lines.filter((l) => l.mark === '-' && l.kind !== 'code').length;

  // Rows up to the one being typed; finished rows keep stable props, so only the live row re-renders.
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    if (starts[i] >= visible && i > 0) break;
    const len = lineLength(lines[i]);
    const chars = Math.min(len, visible - starts[i]);
    const typing = visible < starts[i] + len || i === lines.length - 1;
    rows.push(<Row key={i} line={lines[i]} n={i + 1} chars={chars} caret={typing} blink={done} />);
  }

  const key = 'rounded-sm border border-[#3a3f47] px-1 text-[10px] text-[#8b949e]';
  const action =
    'flex items-center gap-2 border px-3 py-2 font-mono text-[11px] font-bold tracking-[0.15em] transition-colors';

  return (
    <div className="relative flex h-[82vh] min-h-0 flex-col bg-black font-mono text-[12px] leading-[1.6] sm:h-[80vh] sm:text-[13px]">
      {/* The prompt, as in the terminal it imitates. */}
      <div className="flex shrink-0 items-center justify-between gap-3 bg-[#1c1f24] px-3 py-1.5 text-[#8b949e]">
        <p className="min-w-0 truncate">
          <span className="text-[#6e7681]">&gt; </span>radar open job://{slug(match.job.company.name)}/
          {slug(match.job.title)} --verify
        </p>
        <StatusLight tone={lightTone} pulse={!detail}>
          {light}
        </StatusLight>
      </div>

      <div className="sr-only" aria-live="polite">
        {detail ? `${detail.job.title} at ${detail.job.company}. Posting ${light.toLowerCase()}.` : 'Loading job'}
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={onScroll}
          onClick={() => !done && total && setSkipped(true)}
          aria-label="Job description"
          tabIndex={0}
          className="custom-scrollbar absolute inset-0 overflow-y-auto py-2 focus:outline-none"
        >
          {error ? (
            <div className="px-4 py-3">
              <p className="text-[#ffa198]">! could not load this job: {error}</p>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setAttempt((a) => a + 1);
                }}
                className="mt-3 border border-phosphor/40 px-3 py-1.5 text-[11px] tracking-[0.2em] text-phosphor hover:bg-phosphor/10"
              >
                RETRY
              </button>
            </div>
          ) : !detail ? (
            <p className="px-4 text-[#8b949e]">
              <span className="text-phosphor">$</span> fetching job://{slug(match.job.company.name)} · verifying posting
              <Caret blink />
            </p>
          ) : (
            <>
              <div aria-hidden="true">{rows}</div>
              {/* Screen readers get the whole description at once instead of the animation. */}
              <div className="sr-only">{detail.job.description}</div>
            </>
          )}
        </div>

        {done && !atBottom && (
          <button
            type="button"
            onClick={() => jump('bottom')}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#3a3f47] px-3 py-1 text-[11px] text-[#e6edf3] shadow-lg transition-colors hover:bg-[#4a5059]"
          >
            Jump to bottom<span className="hidden sm:inline"> (ctrl+End)</span> ↓
          </button>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#262a31] bg-[#0d1014] px-3 py-2">
        <p className="text-[11px] text-[#8b949e]">
          {!detail ? (
            'connecting…'
          ) : !done ? (
            <>
              <span className="text-phosphor">▌</span> decrypting briefing {Math.round((visible / total) * 100)}% ·{' '}
              <span className="text-[#6e7681]">any key to skip</span>
            </>
          ) : (
            <>
              <span className="text-[#7ee787]">+{plus}</span> matching lines ·{' '}
              <span className="text-[#ffa198]">-{minus}</span> gap lines · {lines.length} lines
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={apply}
            className={action + ' border-phosphor bg-phosphor text-black hover:bg-[#33FF66]'}
          >
            <kbd className="rounded-sm border border-black/30 px-1 text-[10px]">A</kbd> APPLY ↗
          </button>
          {status === 'new' && onAction && (
            <button
              type="button"
              onClick={vault}
              className={action + ' border-phosphor/50 text-phosphor hover:bg-phosphor/10'}
            >
              <kbd className={key}>V</kbd> + VAULT
            </button>
          )}
          {status === 'saved' && onRun && (
            <button
              type="button"
              onClick={hack}
              className={action + ' border-phosphor/50 text-phosphor hover:bg-phosphor/10'}
            >
              <kbd className={key}>H</kbd> HACK ▸
            </button>
          )}
          <button
            type="button"
            onClick={() => void copy()}
            className={action + ' border-[#3a3f47] text-[#c9d1d9] hover:border-phosphor/50 hover:text-phosphor'}
          >
            <kbd className={key}>C</kbd> {copied ? 'COPIED ✓' : 'COPY'}
          </button>
        </div>
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
  onRun,
}: {
  match: MatchedJob | null;
  /** Preloaded detail instead of fetching (the landing page sample). */
  demo?: JobDetail;
  onClose: () => void;
  onAction?: (id: string, action: MatchAction) => void;
  onRun?: (id: string) => void;
}) {
  return (
    <Modal
      open={!!match}
      onClose={onClose}
      label={match ? `JOB://${match.job.company.name.toUpperCase()}` : 'JOB://'}
      wide="xl"
      bodyClassName="flex min-h-0 flex-1 flex-col"
    >
      {match && (
        <TerminalView key={match.id} match={match} demo={demo} onClose={onClose} onAction={onAction} onRun={onRun} />
      )}
    </Modal>
  );
}
