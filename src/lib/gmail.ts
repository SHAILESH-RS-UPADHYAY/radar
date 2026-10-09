// ============================
// RADAR — Gmail link: read recruiter replies, update C2 · OPS
// ============================
// Read-only Google OAuth (gmail.readonly). Each sync reads recent application-related mail, classifies it
// (rejection, interview, assessment, offer, received), ties it to one of the user's applications by company,
// records an ops_event and moves the stage forward. Only subject, sender name and the verdict are stored;
// the body is read in memory to find the verdict and dropped.

import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from '@/lib/crypto';
import { SITE_URL } from '@/lib/site';
import type { Stage } from '@/types';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'openid', 'email'];
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
/** Holds the OAuth state between /api/gmail/connect and /api/gmail/callback. */
export const GMAIL_STATE_COOKIE = 'radar_gmail_state';

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  tokenKey: string;
  redirectUri: string;
}

/** Null until GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GMAIL_TOKEN_KEY are all set. */
export function gmailConfig(): GmailConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const tokenKey = process.env.GMAIL_TOKEN_KEY?.trim();
  if (!clientId || !clientSecret || !tokenKey) return null;
  return { clientId, clientSecret, tokenKey, redirectUri: SITE_URL + '/api/gmail/callback' };
}

export function authUrl(cfg: GmailConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + params;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw Object.assign(new Error(data.error_description || data.error || 'Google token request failed'), {
      code: data.error,
    });
  }
  return data;
}

export const exchangeCode = (cfg: GmailConfig, code: string) =>
  tokenRequest({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: 'authorization_code',
  });

const refreshAccess = (cfg: GmailConfig, refreshToken: string) =>
  tokenRequest({
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: 'refresh_token',
  });

