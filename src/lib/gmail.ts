// ============================
// RADAR — Gmail link: recruiter replies → C2 · OPS
// ============================
// Read-only Google OAuth (gmail.readonly). Every cycle RADAR reads recent application mail, classifies it (offer,
// rejection, assessment, interview, received) and applies it to C2 · OPS:
//   · mail about one of your applications moves its stage (a rejection files it);
//   · mail about an application RADAR never saw (you applied on your own) becomes one, so C2 · OPS stays complete.
// Only the subject, the sender's name and the verdict are stored; bodies are read in memory and dropped.
// Job-alert emails (Indeed, LinkedIn, Welcome to the Jungle) are read as job sources: src/lib/scraper/alert-email.ts.

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from '@/lib/crypto';
import { SITE_URL } from '@/lib/site';
import { htmlToText } from '@/lib/scraper/utils';
import { findsCompanyId } from '@/lib/apply/adopt';
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
    expires_in?: number;
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

// One access token per inbox while it is valid: a cycle reads replies and three alert sources with it.
const accessTokens = new Map<string, { token: string; until: number }>();

/** A working access token for a linked inbox. Throws with `code: 'invalid_grant'` when the link was revoked. */
export async function accessTokenFor(cfg: GmailConfig, userId: string, refreshTokenEnc: string): Promise<string> {
  const cached = accessTokens.get(userId);
  if (cached && cached.until > Date.now()) return cached.token;
  const data = await tokenRequest({
    refresh_token: decryptSecret(refreshTokenEnc, cfg.tokenKey),
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: 'refresh_token',
  });
  const token = data.access_token!;
  accessTokens.set(userId, { token, until: Date.now() + Math.max(60, (data.expires_in ?? 3600) - 300) * 1000 });
  return token;
}

// ---- Gmail API ----

export interface MessagePart {
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string };
  parts?: MessagePart[];
}

export interface GmailMessage {
  id: string;
  internalDate?: string;
  snippet?: string;
  payload?: MessagePart;
}

