'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { useApi } from '@/lib/use-api';
import { CopyButton } from '@/components/hud/CopyButton';
import type {
  CoachKind,
  FollowUp,
  LinkedIn,
  MockLine,
  MockTurn,
  Negotiate,
  Prep,
  Referral,
  Upskill,
} from '@/lib/coach';
import type { z } from 'zod';

const button = 'border px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.18em] transition-colors';
const primary = button + ' border-phosphor/50 text-phosphor hover:bg-phosphor/10 disabled:opacity-50';
const head = (tone = 'text-phosphor/70') => 'mb-1.5 font-mono text-[10px] tracking-[0.3em] ' + tone;
const input =
  'mt-1 w-full resize-y border border-phosphor/30 bg-black px-2 py-1.5 font-mono text-xs text-ink placeholder:text-phosphor/30 focus:border-phosphor/70 focus:outline-none';

/** Which COACH tools fit an application at this stage. */
export function kindsFor(stage: string): CoachKind[] {
  const kinds: CoachKind[] = [];
  if (['screening', 'interview', 'offer'].includes(stage)) kinds.push('prep', 'mock');
  if (['interview', 'offer'].includes(stage)) kinds.push('negotiate');
  if (['applied', 'screening'].includes(stage)) kinds.push('referral');
  if (stage !== 'withdrawn') kinds.push('followup');
  return kinds;
}

const TAB: Record<CoachKind, string> = {
  prep: '🎙 PREP',
  mock: '⚔ MOCK',
  followup: '✉ FOLLOW-UP',
  referral: '🤝 REFERRAL',
  negotiate: '💰 NEGOTIATE',
  upskill: 'UPSKILL',
  linkedin: 'LINKEDIN',
};

/** POST /api/coach with loading and error state. */
function useCoach<T>() {
  const api = useApi();
  const [data, setData] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api('/api/coach', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Request failed');
        setData(json.output as T);
        return json.output as T;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [api],
  );
  return { data, busy, error, run };
}

/** Same look as OVERCLOCK's running state: amber spinner and a label. */
const Status = ({ busy, error, label }: { busy: boolean; error: string | null; label: string }) =>
  busy ? (
    <p className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.2em] text-hud-amber">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-hud-amber/30 border-t-hud-amber" />
      {label}
    </p>
  ) : error ? (
    <p className="font-mono text-[11px] text-hud-red">✕ {error}</p>
  ) : null;

/** A text to paste somewhere, with a copy button and, where the site caps it, a live length. */
function Copyable({ title, text, limit }: { title: string; text: string; limit?: number }) {
  const over = !!limit && text.length > limit;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className={head(over ? 'text-hud-red' : undefined)}>
          {title}
          {limit ? ` · ${text.length}/${limit}` : ''}
        </p>
        <CopyButton value={text} />
      </div>
      <p
        className={
          'whitespace-pre-line border-l-2 pl-3 text-[13px] leading-relaxed text-ink/90 ' +
          (over ? 'border-hud-red' : 'border-phosphor/40')
        }
      >
        {text}
      </p>
    </div>
  );
}

const List = ({ title, items, tone }: { title: string; items: string[]; tone?: string }) =>
  items.length ? (
    <div>
      <p className={head(tone)}>{title}</p>
      <ul className="list-inside list-disc space-y-0.5 text-[12px] text-ink/80">
        {items.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
    </div>
  ) : null;

function PrepView({ prep }: { prep: z.infer<typeof Prep> }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-ink/90">{prep.company_brief}</p>
      <div>
        <p className={head()}>THEY WILL TEST</p>
        <p className="font-mono text-[11px] text-hud-cyan">{prep.role_focus.join(' · ')}</p>
      </div>
      <ol className="space-y-3">
        {prep.questions.map((q, i) => (
          <li key={i} className="border-l-2 border-phosphor/30 pl-3">
            <p className="font-mono text-xs font-bold text-phosphor">
              Q{i + 1}. {q.question}
            </p>
            <p className="text-[12px] text-dim">{q.why_they_ask}</p>
            {q.story.action && (
              <p className="mt-1 text-[12px] text-ink/80">
                <span className="text-hud-amber">S</span> {q.story.situation} <span className="text-hud-amber">T</span>{' '}
                {q.story.task} <span className="text-hud-amber">A</span> {q.story.action}{' '}
                <span className="text-hud-amber">R</span> {q.story.result}
              </p>
            )}
          </li>
        ))}
      </ol>
      <List title="ASK THEM" items={prep.ask_them} />
      <List title="WATCH OUT" items={prep.watch_out} tone="text-hud-amber" />
    </div>
  );
}

