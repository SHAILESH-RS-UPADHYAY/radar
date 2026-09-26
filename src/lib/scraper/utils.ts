// ============================
// RADAR — Scraper helpers shared by every adapter
// ============================

import type { ExperienceLevel, WorkType } from '@/types';

export interface ScrapedJob {
  external_id: string;
  title: string;
  description: string;
  location: string;
  apply_url: string;
  department: string | null;
  work_type: WorkType | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  experience_required: ExperienceLevel | null;
  skills: string[];
  posted_at: string | null;
  /** Real employer when the source is a job board (HN, Remotive, ...). Null for company ATS boards. */
  employer: string | null;
}

const USER_AGENT = 'Mozilla/5.0 (compatible; RADAR-JobBot/1.0; personal job search)';

export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit & { timeoutMs?: number; retries?: number } = {},
): Promise<T> {
  const { timeoutMs = 20000, retries = 2, ...rest } = init;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...rest,
        headers: { 'user-agent': USER_AGENT, accept: 'application/json', ...(rest.headers || {}) },
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      });
      // 4xx other than rate limiting will not get better on retry
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw Object.assign(new Error('HTTP ' + res.status + ' from ' + url), { fatal: true });
      }
      if (!res.ok) throw new Error('HTTP ' + res.status + ' from ' + url);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      if ((err as { fatal?: boolean }).fatal || attempt === retries) break;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export async function fetchText(url: string, timeoutMs = 20000): Promise<string> {
  const res = await fetch(url, {
    headers: { 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' from ' + url);
  return res.text();
}

/** Run `fn` over `items` with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  hellip: '…',
  bull: '•',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** HTML (possibly entity-escaped, as Greenhouse returns it) → readable plain text. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  // Greenhouse double-encodes: "&lt;p&gt;" → "<p>" first, then strip tags, then decode what is left.
  const unescaped = /&lt;\/?[a-z]/i.test(html) ? decodeEntities(html) : html;
  return decodeEntities(
    unescaped
      .replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]*>/g, ' '),
  )
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function inferWorkType(text: string): WorkType | null {
  const lower = text.toLowerCase();
  if (lower.includes('hybrid')) return 'hybrid';
  if (lower.includes('remote')) return 'remote';
  if (
    lower.includes('on-site') ||
    lower.includes('onsite') ||
    lower.includes('in office') ||
    lower.includes('in-office')
  )
    return 'in-office';
  return null;
}

/** Seniority from the title first (most reliable), then from the description. */
export function inferExperience(title: string, description = ''): ExperienceLevel | null {
  const t = title.toLowerCase();
  if (/\b(intern|internship|trainee|apprentice|new grad|graduate|fresher|entry[- ]level)\b/.test(t)) return 'fresher';
  if (/\b(junior|jr\.?|associate)\b/.test(t)) return '0-1';
  if (/\b(senior|sr\.?|staff|principal|lead|head|director|manager|architect|vp)\b/.test(t)) return '5+';

  const d = description.toLowerCase();
  const years = d.match(/(\d{1,2})\s*\+?\s*(?:-|–|to)?\s*(\d{1,2})?\s*\+?\s*years?/);
  if (years) {
    const min = parseInt(years[1], 10);
    if (min <= 1) return '0-1';
    if (min <= 3) return '1-3';
    if (min <= 5) return '3-5';
    return '5+';
  }
  if (/\b(fresher|new grad|entry[- ]level|recent graduate)\b/.test(d)) return 'fresher';
  return null;
}

// Canonical skill → spellings that mean the same thing. Matching uses word boundaries,
// so "go" does not match "google" and "java" does not match "javascript".
export const SKILL_ALIASES: Record<string, string[]> = {
  python: ['python'],
  javascript: ['javascript', 'js', 'es6'],
  typescript: ['typescript', 'ts'],
  react: ['react', 'react.js', 'reactjs'],
  'next.js': ['next.js', 'nextjs'],
  'node.js': ['node.js', 'nodejs', 'node'],
  vue: ['vue', 'vue.js', 'vuejs'],
  angular: ['angular'],
  java: ['java'],
  kotlin: ['kotlin'],
  swift: ['swift'],
  'c++': ['c++', 'cpp'],
  'c#': ['c#', '.net', 'dotnet'],
  go: ['golang', 'go'],
  rust: ['rust'],
  ruby: ['ruby', 'rails', 'ruby on rails'],
  php: ['php', 'laravel'],
  scala: ['scala'],
  sql: ['sql'],
  postgresql: ['postgresql', 'postgres'],
  mysql: ['mysql'],
  mongodb: ['mongodb', 'mongo'],
  redis: ['redis'],
  kafka: ['kafka'],
  elasticsearch: ['elasticsearch', 'opensearch'],
  aws: ['aws', 'amazon web services'],
  gcp: ['gcp', 'google cloud'],
  azure: ['azure'],
  docker: ['docker'],
  kubernetes: ['kubernetes', 'k8s'],
  terraform: ['terraform'],
  linux: ['linux'],
  'machine learning': ['machine learning', 'ml'],
  'deep learning': ['deep learning'],
  llm: ['llm', 'llms', 'large language model', 'large language models', 'genai', 'generative ai'],
  rag: ['rag', 'retrieval augmented generation', 'retrieval-augmented generation'],
  langchain: ['langchain'],
  langgraph: ['langgraph'],
  llamaindex: ['llamaindex', 'llama index', 'llama-index'],
  openai: ['openai', 'gpt-4', 'gpt-4o'],
  'ai agents': ['ai agents', 'ai agent', 'agentic', 'multi-agent', 'llm agents'],
  'prompt engineering': ['prompt engineering'],
  'fine-tuning': ['fine-tuning', 'fine tuning', 'finetuning', 'lora', 'peft', 'rlhf'],
  'vector database': [
    'vector database',
    'vector databases',
    'vector db',
    'vector store',
    'pinecone',
    'weaviate',
    'qdrant',
    'milvus',
    'chromadb',
    'faiss',
    'pgvector',
  ],
  'hugging face': ['hugging face', 'huggingface', 'transformers'],
  mlops: ['mlops', 'mlflow', 'kubeflow'],
  'scikit-learn': ['scikit-learn', 'sklearn'],
  nlp: ['nlp', 'natural language processing'],
  'computer vision': ['computer vision'],
  pytorch: ['pytorch'],
  tensorflow: ['tensorflow'],
  pandas: ['pandas'],
  numpy: ['numpy'],
  spark: ['spark', 'pyspark'],
  airflow: ['airflow'],
  git: ['git'],
  'ci/cd': ['ci/cd', 'continuous integration'],
  'rest api': ['rest api', 'rest apis', 'restful'],
  graphql: ['graphql'],
  microservices: ['microservices', 'microservice'],
  'system design': ['system design', 'distributed systems'],
  fastapi: ['fastapi'],
  django: ['django'],
  flask: ['flask'],
  spring: ['spring', 'spring boot'],
  html: ['html'],
  css: ['css'],
  tailwind: ['tailwind', 'tailwindcss'],
  figma: ['figma'],
  'data structures': ['data structures', 'dsa'],
  algorithms: ['algorithms'],
  android: ['android'],
  ios: ['ios'],
  'react native': ['react native'],
  flutter: ['flutter'],
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SKILL_PATTERNS = Object.entries(SKILL_ALIASES).map(
  ([canonical, aliases]) =>
    // "-to-" / " to market" keep "Go-to-market" (sales JDs) from reading as the Go language.
    [
      canonical,
      new RegExp('(^|[^a-z0-9+#.])(' + aliases.map(escapeRe).join('|') + ')(?![a-z0-9+#]|-to-| to market)', 'i'),
    ] as const,
);

export function extractSkills(text: string): string[] {
  if (!text) return [];
  return SKILL_PATTERNS.filter(([, re]) => re.test(text)).map(([canonical]) => canonical);
}

/** Map any user-typed skill onto its canonical name so "ReactJS" and "react" compare equal. */
export function normalizeSkill(skill: string): string {
  const lower = skill.trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    if (canonical === lower || aliases.includes(lower)) return canonical;
  }
  return lower;
}

export function parseSalaryNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : null;
  const text = String(value).toLowerCase().replace(/,/g, '');
  const m = text.match(/(\d+(?:\.\d+)?)\s*(k|m|lpa|lakh)?/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (m[2] === 'k') n *= 1000;
  if (m[2] === 'm') n *= 1_000_000;
  if (m[2] === 'lpa' || m[2] === 'lakh') n *= 100_000;
  return Math.round(n);
}

/** "$120K – $150K" / "₹12L-18L" → { min, max, currency } */
export function parseSalaryRange(text: string | null | undefined): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  if (!text) return { min: null, max: null, currency: null };
  const currency = /₹|inr|lpa|lakh/i.test(text)
    ? 'INR'
    : /€|eur/i.test(text)
      ? 'EUR'
      : /£|gbp/i.test(text)
        ? 'GBP'
        : /\$|usd/i.test(text)
          ? 'USD'
          : null;
  const nums = text.replace(/,/g, '').match(/\d+(?:\.\d+)?\s*(?:k|m|lpa|lakh)?/gi) || [];
  const values = nums.map(parseSalaryNumber).filter((n): n is number => n !== null && n > 0);
  return { min: values[0] ?? null, max: values[1] ?? null, currency };
}

export function toIso(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const d =
    typeof value === 'number'
      ? new Date(value < 1e12 ? value * 1000 : value)
      : new Date(String(value).replace(' UTC', 'Z').replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Titles we care about. Keeps non-tech roles (sales, legal, ...) out of the DB and out of the
// embedding budget. Override with RADAR_TITLE_KEYWORDS="engineer,developer,..." if your target changes.
const DEFAULT_TITLE_KEYWORDS = [
  'engineer',
  'developer',
  'software',
  'sde',
  'swe',
  'programmer',
  'frontend',
  'front-end',
  'backend',
  'back-end',
  'full stack',
  'fullstack',
  'full-stack',
  'devops',
  'sre',
  'site reliability',
  'platform engineer',
  'data',
  'machine learning',
  'ml',
  'ai',
  'scientist',
  'analyst',
  'architect',
  'mobile',
  'android',
  'ios',
  'web',
  'cloud',
  'infrastructure',
  'security engineer',
  'qa',
  'test engineer',
  'sdet',
];

/** Keywords used where a source needs a search (Workday, Amazon, Adzuna, Jooble). */
export function searchTerms(): string[] {
  return splitEnvList(process.env.RADAR_SEARCH_TERMS || 'software engineer,developer,data');
}

/** Comma- or pipe-separated env value → trimmed list (pipes when the values themselves contain commas). */
export function splitEnvList(value: string, separator: ',' | '|' = ','): string[] {
  return value
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean);
}

function titleKeywords(): string[] {
  const env = process.env.RADAR_TITLE_KEYWORDS;
  if (env?.trim())
    return env
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
  return DEFAULT_TITLE_KEYWORDS;
}

export function isRelevantTitle(title: string): boolean {
  if (process.env.RADAR_TITLE_FILTER === 'off') return true;
  const lower = ' ' + title.toLowerCase() + ' ';
  return titleKeywords().some((k) => new RegExp('[^a-z]' + escapeRe(k) + '[^a-z]').test(lower));
}

/** Fill the derived fields every adapter would otherwise compute by hand. */
export function finalizeJob(
  job: Omit<ScrapedJob, 'skills' | 'experience_required' | 'work_type'> &
    Partial<Pick<ScrapedJob, 'skills' | 'experience_required' | 'work_type'>>,
): ScrapedJob {
  const description = job.description.slice(0, 12000);
  return {
    ...job,
    title: job.title.trim(),
    description,
    location: job.location?.trim() || 'Not specified',
    work_type: job.work_type ?? inferWorkType(job.location + ' ' + job.title),
    experience_required: job.experience_required ?? inferExperience(job.title, description),
    skills: job.skills?.length ? job.skills : extractSkills(job.title + '\n' + description),
  };
}