async function gmailGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(GMAIL + path, {
    headers: { authorization: 'Bearer ' + accessToken },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error('Gmail API ' + res.status + ' on ' + path.split('?')[0]);
  return (await res.json()) as T;
}

export const gmailProfile = (accessToken: string) => gmailGet<{ emailAddress: string }>('/profile', accessToken);

/** Ids of the messages a Gmail search finds, newest first. */
export async function searchMessages(accessToken: string, query: string, max = 50): Promise<string[]> {
  const list = await gmailGet<{ messages?: { id: string }[] }>(
    `/messages?maxResults=${max}&q=` + encodeURIComponent(query),
    accessToken,
  );
  return (list.messages || []).map((m) => m.id);
}

export const getMessage = (accessToken: string, id: string) =>
  gmailGet<GmailMessage>(`/messages/${encodeURIComponent(id)}?format=full`, accessToken);

export const messageHeader = (msg: GmailMessage, name: string) =>
  msg.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value || '';

export const messageDate = (msg: GmailMessage) =>
  msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : new Date().toISOString();

const decodePart = (data?: string) => (data ? Buffer.from(data, 'base64url').toString('utf-8') : '');

/** The HTML and plain-text bodies of a message; either may be empty. Pure. */
export function messageBodies(part: MessagePart | undefined): { html: string; text: string } {
  const out = { html: '', text: '' };
  const walk = (p: MessagePart | undefined) => {
    if (!p) return;
    if (p.mimeType === 'text/html' && !out.html) out.html = decodePart(p.body?.data);
    else if (p.mimeType === 'text/plain' && !out.text) out.text = decodePart(p.body?.data);
    p.parts?.forEach(walk);
  };
  walk(part);
  // A single-part message without a mime type on the part still carries its body.
  if (!out.html && !out.text && part?.body?.data) {
    const body = decodePart(part.body.data);
    if (/<(html|body|div|table|p|a)\b/i.test(body)) out.html = body;
    else out.text = body;
  }
  return out;
}

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
  accessTokens.delete(userId);
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
    /(thank(s| you) for (applying|your application|your interest)|application (has been |was )?(received|submitted|sent)|we (have )?received your application)/i,
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

// Mail sent by an applicant-tracking system, or that speaks of an application, can open one in C2 · OPS. A newsletter
// that says "thank you for your interest", or offers a "free skills assessment", cannot.
const ATS_MAIL =
  /@([a-z0-9-]+\.)*(greenhouse(-mail)?\.io|lever\.co|hire\.lever\.co|ashbyhq\.com|myworkday(jobs)?\.com|workday\.com|smartrecruiters\.com|workablemail\.com|workable\.com|icims\.com|jobvite\.com|teamtailor(-mail)?\.com|recruitee\.com|bamboohr\.com|breezy(mail)?\.(hr|com)|personio\.(de|com)|rippling\.com|dover\.com|gem\.com|successfactors\.(com|eu)|taleo\.net|oraclecloud\.com|linkedin\.com|indeed\.com|indeedemail\.com|wellfound\.com|naukri\.com|instahyre\.com)>?\s*$/i;
const ABOUT_APPLYING = /\b(appl(y|ying|ied|ication)|candidacy)\b/i;

/** Whether mail can open an application: sent by an ATS, or its subject or first lines speak of applying. */
export const isRecruitingMail = (from: string, text: string) => ATS_MAIL.test(from.trim()) || ABOUT_APPLYING.test(text);

const ROLE_WORDS =
  /\b(recruit(ing|ment|er)?|talent( acquisition)?|careers?|hiring( team)?|team|hr|jobs?|people( ops)?|notifications?|no-?reply|do-?not-?reply|via \w+)\b/gi;
const NOT_A_COMPANY =
  /^(greenhouse|lever|workday|ashby|smartrecruiters|workable|icims|jobvite|teamtailor|recruitee|bamboohr|linkedin|indeed|gmail|google|mail|info|support|the|my)?$/i;
const NAME = `([A-Z0-9][\\w&.'’-]*(?: [A-Z0-9&][\\w&.'’-]*){0,4})`;
const COMPANY_IN_SUBJECT = [
  new RegExp(`\\b(?:appl(?:ying|ied|ication(?: was sent)?)|interest)\\s+(?:to|at|with|in)\\s+${NAME}`),
  new RegExp(`\\byour\\s+${NAME}\\s+application\\b`),
  new RegExp(`\\b(?:interview|offer|assessment)\\s+(?:at|with|from)\\s+${NAME}`),
];

/** The employer an application email is from: named in the subject, the sender's name, or the sender's domain. */
export function employerFromMail(from: string, subject: string): string | null {
  for (const re of COMPANY_IN_SUBJECT) {
    const name = re
      .exec(subject)?.[1]
      ?.replace(/[.!,:;]+$/, '')
      .trim();
    if (name && !NOT_A_COMPANY.test(name)) return name.slice(0, 80);
  }
  // The display name only: a bare "careers@scale.com" has none, and its domain is read below.
  const display = (from.includes('<') ? from.slice(0, from.indexOf('<')) : '')
    .replace(/["']/g, '')
    .replace(ROLE_WORDS, ' ')
    .replace(/[@|·,–-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (display && !NOT_A_COMPANY.test(display) && !display.includes('@')) return display.slice(0, 80);
  const domain = /@([a-z0-9.-]+)>?\s*$/i.exec(from)?.[1]?.toLowerCase();
  if (!domain || ATS_MAIL.test('@' + domain)) return null;
  const label = domain.split('.').slice(-2, -1)[0];
  return label && !NOT_A_COMPANY.test(label) ? label[0].toUpperCase() + label.slice(1) : null;
}

const ROLE_PATTERNS = [
  /\b(?:for|to) (?:the|our) (.{3,80}?) (?:position|role|opening|job|vacancy)\b/i,
  /\bapplication for (?:the )?(.{3,80}?)(?: (?:position|role|opening)\b| at\b|[.,!]|$)/im,
  /\bapplying (?:for|to) (?:the )?(.{3,80}?)(?: (?:position|role)\b| at\b|[.,!]|$)/im,
  /\b(?:position|role) of (.{3,80}?)(?: at\b|[.,!]|$)/im,
];

/** The role an application email names, or null. */
export function roleFromMail(subject: string, body: string): string | null {
  for (const re of ROLE_PATTERNS) {
    const role = re.exec(subject)?.[1] || re.exec(body.slice(0, 3000))?.[1];
    if (role && !/\b(you|your|our|this|that)\b/i.test(role)) return role.replace(/["“”]/g, '').trim();
  }
  return null;
}

export interface Application {
  id: string;
  stage: Stage | null;
  title: string;
  company: string;
  applied_at: string | null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sameRole = (a: string, b: string) => {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x.includes(y) || y.includes(x);
};

/**
 * The application an email is about: the company must appear as a whole word in the sender, subject or snippet.
 * With several roles at one company, the role the email names wins, else the latest application. An email that
 * names a role none of them has is about another application (null), so it is not filed under the wrong one.
 */
export function matchApplication(text: string, apps: Application[], role: string | null = null): Application | null {
  const hay = text.toLowerCase();
  const hits = apps.filter((a) => {
    const name = a.company.trim().toLowerCase();
    return name.length >= 2 && new RegExp('(^|[^a-z0-9])' + escapeRe(name) + '($|[^a-z0-9])').test(hay);
  });
  if (!hits.length) return null;
  const byTitle = hits.find((a) => hay.includes(a.title.toLowerCase()) || (role && sameRole(a.title, role)));
  if (byTitle) return byTitle;
  if (role && hits.every((a) => a.title !== 'Application')) return null;
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
  '-from:me -in:sent (subject:application OR subject:applying OR subject:applied OR subject:interview OR subject:candidacy OR subject:offer OR assessment OR "thank you for applying" OR "application was sent" OR unfortunately OR "next steps" OR "other candidates" OR "regret to inform" OR "not to move forward" OR "not be moving forward")';

export interface GmailSyncResult {
  scanned: number;
  matched: number;
  updated: number;
  /** Applications RADAR had not seen (you applied elsewhere), opened in C2 · OPS from your mail. */
  created: number;
  error?: string;
}

const EMPTY: Omit<GmailSyncResult, 'error'> = { scanned: 0, matched: 0, updated: 0, created: 0 };

async function loadApplications(supabase: SupabaseClient, userId: string): Promise<Application[]> {
  const { data, error } = await supabase
    .from('match_scores')
    .select('id, stage, applied_at, jobs!inner(title, employer, companies!inner(name))')
    .eq('user_id', userId)
    .eq('status', 'applied');
  if (error) throw new Error('Reading applications failed: ' + error.message);
  return (data || []).map((r) => {
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
}

/** An application RADAR never saw, opened from your mail: a job of yours plus an applied match for it. */
async function openApplication(
  supabase: SupabaseClient,
  userId: string,
  mail: { company: string; role: string | null; at: string; stage: Stage },
): Promise<Application> {
  const title = mail.role || 'Application';
  const externalId =
    'mail:' +
    createHash('sha256')
      .update(userId + '|' + mail.company.toLowerCase() + '|' + title.toLowerCase())
      .digest('hex')
      .slice(0, 24);
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .upsert(
      {
        company_id: await findsCompanyId(supabase),
        external_id: externalId,
        title,
        employer: mail.company,
        apply_url: 'https://mail.google.com/',
        is_active: false,
        scraped_at: mail.at,
      },
      { onConflict: 'company_id,external_id' },
    )
    .select('id')
    .single();
  if (jobError) throw new Error('Saving the application failed: ' + jobError.message);
  const { data: match, error } = await supabase
    .from('match_scores')
    .upsert(
      {
        user_id: userId,
        job_id: job.id,
        score: 0,
        section: 'recommended',
        status: 'applied',
        stage: mail.stage,
        applied_at: mail.at,
        stage_changed_at: mail.at,
        status_changed_at: mail.at,
      },
      { onConflict: 'user_id,job_id' },
    )
    .select('id')
    .single();
  if (error) throw new Error('Saving the application failed: ' + error.message);
  return { id: match.id, stage: mail.stage, title, company: mail.company, applied_at: mail.at };
}

/** Read new application mail for one user and apply what it says to C2 · OPS. */
export async function syncGmail(supabase: SupabaseClient, userId: string): Promise<GmailSyncResult> {
  const cfg = gmailConfig();
  if (!cfg) return { ...EMPTY, error: 'Gmail is not configured on the server.' };
  const { data: link } = await supabase
    .from('gmail_links')
    .select('refresh_token_enc, last_synced_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (!link) return { ...EMPTY, error: 'Gmail is not connected.' };

  const finish = async (result: GmailSyncResult) => {
    await supabase
      .from('gmail_links')
      .update({ last_synced_at: new Date().toISOString(), last_error: result.error || null })
      .eq('user_id', userId);
    return result;
  };

  let accessToken: string;
  try {
    accessToken = await accessTokenFor(cfg, userId, link.refresh_token_enc);
  } catch (err) {
    const expired = (err as { code?: string }).code === 'invalid_grant';
    return finish({
      ...EMPTY,
      error: expired ? 'Gmail access expired. Reconnect Gmail.' : 'Could not refresh Gmail access.',
    });
  }

  // A Gmail or database failure mid-sync is recorded on the link, so Settings can show it.
  try {
    const apps = await loadApplications(supabase, userId);
    const days = link.last_synced_at
      ? Math.min(30, Math.max(1, Math.ceil((Date.now() - Date.parse(link.last_synced_at)) / 86_400_000) + 1))
      : 30;
    const ids = await searchMessages(accessToken, `newer_than:${days}d ${QUERY}`, 50);
    if (!ids.length) return finish({ ...EMPTY });

    const { data: seen } = await supabase
      .from('ops_events')
      .select('external_id')
      .eq('user_id', userId)
      .in('external_id', ids);
    const done = new Set((seen || []).map((e) => e.external_id));

    const result = { ...EMPTY, scanned: ids.length };
    // Oldest first, so "received" opens an application before its later rejection moves it.
    for (const id of ids.filter((x) => !done.has(x)).reverse()) {
      const msg = await getMessage(accessToken, id);
      const subject = messageHeader(msg, 'subject');
      const from = messageHeader(msg, 'from');
      const { html, text } = messageBodies(msg.payload);
      const body = (text || htmlToText(html)).slice(0, 6000);
      const kind = classifyEmail(subject, msg.snippet || '', body);
      if (!kind) continue;
      const at = messageDate(msg);
      const role = roleFromMail(subject, body);
      let app = matchApplication([from, subject, msg.snippet].join('\n'), apps, role);
      if (!app) {
        const company = isRecruitingMail(from, subject + '\n' + (msg.snippet || ''))
          ? employerFromMail(from, subject)
          : null;
        if (!company) continue;
        app = await openApplication(supabase, userId, {
          company,
          role,
          at,
          stage: kind === 'received' ? 'applied' : (nextStage(kind, 'applied') ?? 'applied'),
        });
        apps.push(app);
        result.created += 1;
      } else {
        result.matched += 1;
        const stage = nextStage(kind, app.stage);
        if (stage) {
          const { error } = await supabase
            .from('match_scores')
            .update({ stage, stage_changed_at: at })
            .eq('user_id', userId)
            .eq('id', app.id);
          if (!error) {
            app.stage = stage;
            result.updated += 1;
          }
        }
      }

      const sender = from.replace(/<.*>/, '').replace(/"/g, '').trim() || 'recruiter';
      await supabase.from('ops_events').upsert(
        {
          user_id: userId,
          match_id: app.id,
          source: 'gmail',
          kind,
          summary: `${kind.toUpperCase()} · "${subject.slice(0, 140)}" from ${sender.slice(0, 60)}`,
          external_id: id,
          occurred_at: at,
        },
        { onConflict: 'user_id,external_id', ignoreDuplicates: true },
      );
    }
    return finish(result);
  } catch (err) {
    console.error('[GMAIL]', userId, err instanceof Error ? err.message : err);
    return finish({ ...EMPTY, error: 'Reading Gmail failed. RADAR will retry on the next cycle.' });
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
