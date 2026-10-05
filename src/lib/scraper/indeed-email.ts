/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================
// RADAR — Indeed Job Alert Email Ingestion (Gmail)
// ============================
// Reads Indeed job alert digest emails from connected Gmail accounts (via official Gmail API),
// parses structured job cards from both HTML and plain-text email bodies, cleans tracking URLs
// to canonical job links, and injects jobs into RADAR's embedding & match pipeline.

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret } from '@/lib/crypto';
import { gmailConfig } from '@/lib/gmail';
import {
  decodeEntities,
  finalizeJob,
  htmlToText,
  isRelevantTitle,
  parseSalaryRange,
  toIso,
  type ScrapedJob,
} from './utils';
import { upsertJobVectors } from '@/lib/ai/embeddings';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const INDEED_BOARD_COMPANY = 'Indeed Email Alerts';

/** Clean an Indeed application link and extract the canonical job key (jk), if present. */
export function cleanIndeedUrl(rawUrl: string): { url: string; jk: string | null } {
  try {
    const u = new URL(rawUrl);
    const jk = u.searchParams.get('jk') || u.searchParams.get('jobkey');
    if (jk && /^[a-f0-9]{16}$/i.test(jk)) {
      return {
        url: `https://in.indeed.com/viewjob?jk=${jk}`,
        jk: jk.toLowerCase(),
      };
    }
    // Clean tracking tokens while keeping destination
    u.searchParams.delete('from');
    u.searchParams.delete('utm_source');
    u.searchParams.delete('utm_medium');
    u.searchParams.delete('utm_campaign');
    u.searchParams.delete('tk');
    u.searchParams.delete('iaf');
    return { url: u.toString(), jk: null };
  } catch {
    return { url: rawUrl, jk: null };
  }
}

/** Extract text safely from HTML fragment without tags or extra spaces. */
function cleanText(fragment: string): string {
  return htmlToText(fragment).replace(/\s+/g, ' ').trim();
}

