'use client';

import { useCallback, useEffect, useState } from 'react';
import { HudPanel, type Tone } from '@/components/hud/Hud';
import type { Notice } from '@/components/hud/Toast';
import { timeAgo } from '@/components/dashboard/types';
import { useApi } from '@/lib/use-api';

interface GmailStatus {
  configured: boolean;
  ready: boolean;
  link: { email: string; connected_at: string; last_synced_at: string | null; last_error: string | null } | null;
}

// Where /api/gmail/callback sends the browser back to: /settings?gmail=<outcome>#gmail
const OUTCOMES: Record<string, Notice> = {
  connected: { tone: 'ok', text: 'Gmail linked. RADAR reads recruiter replies daily and updates C2 · OPS.' },
  denied: { tone: 'info', text: 'Gmail link cancelled. Nothing was stored.' },
  'state-mismatch': { tone: 'alert', text: 'That Gmail link expired or was opened in another browser. Connect again.' },
  'no-refresh-token': {
    tone: 'alert',
    text: 'Google did not grant offline access. Remove RADAR at myaccount.google.com/permissions, then connect again.',
  },
  'needs-migration': { tone: 'alert', text: 'Run migration 006 in Supabase, then connect Gmail again.' },
  'not-configured': { tone: 'alert', text: 'Gmail is not configured on the server yet (Google OAuth keys missing).' },
  failed: { tone: 'alert', text: 'Linking Gmail failed. Try again.' },
};

const button =
  'border px-4 py-2.5 font-mono text-[11px] font-bold tracking-[0.2em] transition-colors disabled:cursor-wait disabled:opacity-50';

export function GmailLink({ onNotice }: { onNotice: (n: Notice) => void }) {
  const api = useApi();
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [busy, setBusy] = useState<'sync' | 'disconnect' | null>(null);

  const load = useCallback(async () => {
    const r = await api('/api/gmail');
    if (r.ok) setStatus(await r.json());
  }, [api]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load from the API
    void load();
    const outcome = new URLSearchParams(window.location.search).get('gmail');
    if (outcome && OUTCOMES[outcome]) {
      onNotice(OUTCOMES[outcome]);
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    }
  }, [load, onNotice]);

  const run = async (kind: 'sync' | 'disconnect') => {
    setBusy(kind);
    try {
      const r = await api('/api/gmail', { method: kind === 'sync' ? 'POST' : 'DELETE' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
      const indeedMsg = d.indeedJobs ? ` · ${d.indeedJobs} Indeed jobs ingested.` : '.';
      onNotice(
        kind === 'sync'
          ? {
              tone: 'ok',
              text: `Read ${d.scanned} new messages · ${d.matched} about applications · ${d.updated} moved${indeedMsg}`,
            }
          : { tone: 'info', text: 'Gmail disconnected and access revoked at Google.' },
      );
    } catch (err) {
      onNotice({ tone: 'alert', text: (kind === 'sync' ? 'Sync: ' : 'Disconnect: ') + (err as Error).message });
    } finally {
      setBusy(null);
      await load();
    }
  };

  const link = status?.link;
  const [label, tone]: [string, Tone] = !status
    ? ['CHECKING', 'idle']
    : !status.configured
      ? ['NOT CONFIGURED', 'warn']
      : !status.ready
        ? ['NEEDS MIGRATION', 'warn']
        : link
          ? link.last_error
            ? ['ATTENTION', 'alert']
            : ['LINKED', 'ok']
          : ['OFF', 'idle'];

  return (
    <HudPanel id="gmail" label="CONFIG://11 · GMAIL_LINK" status={label} tone={tone} className="scroll-mt-24">
      <p className="-mt-1 mb-5 text-sm leading-relaxed text-dim">
        Read-only. Once a day RADAR reads the subject and preview of recruiter replies, then moves your applications in
        C2 · OPS: rejection, assessment, interview or offer. It never sends, deletes or stores email bodies.
      </p>

      {status && !status.configured && (
        <p className="font-mono text-xs leading-relaxed text-hud-amber">
          Server keys missing: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GMAIL_TOKEN_KEY. See .env.example.
        </p>
      )}
      {status?.configured && !status.ready && (
        <p className="font-mono text-xs leading-relaxed text-hud-amber">
          Run supabase/migrations/006_resume_versions_gmail.sql in the Supabase SQL editor first.
        </p>
      )}

      {status?.configured && status.ready && !link && (
        <a
          href="/api/gmail/connect"
          className={button + ' inline-block border-phosphor bg-phosphor text-black hover:bg-[#33FF66]'}
        >
          [ CONNECT GMAIL ]
        </a>
      )}

      {link && (
        <div className="space-y-4">
          <dl className="grid gap-x-6 gap-y-2 font-mono text-xs sm:grid-cols-[auto_1fr]">
            <dt className="tracking-[0.2em] text-dim">INBOX</dt>
            <dd className="break-all text-phosphor">{link.email}</dd>
            <dt className="tracking-[0.2em] text-dim">LAST SYNC</dt>
            <dd className="text-ink/80">{timeAgo(link.last_synced_at) || 'not yet'} · runs daily</dd>
          </dl>
          {link.last_error && <p className="font-mono text-xs text-hud-red">! {link.last_error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('sync')}
              className={button + ' border-phosphor/50 text-phosphor hover:bg-phosphor/10'}
            >
              {busy === 'sync' ? 'READING INBOX…' : 'SYNC NOW'}
            </button>
            {link.last_error && (
              <a
                href="/api/gmail/connect"
                className={button + ' border-hud-amber/60 text-hud-amber hover:bg-hud-amber/10'}
              >
                RECONNECT
              </a>
            )}
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('disconnect')}
              className={button + ' border-phosphor/15 text-dim hover:border-hud-red/60 hover:text-hud-red'}
            >
              {busy === 'disconnect' ? 'REVOKING…' : 'DISCONNECT'}
            </button>
          </div>
        </div>
      )}
    </HudPanel>
  );
}
