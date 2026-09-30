// Input rules shared by API routes and the browser. No server-only imports, so pages can use it too.

import type { Portfolio } from '@/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

export const MAX_PROJECTS = 12;

/** "github.com/asha" → "https://github.com/asha"; '' stays ''; null when it is not a web address. */
export function cleanUrl(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : 'https://' + raw);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) return null;
    return url.href.slice(0, 300);
  } catch {
    return null;
  }
}

/** A portfolio as sent by the browser → the stored shape, or the reason it cannot be saved. */
export function cleanPortfolio(input: unknown): Portfolio | string {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: Portfolio = { portfolio: '', github: '', linkedin: '', website: '', projects: [] };
  for (const key of ['portfolio', 'github', 'linkedin', 'website'] as const) {
    const url = cleanUrl(o[key]);
    if (url === null) return `${key[0].toUpperCase() + key.slice(1)}: that is not a web address.`;
    out[key] = url;
  }
  const projects = Array.isArray(o.projects) ? o.projects : [];
  for (const p of projects.slice(0, MAX_PROJECTS)) {
    const item = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
    const name = typeof item.name === 'string' ? item.name.trim().slice(0, 60) : '';
    const url = cleanUrl(item.url);
    if (url === null) return `"${name || 'Project'}": that link is not a web address.`;
    if (!name && !url) continue;
    const note = typeof item.note === 'string' ? item.note.trim().slice(0, 160) : '';
    out.projects.push({ name: name || new URL(url!).hostname, url: url!, note });
  }
  return out;
}

/** Dream companies a profile can pick; every open role at them is scored on each scan. */
export const MAX_DREAM_COMPANIES = 50;

// Vercel refuses request bodies over 4.5 MB before the route runs, so the limit sits below that.
export const MAX_RESUME_BYTES = 4 * 1024 * 1024;

/** Why a file cannot be used as a resume, or null when it can. */
export function resumeProblem(file: { name: string; size: number; type: string }): string | null {
  if (!file.size) return 'The file is empty.';
  if (file.size > MAX_RESUME_BYTES) return 'Resume must be under 4 MB.';
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))
    return 'Only PDF resumes are supported.';
  return null;
}