async function gmailGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(GMAIL + path, {
    headers: { authorization: 'Bearer ' + accessToken },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error('Gmail API ' + res.status + ' on ' + path.split('?')[0]);
  return (await res.json()) as T;
}

export const gmailProfile = (accessToken: string) => gmailGet<{ emailAddress: string }>('/profile', accessToken);

export const sealToken = (cfg: GmailConfig, refreshToken: string) => encryptSecret(refreshToken, cfg.tokenKey);

export async function revokeToken(token: string) {
  await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(token), {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {});
}

/** Revoke RADAR's access at Google (best effort), then forget the link. */
export async function disconnectGmail(supabase: SupabaseClient, userId: string) {
  const cfg = gmailConfig();
  const { data } = await supabase.from('gmail_links').select('refresh_token_enc').eq('user_id', userId).maybeSingle();
  if (data && cfg) {
    try {
      await revokeToken(decryptSecret(data.refresh_token_enc, cfg.tokenKey));
    } catch {
      // A token sealed with an old key cannot be revoked from here; deleting the row still unlinks it.
    }
  }
  const { error } = await supabase.from('gmail_links').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
}

// ---- Classification (pure) ----

export type MailKind = 'offer' | 'rejection' | 'interview' | 'assessment' | 'received';

// Checked in order: a rejection often mentions "interview", and an offer beats everything.
const RULES: [MailKind, RegExp][] = [
  ['offer', /\b(offer letter|pleased to offer|extend(ing)? (you )?an offer|job offer)\b/i],
  [
    'rejection',
    // A negation is required, so "excited to move forward with your application" is not read as a rejection.
    /(regret to inform|(will not|won['’]t|not) (be )?(to )?(moving|move|proceeding|proceed) (forward|ahead|with your (application|candidacy))|decided (not )?to (pursue|proceed with|move forward with) other|other candidates|no longer (under consideration|considering)|not (been )?selected|position has (been )?(filled|closed)|will not be progressing)/i,
  ],
  [
    'assessment',
    /\b(assessment|coding (challenge|test|exercise)|take[- ]home|hackerrank|codility|codesignal|online test|technical (test|assignment))\b/i,
  ],
  [
    'interview',
    /\b(interview|phone screen|schedule (a )?(call|chat|time|meeting)|your availability|next (round|step)s?|speak with you|meet with you)\b/i,
  ],
  [
    'received',
    /(thank(s| you) for (applying|your application|your interest)|application (has been )?(received|submitted)|we (have )?received your application)/i,
  ],
];

/**
 * What a recruiter email says. The verdict usually sits in the subject or first lines (the snippet), but a rejection
 * often comes after a paragraph of thanks, so rejection phrases are also looked for in the body. A bare
 * "unfortunately" counts only up top: confirmations say "unfortunately we can't reply to everyone" further down.
 */
export function classifyEmail(subject: string, snippet: string, body = ''): MailKind | null {
  const head = subject + '\n' + snippet;
  if (RULES[0][1].test(head)) return 'offer';
  if (RULES[1][1].test(head + '\n' + body) || /\bunfortunately\b/i.test(head)) return 'rejection';
  return RULES.slice(2).find(([, re]) => re.test(head))?.[0] ?? null;
}

export interface Application {
  id: string;
  stage: Stage | null;
  title: string;
  company: string;
  applied_at: string | null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The application an email is about: the company must appear as a whole word in the sender, subject or
 * snippet. With several roles at one company, a mentioned title wins, else the latest application.
 */
export function matchApplication(text: string, apps: Application[]): Application | null {
  const hay = text.toLowerCase();
  const hits = apps.filter((a) => {
    const name = a.company.trim().toLowerCase();
    return name.length >= 2 && new RegExp('(^|[^a-z0-9])' + escapeRe(name) + '($|[^a-z0-9])').test(hay);
  });
  if (!hits.length) return null;
  const byTitle = hits.find((a) => hay.includes(a.title.toLowerCase()));
  if (byTitle) return byTitle;
  return [...hits].sort((a, b) => (b.applied_at || '').localeCompare(a.applied_at || ''))[0];
}

const ORDER: Stage[] = ['applied', 'screening', 'interview', 'offer'];

/** The stage an email implies, or null when it would not move the application forward. */
export function nextStage(kind: MailKind, current: Stage | null): Stage | null {
  const now = current || 'applied';
  if (now === 'rejected' || now === 'withdrawn' || now === 'offer') return null;
  if (kind === 'rejection') return 'rejected';
  const target: Stage | null =
    kind === 'offer' ? 'offer' : kind === 'interview' ? 'interview' : kind === 'assessment' ? 'screening' : null;
  if (!target) return null;
  return ORDER.indexOf(target) > ORDER.indexOf(now) ? target : null;
}

// ---- Sync ----

const QUERY =
  '-from:me -in:sent (subject:application OR subject:applying OR subject:interview OR subject:candidacy OR subject:offer OR assessment OR "thank you for applying" OR unfortunately OR "next steps" OR "other candidates" OR "regret to inform" OR "not to move forward" OR "not be moving forward")';

interface GmailMessage {
  id: string;
  internalDate?: string;
  snippet?: string;
  payload?: { headers?: { name: string; value: string }[] };
}

export interface GmailSyncResult {
  scanned: number;
  matched: number;
  updated: number;
  indeedJobs?: number;
  error?: string;
}

/** Read new application mail for one user and apply what it says to C2 · OPS, and ingest Indeed alert jobs. */
export async function syncGmail(supabase: SupabaseClient, userId: string): Promise<GmailSyncResult> {
  const cfg = gmailConfig();
  if (!cfg) return { scanned: 0, matched: 0, updated: 0, error: 'Gmail is not configured on the server.' };
  const { data: link } = await supabase
    .from('gmail_links')
    .select('refresh_token_enc, last_synced_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (!link) return { scanned: 0, matched: 0, updated: 0, error: 'Gmail is not connected.' };

  const finish = async (result: GmailSyncResult) => {
    await supabase
      .from('gmail_links')
      .update({ last_synced_at: new Date().toISOString(), last_error: result.error || null })
      .eq('user_id', userId);
    return result;
  };

  let accessToken: string;
  try {
    accessToken = (await refreshAccess(cfg, decryptSecret(link.refresh_token_enc, cfg.tokenKey))).access_token!;
  } catch (err) {
    const expired = (err as { code?: string }).code === 'invalid_grant';
    return finish({
      scanned: 0,
      matched: 0,
      updated: 0,
      error: expired ? 'Gmail access expired. Reconnect Gmail.' : 'Could not refresh Gmail access.',
    });
  }

  // A Gmail or database failure mid-sync is recorded on the link, so Settings can show it.
  try {
    // 1. Ingest any fresh Indeed Job Alert digest emails into RADAR jobs pipeline
    let indeedJobs = 0;
    try {
      const { syncIndeedAlertsForUser } = await import('@/lib/scraper/indeed-email');
      indeedJobs = await syncIndeedAlertsForUser(supabase, userId, accessToken);
    } catch (e) {
      console.warn('[GMAIL] Indeed alerts sync error:', e instanceof Error ? e.message : e);
    }

    const { data: rows } = await supabase
      .from('match_scores')
      .select('id, stage, applied_at, jobs!inner(title, employer, companies!inner(name))')
      .eq('user_id', userId)
      .eq('status', 'applied');
    const apps: Application[] = (rows || []).map((r) => {
      const job = (Array.isArray(r.jobs) ? r.jobs[0] : r.jobs) as {
        title: string;
        employer: string | null;
        companies: { name: string } | { name: string }[];
      };
      const company = Array.isArray(job.companies) ? job.companies[0] : job.companies;
      return {
        id: r.id,
        stage: r.stage,
        title: job.title,
        company: job.employer || company.name,
        applied_at: r.applied_at,
      };
    });
    if (!apps.length) return finish({ scanned: 0, matched: 0, updated: 0, indeedJobs });

    const days = link.last_synced_at
      ? Math.min(30, Math.max(1, Math.ceil((Date.now() - Date.parse(link.last_synced_at)) / 86_400_000) + 1))
      : 30;
    const list = await gmailGet<{ messages?: { id: string }[] }>(
      '/messages?maxResults=50&q=' + encodeURIComponent(`newer_than:${days}d ${QUERY}`),
      accessToken,
    );
    const ids = (list.messages || []).map((m) => m.id);
    if (!ids.length) return finish({ scanned: 0, matched: 0, updated: 0 });

    const { data: seen } = await supabase
      .from('ops_events')
      .select('external_id')
      .eq('user_id', userId)
      .in('external_id', ids);
    const done = new Set((seen || []).map((e) => e.external_id));

    const { extractBodyFromPayload } = await import('@/lib/scraper/indeed-email');
    const { htmlToText } = await import('@/lib/scraper/utils');
    let matched = 0;
    let updated = 0;
    for (const id of ids.filter((x) => !done.has(x))) {
      const msg = await gmailGet<GmailMessage>(`/messages/${id}?format=full`, accessToken);
      const header = (name: string) => msg.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value || '';
      const subject = header('subject');
      const from = header('from');
      // The body is read here only to classify; it is never stored.
      const body = htmlToText(extractBodyFromPayload(msg.payload as never)).slice(0, 6000);
      const kind = classifyEmail(subject, msg.snippet || '', body);
      const app = kind ? matchApplication([from, subject, msg.snippet].join('\n'), apps) : null;
      if (!kind || !app) continue;
      matched += 1;

      const sender = from.replace(/<.*>/, '').replace(/"/g, '').trim() || 'recruiter';
      const occurred = msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : new Date().toISOString();
      await supabase.from('ops_events').upsert(
        {
          user_id: userId,
          match_id: app.id,
          source: 'gmail',
          kind,
          summary: `${kind.toUpperCase()} · "${subject.slice(0, 140)}" from ${sender.slice(0, 60)}`,
          external_id: id,
          occurred_at: occurred,
        },
        { onConflict: 'user_id,external_id', ignoreDuplicates: true },
      );

      const stage = nextStage(kind, app.stage);
      if (stage) {
        const { error } = await supabase
          .from('match_scores')
          .update({ stage, stage_changed_at: occurred })
          .eq('user_id', userId)
          .eq('id', app.id);
        if (!error) {
          app.stage = stage;
          updated += 1;
        }
      }
    }
    return finish({ scanned: ids.length, matched, updated, indeedJobs });
  } catch (err) {
    console.error('[GMAIL]', userId, err instanceof Error ? err.message : err);
    return finish({
      scanned: 0,
      matched: 0,
      updated: 0,
      error: 'Reading Gmail failed. RADAR will retry on the next cycle.',
    });
  }
}

/** Sync every linked user, oldest sync first, until the time budget runs out. */
export async function syncAllGmail(supabase: SupabaseClient, deadline: number) {
  if (!gmailConfig()) return [];
  const { data: links, error } = await supabase
    .from('gmail_links')
    .select('user_id')
    .order('last_synced_at', { ascending: true, nullsFirst: true });
  if (error) return [];
  const results: (GmailSyncResult & { userId: string })[] = [];
  for (const { user_id } of links || []) {
    if (Date.now() > deadline - 10_000) break;
    try {
      results.push({ userId: user_id, ...(await syncGmail(supabase, user_id)) });
    } catch (err) {
      console.error('[GMAIL]', user_id, err instanceof Error ? err.message : err);
    }
  }
  return results;
}
