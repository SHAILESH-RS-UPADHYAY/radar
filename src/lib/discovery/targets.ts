// ============================
// RADAR — Import list parsing: pasted websites or a CSV (e.g. a FundedStartupsDaily export you bought)
// ============================
// Pure and shared by the Settings page (preview) and /api/discovery (the server re-checks everything).

export interface Target {
  name: string | null;
  website: string;
}

export const MAX_TARGETS = 1000;

// Links that name a profile, not the company's own site.
const NOT_A_COMPANY_SITE =
  /(^|\.)(linkedin\.com|x\.com|twitter\.com|facebook\.com|instagram\.com|youtube\.com|crunchbase\.com|medium\.com|wellfound\.com|angel\.co|github\.com|fundedstartupsdaily\.com|startupmap\.one|worldstartupmap\.com)$/;

/** "https://www.Acme.io/about" → "acme.io"; null when the text is not a usable company website. */
export function siteDomain(raw: string): string | null {
  const text = raw.trim();
  if (!text || /\s/.test(text) || !/^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([/?#]\S*)?$/i.test(text))
    return null;
  try {
    const host = new URL(/^https?:\/\//i.test(text) ? text : 'https://' + text).hostname.toLowerCase();
    const domain = host.replace(/^www\./, '');
    return /\.[a-z]{2,}$/.test(domain) && !NOT_A_COMPANY_SITE.test(domain) ? domain : null;
  } catch {
    return null;
  }
}

/** Minimal RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const WEBSITE_HEADER = /^(website|domain|url|homepage|site|company (url|website|domain))$/;
const NAME_HEADER = /^(name|company|company name|startup|organi[sz]ation)$/;

/**
 * A CSV with a website/domain column, or free text with one company per line ("Acme, https://acme.io" or just
 * "acme.io"). Deduplicated by domain, capped at MAX_TARGETS.
 */
export function parseTargets(text: string): Target[] {
  const rows = parseCsv(text.trim());
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const webCol = header.findIndex((h) => WEBSITE_HEADER.test(h));
  const nameCol = header.findIndex((h) => NAME_HEADER.test(h));

  const out = new Map<string, Target>();
  for (const row of webCol >= 0 ? rows.slice(1) : rows) {
    let domain: string | null = null;
    let name: string | null = null;
    if (webCol >= 0) {
      domain = siteDomain(row[webCol] || '');
      name = nameCol >= 0 ? row[nameCol]?.trim() || null : null;
    } else {
      const words = row
        .join(' ')
        .split(/[\s,;|]+/)
        .filter(Boolean);
      const at = words.findIndex((w) => siteDomain(w));
      if (at >= 0) {
        domain = siteDomain(words[at]);
        name = words.filter((_, i) => i !== at).join(' ') || null;
      }
    }
    if (domain && !out.has(domain))
      out.set(domain, { name: name?.slice(0, 120) || null, website: 'https://' + domain });
    if (out.size >= MAX_TARGETS) break;
  }
  return [...out.values()];
}
