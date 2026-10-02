'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useApi } from '@/lib/use-api';
import type { TailoredView } from '@/lib/overclock';
import type { Portfolio } from '@/types';
import { CopyButton } from '@/components/hud/CopyButton';
import { scoreColor, type MatchedJob, type TailoredSummary } from './types';
import { FormIntercept, useFormIntercept } from './FormIntercept';
import { armInExtension, launchInExtension, onExtension, useExtension } from '@/lib/extension';

const primary =
  'inline-flex items-center justify-center gap-2 bg-phosphor px-5 py-3 font-mono text-xs font-bold tracking-[0.22em] text-black shadow-[0_0_22px_rgba(0,255,65,0.35)] transition-colors hover:bg-[#33FF66] disabled:cursor-not-allowed disabled:bg-phosphor/30';
const secondary =
  'inline-flex items-center justify-center gap-2 border border-phosphor/40 px-5 py-3 font-mono text-xs font-bold tracking-[0.22em] text-phosphor transition-colors hover:bg-phosphor/10';

function Step({ n, title, done, children }: { n: string; title: string; done?: boolean; children: ReactNode }) {
  return (
    <section className="relative border-l border-phosphor/20 pb-7 pl-6 last:pb-0">
      <span
        className={
          'absolute -left-[9px] top-0 flex h-[18px] w-[18px] items-center justify-center border font-mono text-[9px] ' +
          (done ? 'border-phosphor bg-phosphor text-black' : 'border-phosphor/50 bg-void text-phosphor')
        }
      >
        {done ? '✓' : n}
      </span>
      <p className="font-mono text-[11px] tracking-[0.3em] text-phosphor">{title}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-phosphor/10 py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="font-mono text-[10px] tracking-[0.25em] text-dim">{label}</p>
        <p className="mt-0.5 break-words text-sm text-ink">{value}</p>
      </div>
      <CopyButton value={value} />
    </div>
  );
}

/**
 * Assisted apply for one Vault job: the tailored resume, copy-ready answers, the real application page,
 * then a confirmation that records the application (and the resume version) in C2 · OPS.
 * RADAR prepares everything; the final submit on the employer's site stays with the candidate.
 */