/** Parses Indeed Job Alert HTML email into structured ScrapedJob records. */
export function extractJobsFromHtml(html: string, emailDate?: string): ScrapedJob[] {
  const jobs: ScrapedJob[] = [];
  const seenUrls = new Set<string>();

  // Indeed alert emails render job listings inside cards with links to /rc/clk, /viewjob or containing jk=
  const anchorRegex =
    /<a\s+[^>]*href=["']([^"']*(?:indeed\.[a-z.]+\/(?:rc\/clk|viewjob|job|pagead\/clk)|\/rc\/clk|jk=[a-f0-9]{16})[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const rawUrl = decodeEntities(match[1]);
    const linkInner = match[2];
    const { url, jk } = cleanIndeedUrl(rawUrl);

    // Skip unclickable, general Indeed links or duplicates in the same digest
    if (seenUrls.has(url) || /indeed\.com\/?(?:\?|$)/i.test(url) || url.includes('/jobalerts/')) continue;
    seenUrls.add(url);

    // 1. Title: Usually in the link text or enclosing heading
    let title = cleanText(linkInner);
    // If the anchor just says "Apply now" or "View job", look backward for the title heading
    if (/^(apply\s*now|view\s*job|see\s*more|apply)$/i.test(title) || title.length < 3) {
      const preceding = html.slice(Math.max(0, match.index - 500), match.index);
      const hMatch = preceding.match(/<(?:h[2-4]|strong|b)[^>]*>([\s\S]*?)<\/(?:h[2-4]|strong|b)>\s*$/i);
      if (hMatch) title = cleanText(hMatch[1]);
    }

    if (!title || title.length < 3 || !isRelevantTitle(title)) continue;

    // 2. Surrounding context: 1,000 characters immediately after the anchor usually holds company, location and snippet
    const afterHtml = html.slice(match.index + match[0].length, match.index + match[0].length + 1200);

    // Company: Look for company class or adjacent bold/span text
    let employer = 'Company';
    const compMatch =
      afterHtml.match(
        /<(?:span|div|p)[^>]*class=["'][^"']*(?:company|companyName|employer)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div|p)>/i,
      ) || afterHtml.match(/<(?:span|div|strong)[^>]*>([A-Za-z0-9\s&.,'-]{2,50})<\/(?:span|div|strong)>/i);
    if (compMatch) {
      const cand = cleanText(compMatch[1]);
      if (cand && !/^(new|apply|urgent|sponsored|active|posted|\d+)/i.test(cand)) {
        employer = cand;
      }
    }

    // Location: Look for location class or common Indian city mentions
    let location = 'India';
    const locMatch =
      afterHtml.match(
        /<(?:span|div|p)[^>]*class=["'][^"']*(?:location|city|job-location)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div|p)>/i,
      ) ||
      afterHtml.match(
        /\b(Mohali|Chandigarh|Gurugram|Gurgaon|Noida|Delhi|Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Remote)\b/i,
      );
    if (locMatch) {
      location = cleanText(locMatch[1] || locMatch[0]);
    }

    // Snippet & Salary
    const snippetText = cleanText(afterHtml.slice(0, 400));
    const salaryMatch = snippetText.match(
      /(?:₹|rs\.?|inr|\$|£|€)\s*[\d,]+(?:\s*-\s*(?:₹|rs\.?|inr|\$|£|€)?\s*[\d,]+)?(?:\s*(?:a|per)\s*(?:year|month|annum|hr|hour))?/i,
    );
    const pay = parseSalaryRange(salaryMatch ? salaryMatch[0] : null);
    const externalId = jk ? `indeed:${jk}` : `indeed:${createHash('sha1').update(url).digest('hex').slice(0, 16)}`;

    jobs.push(
      finalizeJob({
        external_id: externalId,
        title,
        description: snippetText
          ? `${snippetText}\n\nSource: Indeed Job Alert Digest`
          : 'Source: Indeed Job Alert Digest',
        location,
        apply_url: url,
        department: null,
        salary_min: pay.min,
        salary_max: pay.max,
        salary_currency: pay.currency,
        posted_at: toIso(emailDate),
        employer: employer || 'Employer',
      }),
    );
  }

  return jobs;
}

/** Parses plain-text Indeed Job Alert email fallbacks. */
export function extractJobsFromText(text: string, emailDate?: string): ScrapedJob[] {
  const jobs: ScrapedJob[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/https?:\/\/[^\s]*indeed\.[^\s]*(?:rc\/clk|viewjob|jk=[a-f0-9]{16})/i.test(line)) {
      const { url, jk } = cleanIndeedUrl(line);
      // In Indeed plaintext digests, the title and employer typically appear 1–3 lines prior to the link
      const titleCandidate = lines[i - 2] || lines[i - 1] || '';
      const compCandidate = lines[i - 1] || '';

      if (titleCandidate && isRelevantTitle(titleCandidate)) {
        let employer = 'Company';
        let location = 'India';

        if (compCandidate.includes(' - ')) {
          const [e, loc] = compCandidate.split(' - ');
          employer = e?.trim() || employer;
          location = loc?.trim() || location;
        } else if (compCandidate && compCandidate !== titleCandidate) {
          employer = compCandidate;
        }

        const externalId = jk ? `indeed:${jk}` : `indeed:${createHash('sha1').update(url).digest('hex').slice(0, 16)}`;
        jobs.push(
          finalizeJob({
            external_id: externalId,
            title: titleCandidate,
            description: `Source: Indeed Job Alert Digest (${employer} - ${location})`,
            location,
            apply_url: url,
            department: null,
            salary_min: null,
            salary_max: null,
            salary_currency: null,
            posted_at: toIso(emailDate),
            employer,
          }),
        );
      }
    }
  }

  return jobs;
}

/** Master parser: handles HTML or plain text from an Indeed email. */
export function parseIndeedEmailContent(content: string, emailDate?: string): ScrapedJob[] {
  if (!content) return [];
  if (/<(?:html|body|div|table|a)\b/i.test(content)) {
    const fromHtml = extractJobsFromHtml(content, emailDate);
    if (fromHtml.length > 0) return fromHtml;
  }
  return extractJobsFromText(content, emailDate);
}

// ---------- Gmail API Message Body Fetching ----------

interface MessagePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: MessagePart[];
}

function extractBodyFromPayload(payload?: MessagePart): string {
  if (!payload) return '';
  if (payload.body?.data) {
    try {
      return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
    } catch {
      return '';
    }
  }
  if (payload.parts?.length) {
    // Prefer HTML body for rich job card structure
    const htmlPart = payload.parts.find((p) => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) {
      try {
        return Buffer.from(htmlPart.body.data, 'base64url').toString('utf-8');
      } catch {}
    }
    const textPart = payload.parts.find((p) => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      try {
        return Buffer.from(textPart.body.data, 'base64url').toString('utf-8');
      } catch {}
    }
    for (const part of payload.parts) {
      const nested = extractBodyFromPayload(part);
      if (nested) return nested;
    }
  }
  return '';
}

/** Scrapes Indeed alert emails for all connected users during standard scrape cycles. */
export async function scrapeIndeedEmail(): Promise<ScrapedJob[]> {
  const cfg = gmailConfig();
  if (!cfg) return [];

  // Dynamically import createServerClient to avoid circular dependency
  const { createServerClient } = await import('@/lib/supabase/client');
  const supabase = createServerClient();

  const { data: links } = await supabase
    .from('gmail_links')
    .select('user_id, refresh_token_enc')
    .order('last_synced_at', { ascending: true });

  if (!links || links.length === 0) return [];

  const allJobs: ScrapedJob[] = [];
  const seenIds = new Set<string>();

  for (const link of links) {
    try {
      const refreshToken = decryptSecret(link.refresh_token_enc, cfg.tokenKey);
      const tokenRes = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          grant_type: 'refresh_token',
        }),
      });
      const tokenData = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
      if (!tokenData.access_token) continue;

      const listRes = await fetch(
        `${GMAIL}/messages?maxResults=10&q=` +
          encodeURIComponent('from:indeed.com newer_than:7d (subject:"job" OR subject:"alert" OR subject:"jobs")'),
        { headers: { authorization: `Bearer ${tokenData.access_token}` } },
      );
      if (!listRes.ok) continue;
      const list = (await listRes.json().catch(() => ({}))) as { messages?: { id: string }[] };
      const ids = (list.messages || []).map((m) => m.id);

      for (const id of ids.slice(0, 5)) {
        const msgRes = await fetch(`${GMAIL}/messages/${id}?format=full`, {
          headers: { authorization: `Bearer ${tokenData.access_token}` },
        });
        if (!msgRes.ok) continue;
        const msg = (await msgRes.json().catch(() => ({}))) as any;
        const bodyContent = extractBodyFromPayload(msg.payload);
        const internalDate = msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : undefined;
        const jobs = parseIndeedEmailContent(bodyContent, internalDate);

        for (const j of jobs) {
          if (!seenIds.has(j.external_id)) {
            seenIds.add(j.external_id);
            allJobs.push(j);
          }
        }
      }
    } catch (err) {
      console.warn('[INDEED_EMAIL] Scrape failed for user link:', err instanceof Error ? err.message : err);
    }
  }

  return allJobs;
}

