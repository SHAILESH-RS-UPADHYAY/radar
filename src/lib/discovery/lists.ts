// ============================
// RADAR — Company lists that are free to use, turned into discovery queue rows. Pure functions, no network.
// ============================
//   hn   "Ask HN: Who is hiring?" (official HN Algolia API): companies post their own ATS links, so no guessing.
//   hww  Hiring Without Whiteboards (github.com/poteto/hiring-without-whiteboards, MIT): ~765 companies, each with
//        its careers link and location.
// VC portfolio boards (Accel, Blume: Getro) are not here: Getro's terms forbid crawling, robots.txt or not.

import { decodeEntities } from '@/lib/scraper/utils';
import { boardUrl, detectAts } from './ats';

export interface ListRow {
  source: string;
  source_ref: string;
  name: string | null;
  website: string | null;
  priority: number;
}

const INDIA = /\b(india|bangalore|bengaluru|hyderabad|pune|chennai|mumbai|delhi|gurgaon|gurugram|noida|mohali)\b/i;

/** 2 when the text names one of your cities, 1 for India or remote, else 0. */
export function placePriority(text: string, cities: string[]): number {
  const t = text.toLowerCase();
  if (cities.some((c) => c.length > 2 && t.includes(c.toLowerCase()))) return 2;
  return INDIA.test(text) || /\bremote\b/i.test(text) ? 1 : 0;
}

/** One queue row per company that linked its ATS board in a "Who is hiring?" thread. */
export function hnRows(comments: { text?: string | null }[], cities: string[]): ListRow[] {
  const out = new Map<string, ListRow>();
  for (const c of comments) {
    const text = decodeEntities(c.text || '');
    const ref = detectAts(text.match(/https?:\/\/[^\s"'<>)]+/g) || []);
    if (!ref) continue;
    const key = ref.provider + ':' + ref.identifier.toLowerCase();
    if (out.has(key)) continue;
    // Posts open with "Company | Role | Location | ...".
    const name = text
      .replace(/<[^>]+>/g, ' ')
      .split('|')[0]
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    out.set(key, {
      source: 'hn',
      source_ref: key,
      name: name || null,
      website: boardUrl(ref),
      priority: placePriority(text, cities),
    });
  }
  return [...out.values()];
}

/** Hiring Without Whiteboards README lines: "- [Name](careers link) | Location | interview notes". */
export function hwwRows(readme: string, cities: string[]): ListRow[] {
  const out = new Map<string, ListRow>();
  for (const line of readme.split('\n')) {
    const m = line.match(/^\s*[-*]\s*\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)\s*\|?\s*([^|]*)/);
    if (!m) continue;
    const website = m[2].replace(/[#?].*$/, '').replace(/\/$/, '');
    const key = website.toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
    if (!out.has(key))
      out.set(key, {
        source: 'hww',
        source_ref: key.slice(0, 200),
        name: m[1].trim().slice(0, 120),
        website,
        priority: placePriority(m[3], cities),
      });
  }
  return [...out.values()];
}