function ReferralView({ r }: { r: z.infer<typeof Referral> }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className={head()}>WHO TO ASK · EACH OPENS A LINKEDIN SEARCH</p>
        <ul className="space-y-2">
          {r.people.map((p, i) => (
            <li key={i}>
              <a
                href={'https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(p.search)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs font-bold text-hud-cyan underline-offset-4 hover:underline"
              >
                ↗ {p.who}
              </a>
              <p className="text-[12px] text-dim">{p.why}</p>
            </li>
          ))}
        </ul>
      </div>
      <Copyable title="CONNECTION NOTE" text={r.connection_note} limit={200} />
      <Copyable title="ONCE THEY ACCEPT" text={r.referral_ask} />
      <Copyable title="COLD EMAIL TO THE HIRING MANAGER" text={r.cold_email.subject + '\n\n' + r.cold_email.body} />
    </div>
  );
}

function FollowUpView({ f }: { f: z.infer<typeof FollowUp> }) {
  return (
    <div className="space-y-2 text-sm">
      <Copyable title={'SEND ' + f.send_after.toUpperCase()} text={f.subject + '\n\n' + f.body} />
    </div>
  );
}

/** Mock interview: the AI asks, you answer, it scores and asks the next one. Nothing is stored. */
function Mock({ matchId }: { matchId: string }) {
  const turn = useCoach<z.infer<typeof MockTurn>>();
  const [log, setLog] = useState<(MockLine & { feedback?: string; score?: number })[]>([]);
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');

  const send = async (history: MockLine[]) => {
    const out = await turn.run({ kind: 'mock', matchId, history });
    if (!out) return;
    setQuestion(out.next_question);
    if (history.length)
      setLog((l) => l.map((x, i) => (i === l.length - 1 ? { ...x, feedback: out.feedback, score: out.score } : x)));
  };

  return (
    <div className="space-y-3">
      {log.map((l, i) => (
        <div key={i} className="text-[12px]">
          <p className="font-mono text-phosphor">
            Q{i + 1}. {l.question}
          </p>
          <p className="text-ink/70">› {l.answer}</p>
          {l.feedback && (
            <p className="text-hud-cyan">
              [{l.score}/10] {l.feedback}
            </p>
          )}
        </div>
      ))}
      {question && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!answer.trim() || turn.busy) return;
            const next = [...log, { question, answer: answer.trim() }];
            setLog(next);
            setAnswer('');
            setQuestion(null);
            send(next.map(({ question: q, answer: a }) => ({ question: q, answer: a })));
          }}
        >
          <p className="font-mono text-xs font-bold text-phosphor">
            Q{log.length + 1}. {question}
          </p>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            aria-label="Your answer"
            placeholder="Answer like you would out loud"
            className={input}
          />
          <button type="submit" className={primary + ' mt-2'}>
            ANSWER ▸
          </button>
        </form>
      )}
      {!question && !turn.busy && (log.length === 0 || turn.error) && (
        <button
          type="button"
          onClick={() => send(log.map(({ question: q, answer: a }) => ({ question: q, answer: a })))}
          className={primary}
        >
          {log.length ? '↻ RETRY' : '▸ START MOCK INTERVIEW'}
        </button>
      )}
      <Status busy={turn.busy} error={turn.error} label="INTERVIEWER THINKING" />
    </div>
  );
}