/** Sync Indeed alert emails directly for a user (e.g. from Settings or cron). */
export async function syncIndeedAlertsForUser(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
): Promise<number> {
  try {
    const listRes = await fetch(
      `${GMAIL}/messages?maxResults=10&q=` +
        encodeURIComponent('from:indeed.com newer_than:14d (subject:"job" OR subject:"alert" OR subject:"jobs")'),
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    if (!listRes.ok) return 0;
    const list = (await listRes.json().catch(() => ({}))) as { messages?: { id: string }[] };
    const ids = (list.messages || []).map((m) => m.id);
    if (!ids.length) return 0;

    // Find or seed the "Indeed Email Alerts" board company
    let { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('ats_provider', 'indeed_email')
      .maybeSingle();

    if (!company) {
      const { data: created } = await supabase
        .from('companies')
        .insert({
          name: INDEED_BOARD_COMPANY,
          ats_provider: 'indeed_email',
          careers_url: 'https://indeed.com/',
          category: 'Board',
          country: 'India',
          is_active: true,
        })
        .select('id')
        .single();
      company = created;
    }
    if (!company?.id) return 0;

    const scrapedJobs: ScrapedJob[] = [];
    for (const id of ids.slice(0, 6)) {
      const msgRes = await fetch(`${GMAIL}/messages/${id}?format=full`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!msgRes.ok) continue;
      const msg = (await msgRes.json().catch(() => ({}))) as any;
      const bodyContent = extractBodyFromPayload(msg.payload);
      const internalDate = msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : undefined;
      const parsed = parseIndeedEmailContent(bodyContent, internalDate);
      scrapedJobs.push(...parsed);
    }

    if (!scrapedJobs.length) return 0;

    // Deduplicate by external_id
    const unique = [...new Map(scrapedJobs.map((j) => [j.external_id, j])).values()];
    const rows = unique.map((j) => ({
      company_id: company.id,
      external_id: j.external_id,
      title: j.title.slice(0, 300),
      description: j.description || null,
      location: j.location,
      work_type: j.work_type,
      salary_min: j.salary_min,
      salary_max: j.salary_max,
      salary_currency: j.salary_currency,
      experience_required: j.experience_required,
      skills: j.skills,
      apply_url: j.apply_url,
      department: j.department,
      employer: j.employer,
      posted_at: j.posted_at,
      is_active: true,
      scraped_at: new Date().toISOString(),
    }));

    const { data: inserted } = await supabase
      .from('jobs')
      .upsert(rows, { onConflict: 'company_id,external_id' })
      .select('id, external_id, title, description, skills, location, employer');

    if (inserted?.length) {
      await upsertJobVectors(
        inserted.map((j) => ({
          id: j.id,
          title: j.title,
          description: j.description,
          company_name: j.employer || INDEED_BOARD_COMPANY,
          skills: j.skills || [],
          location: j.location,
        })),
      ).catch((e) => console.warn('[INDEED_EMAIL] Vector upsert failed:', e.message));
    }

    return inserted?.length || 0;
  } catch (err) {
    console.warn('[INDEED_EMAIL] syncIndeedAlertsForUser failed:', err instanceof Error ? err.message : err);
    return 0;
  }
}