export function RunPanel({
  match,
  position,
  total,
  tailored,
  tailoring,
  fullName,
  email,
  onTailor,
  onReview,
  onApplied,
  onSkip,
}: {
  match: MatchedJob;
  position: number;
  total: number;
  tailored: TailoredSummary | undefined;
  tailoring: boolean;
  fullName: string;
  email: string;
  onTailor: (matchId: string) => void;
  onReview: (tailoredId: string) => void;
  onApplied: (matchId: string, resumeVersionId: string | null) => void;
  onSkip: () => void;
}) {
  const api = useApi();
  const [view, setView] = useState<TailoredView | null>(null);
  const [opened, setOpened] = useState(false);
  const [links, setLinks] = useState<Portfolio | null>(null);

  // Your portfolio links and built projects (Preferences → PORTFOLIO), ready to paste into the form.
  useEffect(() => {
    let cancelled = false;
    api('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setLinks(d?.profile?.portfolio ?? null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api]);
  const { job } = match;

  // Full tailored version (contact lines, headline, cover note) for the answers step.
  useEffect(() => {
    if (!tailored) return;
    let cancelled = false;
    api('/api/overclock/' + tailored.id)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setView(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api, tailored]);

  const shown = tailored && view?.id === tailored.id ? view : null;
  const projected = tailored?.projected_score ?? null;
  const form = useFormIntercept(match.id, job.company.name);

  // With the RADAR extension the form opens already filled; it reports back what it filled.
  const extension = useExtension();
  const [launch, setLaunch] = useState<{ tone: 'dim' | 'ok' | 'warn' | 'alert'; text: string } | null>(null);
  useEffect(
    () =>
      onExtension((e) => {
        if (e.matchId !== match.id) return;
        if (e.type === 'launched' && !e.ok)
          setLaunch({ tone: 'alert', text: 'The extension could not open it: ' + e.error });
        if (e.type === 'filled')
          setLaunch({
            tone: e.needs ? 'warn' : 'ok',
            text: `Form filled in the new tab · ${e.filled} fields${e.needs ? ` · ${e.needs} required left for you` : ''}. Review and submit there.`,
          });
      }),
    [match.id],
  );
  // The tab opens at once; the answers (your step-02 edits included) follow as soon as they are ready.
  const launchFilled = async () => {
    const ready = form.data ? await form.buildPacket(form.data) : null;
    launchInExtension({
      url: job.form_url || job.apply_url,
      matchId: match.id,
      tailoredId: form.data?.tailoredId ?? null,
      ...(ready ? { packet: ready } : {}),
    });
    setOpened(true);
    if (ready) return setLaunch({ tone: 'dim', text: 'Opening the form in a new tab…' });
    setLaunch({ tone: 'dim', text: 'Form opening in a new tab · drafting and humanizing its answers…' });
    const prepared = await form.intercept();
    const packet = prepared && (await form.buildPacket(prepared).catch(() => null));
    armInExtension(
      packet
        ? { matchId: match.id, tailoredId: prepared.tailoredId, packet }
        : { matchId: match.id, error: 'RADAR could not read this form or draft its answers. See HACK step 02.' },
    );
    if (!packet) setLaunch({ tone: 'alert', text: 'Could not draft the answers. See step 02.' });
  };
  const LAUNCH_TONE = { dim: 'text-dim', ok: 'text-phosphor', warn: 'text-hud-amber', alert: 'text-hud-red' } as const;

  return (
    <div>
      <div className="mb-7 flex flex-col gap-3 border-b border-phosphor/15 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.3em] text-dim">
            TARGET {position}/{total} · {job.company.name.toUpperCase()}
          </p>
          <h2 className="mt-1 text-xl font-bold leading-snug text-white">{job.title}</h2>
          <p className="mt-1 font-mono text-[11px] text-dim">{job.location}</p>
        </div>
        <p className="font-mono text-3xl font-extrabold" style={{ color: scoreColor(projected ?? match.score) }}>
          {projected ?? match.score}
          <span className="text-base">%</span>
        </p>
      </div>

      <Step n="01" title="RESUME" done={!!tailored}>
        {tailored ? (
          <div className="flex flex-wrap items-center gap-3">
            <a href={`/api/overclock/${tailored.id}/pdf`} className={primary}>
              ⬇ TAILORED PDF
            </a>
            <button type="button" onClick={() => onReview(tailored.id)} className={secondary}>
              REVIEW
            </button>
            {projected !== null && (
              <span className="font-mono text-[11px] text-dim">
                projected {projected}% (was {match.score}%)
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => onTailor(match.id)} disabled={tailoring} className={primary}>
              {tailoring && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              )}
              {tailoring ? 'TAILORING · ~1 MIN' : 'OVERCLOCK THIS JOB ▸'}
            </button>
            <span className="text-sm text-dim">or apply with the resume you already have.</span>
          </div>
        )}
      </Step>

      <Step n="02" title="ANSWERS, READY TO PASTE">
        <FormIntercept form={form} />
        <div className="border border-phosphor/15 bg-black/50 px-4">
          <Field label="FULL NAME" value={shown?.resume.name || fullName} />
          <Field label="EMAIL" value={email} />
          {shown?.resume.contact
            .filter((c) => c !== email)
            .map((c) => (
              <Field key={c} label="CONTACT" value={c} />
            ))}
          <Field label="HEADLINE" value={shown?.resume.headline || ''} />
          <Field label="WHY THIS ROLE" value={shown?.cover_note || ''} />
          <Field label="MATCHING SKILLS" value={match.matching_skills.join(', ')} />
          <Field label="PORTFOLIO" value={links?.portfolio || ''} />
          <Field label="GITHUB" value={links?.github || ''} />
          <Field label="LINKEDIN" value={links?.linkedin || ''} />
          <Field label="WEBSITE" value={links?.website || ''} />
          {links?.projects.map((p) => (
            <Field key={p.url} label={'BUILT · ' + p.name.toUpperCase()} value={p.url} />
          ))}
        </div>
        {!tailored && (
          <p className="mt-2 text-xs text-dim">Overclock the job to add a tailored headline and cover note here.</p>
        )}
      </Step>

      <Step n="03" title="LAUNCH" done={opened}>
        {extension ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void launchFilled()}
                disabled={form.phase === 'running'}
                className={primary}
              >
                ↯ LAUNCH + AUTO-FILL
              </button>
              <button
                type="button"
                onClick={() => {
                  window.open(job.apply_url, '_blank', 'noopener,noreferrer');
                  setOpened(true);
                }}
                className="font-mono text-[10px] tracking-[0.2em] text-dim transition-colors hover:text-phosphor"
              >
                open without filling ↗
              </button>
            </div>
            <p className={'mt-2 font-mono text-[11px] ' + (launch ? LAUNCH_TONE[launch.tone] : 'text-dim')}>
              {launch?.text ||
                `RADAR extension v${extension} connected: the form opens filled with the answers above and your PDF. You review and press Submit; RADAR logs it.`}
            </p>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                window.open(job.apply_url, '_blank', 'noopener,noreferrer');
                setOpened(true);
              }}
              className={primary}
            >
              OPEN APPLICATION ↗
            </button>
            <p className="mt-2 text-xs text-dim">
              Opens the employer’s own form in a new tab. Click RADAR FILL there (or paste), check it, submit. With the
              RADAR extension (repo folder extension/) the form opens already filled.
            </p>
          </>
        )}
      </Step>

      <Step n="04" title="CONFIRM">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onApplied(match.id, tailored?.id ?? null)}
            disabled={!opened}
            className={primary}
          >
            ✓ MARK APPLIED
          </button>
          <button type="button" onClick={onSkip} className={secondary}>
            {position < total ? 'SKIP →' : 'CLOSE'}
          </button>
        </div>
        <p className="mt-2 text-xs text-dim">
          Moves the job to C2 · OPS{tailored ? ' with this tailored resume attached' : ''}. RADAR keeps watch from
          there.
        </p>
      </Step>
    </div>
  );
}