/** Pay talk: what similar roles pay (RADAR's own postings) against your offer or your expected pay. Not stored. */
function NegotiateView({ matchId, stage }: { matchId: string; stage: string }) {
  const neg = useCoach<z.infer<typeof Negotiate>>();
  const [offer, setOffer] = useState('');
  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!neg.busy) neg.run({ kind: 'negotiate', matchId, offer: offer.trim() });
        }}
      >
        <label className="block">
          <span className={head()}>
            {stage === 'offer' ? 'THE OFFER, IN YOUR WORDS' : 'THE OFFER · EMPTY WHEN THEY ASKED YOUR EXPECTED PAY'}
          </span>
          <textarea
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="18 LPA fixed + 2 LPA variable, join in 30 days, no ESOPs"
            className={input}
          />
        </label>
        <button type="submit" disabled={neg.busy} className={primary + ' mt-2'}>
          {offer.trim() ? '▸ READ MY OFFER' : '▸ WHAT SHOULD I QUOTE'}
        </button>
      </form>
      <Status busy={neg.busy} error={neg.error} label="READING THE MARKET" />
      {neg.data && (
        <div className="space-y-4 text-sm">
          <p className="text-ink/90">{neg.data.read}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="border border-phosphor/40 p-2.5">
              <p className={head()}>ASK FOR</p>
              <p className="font-mono text-xs font-bold text-phosphor">{neg.data.counter}</p>
            </div>
            <div className="border border-hud-amber/40 p-2.5">
              <p className={head('text-hud-amber')}>WALK AWAY BELOW</p>
              <p className="font-mono text-xs text-hud-amber">{neg.data.walk_away}</p>
            </div>
          </div>
          <div>
            <p className={head()}>IF THE BASE IS FIXED, TRADE FOR</p>
            <p className="font-mono text-[11px] text-hud-cyan">{neg.data.levers.join(' · ')}</p>
          </div>
          <Copyable title="EMAIL" text={neg.data.email.subject + '\n\n' + neg.data.email.body} />
          <div>
            <p className={head()}>ON THE CALL</p>
            <ol className="list-inside list-decimal space-y-0.5 text-[12px] text-ink/80">
              {neg.data.call_script.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * COACH controls on one application or Vault job. Prep, follow-up and the referral kit load (cached, or written once)
 * when first opened; a tab stays mounted after that, so a mock interview survives switching tabs.
 */
export function CoachPanel({ matchId, stage, kinds }: { matchId: string; stage: string; kinds: CoachKind[] }) {
  const [open, setOpen] = useState<CoachKind | null>(null);
  const [opened, setOpened] = useState<CoachKind[]>([]);
  const prep = useCoach<z.infer<typeof Prep>>();
  const follow = useCoach<z.infer<typeof FollowUp>>();
  const referral = useCoach<z.infer<typeof Referral>>();
  const loaders = { prep, followup: follow, referral } as const;
  const labels = { prep: 'BUILDING PREP PACK · ~30S', followup: 'DRAFTING', referral: 'MAPPING WHO TO ASK' };

  const toggle = (kind: CoachKind) => {
    setOpen(open === kind ? null : kind);
    if (!opened.includes(kind)) setOpened([...opened, kind]);
    if (kind in loaders) {
      const l = loaders[kind as keyof typeof loaders];
      if (!l.data && !l.busy) void l.run({ kind, matchId });
    }
  };

  const body = (kind: CoachKind): ReactNode => {
    if (kind === 'mock') return <Mock matchId={matchId} />;
    if (kind === 'negotiate') return <NegotiateView matchId={matchId} stage={stage} />;
    if (!(kind in loaders)) return null;
    const l = loaders[kind as keyof typeof loaders];
    return (
      <div className="space-y-3">
        <Status busy={l.busy} error={l.error} label={labels[kind as keyof typeof labels]} />
        {prep.data && kind === 'prep' && <PrepView prep={prep.data} />}
        {follow.data && kind === 'followup' && <FollowUpView f={follow.data} />}
        {referral.data && kind === 'referral' && <ReferralView r={referral.data} />}
        {(l.data || l.error) && !l.busy && (
          <button
            type="button"
            onClick={() => l.run({ kind, matchId, force: !!l.data })}
            className={button + ' border-phosphor/25 text-dim hover:text-phosphor'}
          >
            {l.data ? '↻ WRITE AGAIN' : '↻ RETRY'}
          </button>
        )}
      </div>
    );
  };

  if (!kinds.length) return null;
  return (
    <MotionConfig reducedMotion="user">
      <div className="mt-3">
        <div className="flex flex-wrap gap-1.5">
          {kinds.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => toggle(kind)}
              aria-expanded={open === kind}
              className={
                button +
                (open === kind
                  ? ' border-phosphor bg-phosphor/10 text-phosphor'
                  : ' border-phosphor/25 text-phosphor/80 hover:bg-phosphor/10')
              }
            >
              {TAB[kind]}
            </button>
          ))}
        </div>
        {/* data-no-open: reading or selecting text here must not open the JD terminal behind the card. */}
        <div data-no-open hidden={!open} className="mt-3 border border-phosphor/20 bg-black/50 p-3">
          {opened.map((kind) => (
            // Each tab's answer slides in when it is shown; the panel stays mounted, so state survives.
            <motion.div
              key={kind}
              hidden={open !== kind}
              initial={false}
              animate={open === kind ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
              transition={{ duration: 0.22 }}
            >
              {body(kind)}
            </motion.div>
          ))}
        </div>
      </div>
    </MotionConfig>
  );
}

/** UPSKILL: the skills your open matches ask for most, turned into a learning plan with proof projects. */
export function UpskillPanel() {
  const plan = useCoach<z.infer<typeof Upskill>>();
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={plan.busy}
        onClick={() => plan.run({ kind: 'upskill', force: !!plan.data })}
        className={primary}
      >
        {plan.data ? '↻ REBUILD PLAN' : '▸ MAP MY SKILL GAPS'}
      </button>
      <Status busy={plan.busy} error={plan.error} label="READING YOUR GAPS ACROSS EVERY MATCH" />
      {plan.data && (
        <ol className="grid gap-3 md:grid-cols-2">
          {plan.data.plan.map((p, i) => (
            <li key={i} className="border border-phosphor/20 p-3 text-[12px]">
              <p className="font-mono text-xs font-bold text-phosphor">
                {String(i + 1).padStart(2, '0')} · {p.skill.toUpperCase()}{' '}
                <span className="font-normal text-dim">~{p.hours}h</span>
              </p>
              <p className="mt-1 text-dim">{p.why}</p>
              <ul className="mt-2 list-inside list-disc text-ink/80">
                {p.steps.map((s, k) => (
                  <li key={k}>{s}</li>
                ))}
              </ul>
              <p className="mt-2 text-hud-cyan">PROOF ▸ {p.proof_project}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** INBOUND: your LinkedIn headline and About rewritten for the roles you target, so recruiters find you. */
export function LinkedInPanel() {
  const li = useCoach<z.infer<typeof LinkedIn>>();
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={li.busy}
        onClick={() => li.run({ kind: 'linkedin', force: !!li.data })}
        className={primary}
      >
        {li.data ? '↻ REWRITE AGAIN' : '▸ REWRITE MY LINKEDIN'}
      </button>
      <Status busy={li.busy} error={li.error} label="REWRITING YOUR PROFILE" />
      {li.data && (
        <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-4">
            <Copyable title="HEADLINE" text={li.data.headline} limit={220} />
            <Copyable title="ABOUT" text={li.data.about} limit={2600} />
          </div>
          <div className="space-y-4">
            <div>
              <p className={head()}>PIN THESE 5 SKILLS</p>
              <p className="font-mono text-[11px] text-hud-cyan">{li.data.skills.join(' · ')}</p>
            </div>
            <List title="PUT IN FEATURED" items={li.data.featured} />
            <div>
              <p className={head()}>OPEN TO WORK · JOB TITLES</p>
              <p className="font-mono text-[11px] text-phosphor">{li.data.open_to_work.join(' · ')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
