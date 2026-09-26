// Public facts about what RADAR scans, derived from the seed list so the site never drifts from it.

import type { Provider } from '@/types';
import { COMPANY_SEEDS, type CompanySeed } from './companies';

/** Display names for every source RADAR can read (the Record makes a new provider a type error until named). */
export const SOURCE_NAMES: Record<Exclude<Provider, 'custom'>, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  workable: 'Workable',
  smartrecruiters: 'SmartRecruiters',
  recruitee: 'Recruitee',
  personio: 'Personio',
  breezy: 'Breezy HR',
  workday: 'Workday',
  amazon: 'Amazon Jobs',
  hackernews: 'Hacker News',
  remotive: 'Remotive',
  remoteok: 'Remote OK',
  arbeitnow: 'Arbeitnow',
  himalayas: 'Himalayas',
};

const employers = COMPANY_SEEDS.filter((c) => c.category !== 'Board');

export const CATALOG = {
  /** Distinct feeds RADAR has an adapter for (ATS + job boards). */
  sources: Object.keys(SOURCE_NAMES).length,
  /** Companies you can pick as dream companies. */
  companies: employers.length,
  /** Companies whose careers feed is scraped every cycle. */
  tracked: employers.filter((c) => c.ats_provider !== 'custom').length,
  boards: COMPANY_SEEDS.filter((c) => c.category === 'Board'),
  byCategory: (['MNC', 'Growth', 'Startup'] as const).map((category) => ({
    category,
    companies: employers.filter((c) => c.category === category) as CompanySeed[],
  })),
};

export const sourceName = (p: Provider) => (p === 'custom' ? 'selectable' : SOURCE_NAMES[p]);
