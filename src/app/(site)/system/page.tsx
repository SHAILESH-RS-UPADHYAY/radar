import type { Metadata } from 'next';
import Link from 'next/link';
import { HudPanel, StatusLight } from '@/components/hud/Hud';
import { CodeBlock, DataTable, DocLayout, DocSection, PageHero, Points } from '@/components/site/Doc';
import { CATALOG, SOURCE_NAMES, sourceName } from '@/lib/scraper/catalog';
import { COMPANY_SEEDS } from '@/lib/scraper/companies';
import { BOARD_PROVIDERS } from '@/lib/scraper/boards';
import type { Provider } from '@/types';

export const metadata: Metadata = {
  title: 'System',
  description: 'How RADAR works: dream company tracking, AI semantic matching, the automated scan loop and the Vault.',
};

const TOC = [
  { id: 'dream-tracking', label: 'DREAM_TRACK' },
  { id: 'semantic-matching', label: 'SEMANTIC_MATCH' },
  { id: 'scan-loop', label: 'SCAN_LOOP' },
  { id: 'vault', label: 'THE_VAULT' },
  { id: 'sources', label: 'SOURCES' },
  { id: 'discovery', label: 'DISCOVERY' },
  { id: 'companies', label: 'COMPANY_INDEX' },
];

const feeds = CATALOG.tracked + CATALOG.boards.length;

const BOARD_NOTES: Partial<Record<Provider, string>> = {
  hackernews: 'Latest "Who is hiring" thread',
  remotive: 'Remote software and data roles',
  remoteok: 'Remote tech roles',
  arbeitnow: 'European tech roles, many visa-friendly',
  himalayas: 'Remote roles worldwide',
  jobicy: 'Remote engineering and data roles, credited to Jobicy',
  themuse: 'Software engineering in major cities and remote',
  adzuna: 'Official API across India, UK, EU, Singapore and US (needs a key)',
  jooble: 'Official multi-country search API (needs a key)',
};
const perProvider = (p: Provider) => COMPANY_SEEDS.filter((c) => c.ats_provider === p).length;
const boards = new Set<string>(BOARD_PROVIDERS);
const ATS = (Object.keys(SOURCE_NAMES) as Exclude<Provider, 'custom'>[]).filter((p) => !boards.has(p));

const LOOP_LOG = `[discover]  startupmap.one · robots.txt obeyed · sitemap every 48h · 1 request / 1.5s
[discover]  hiring pages, your cities first → startup page → ATS board (verified)
[scrape]    least recently scraped first · the ATS feed is the source of truth
[embed]     changed only · sha1(title, location, url, description)
[alerts]    your Indeed, LinkedIn and Welcome to the Jungle alert emails → jobs
[close]     gone from an ATS feed twice, or unseen on a board for days → inactive
[match]     every user with a resume → match_scores · 2 roles per company at most
[verify]    board postings: apply link opened before anything enters the Vault
[vault]     score ≥ your bar (80% by default) → saved (auto)
[autopilot] Vault + Discovery re-check · reopened jobs back · Gmail → C2 · OPS`;

const STEPS: [string, string][] = [
  ['EMBED', 'Your resume and every job become 1024-dimension vectors (multilingual-e5-large on Pinecone).'],
  ['RETRIEVE', 'Pinecone returns the 400 jobs whose vectors sit closest to yours, by cosine similarity.'],
  ['SCORE', 'Each one gets a 0-100 score: meaning and skills first, then target role, seniority and location.'],
  ['EXPLAIN', 'Every card shows why: matched and missing skills, how well it aligns, and any penalty applied.'],
];

export default function SystemPage() {
  return (
    <>
      <PageHero
        command="man radar"
        title="SYSTEM"
        lead="RADAR is a personal job-intelligence engine. It watches the careers pages of the companies you care about, reads every opening, scores each one against your profile and saves the strong ones to your Vault, every six hours, on its own."
        meta={[
          ['SOURCES', String(CATALOG.sources)],
          ['COMPANIES', String(CATALOG.companies)],
          ['LIVE FEEDS', String(feeds)],
          ['CYCLE', '6H'],
        ]}
      />

      <DocLayout toc={TOC}>
        <DocSection id="dream-tracking" index="01" kicker="MODULE://A · DREAM_TRACK" title="Dream company tracking">
          <p>
            You pick the companies you actually want to work at, up to 20, during onboarding or any time in Preferences.
            RADAR treats them differently from everything else:
          </p>
          <Points
            items={[
              [
                'ALWAYS SCORED',
                'Semantic search returns the 400 jobs closest to your resume. Every open role at a dream company is scored on top of that, so nothing there slips through.',
              ],
              ['OWN LANE', 'Their jobs appear under DREAM in Discovery, apart from Recommended and Startups.'],
              [
                'CITY-AWARE',
                'The picker only offers companies that really hire in your cities: live job evidence plus a hand-checked list of offices.',
              ],
              [
                'FRESH ON DAY 1',
                'Finishing onboarding starts a background scrape of your dream companies, so the first scan runs on fresh data.',
              ],
            ]}
          />
          <p>
            Companies without a public feed can still be picked; they are marked <em>selectable</em> below and are
            scraped as soon as a feed is wired up.
          </p>
        </DocSection>

        <DocSection id="semantic-matching" index="02" kicker="MODULE://B · SEMANTIC_MATCH" title="AI semantic matching">
          <p>
            Keyword search misses a Backend Engineer posting that asks for exactly what you have done, just in other
            words. RADAR compares meaning instead.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {STEPS.map(([title, body], i) => (
              <HudPanel key={title} bodyClassName="p-5">
                <p className="font-mono text-[10px] tracking-[0.3em] text-phosphor">
                  STEP {String(i + 1).padStart(2, '0')} · {title}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-dim">{body}</p>
              </HudPanel>
            ))}
          </div>
          <p>
            Exact weights and thresholds are in the{' '}
            <Link href="/protocol#scoring" className="text-phosphor underline-offset-4 hover:underline">
              protocol spec
            </Link>
            .
          </p>
        </DocSection>

        <DocSection id="scan-loop" index="03" kicker="MODULE://C · SCAN_LOOP" title="Automated scan loop">
          <p>
            Every six hours Vercel Cron calls the pipeline, and an hour later the check that keeps every list clean. One
            run does everything:
          </p>
          <CodeBlock label="/var/log/radar/cron.log" status="TAIL -F">
            {LOOP_LOG}
          </CodeBlock>
          <p>
            Runs are time-boxed. A run that reaches its limit stops cleanly, and the next one starts with the companies
            it skipped.
          </p>
        </DocSection>

        <DocSection id="vault" index="04" kicker="THE_VAULT" title="The Vault">
          <p>
            The Vault is your shortlist. Matches at or above your threshold (80% by default, adjustable in Preferences)
            are saved automatically after every scan, tagged <span className="text-phosphor">AUTO-MATCHED</span>. You
            can also save anything from Discovery yourself.
          </p>
          <div className="grid gap-3 font-mono text-xs sm:grid-cols-4">
            {[
              ['DISCOVERY', 'new matches', 'ok'],
              ['VAULT', 'saved / auto', 'ok'],
              ['BATTLEFIELD', 'applied', 'info'],
              ['DISMISSED', 'never returns', 'alert'],
            ].map(([name, sub, tone]) => (
              <div key={name} className="border border-phosphor/20 bg-black/60 p-4">
                <StatusLight tone={tone as 'ok' | 'info' | 'alert'} pulse={false}>
                  {name}
                </StatusLight>
                <p className="mt-2 text-dim">{sub}</p>
              </div>
            ))}
          </div>
          <p>
            Nothing enters the Vault unverified: company ATS feeds only list open roles, and a job-board posting has its
            apply link opened first. Every Vault job is checked again each day, and a closed one leaves the Vault on the
            next scan.
          </p>
          <p>Removing a job from the Vault dismisses it, and a dismissed job is never shown or auto-saved again.</p>
        </DocSection>

        <DocSection id="sources" index="05" kicker="SOURCES" title={`${CATALOG.sources} sources, read at the origin`}>
          <p>
            RADAR reads the same public feeds a company&apos;s own careers page is built on, so jobs arrive the moment
            they are posted, with the real apply link.
          </p>
          <DataTable
            label="COMPANY ATS FEEDS"
            head={['ADAPTER', 'COMPANIES', 'READS']}
            rows={ATS.map((p) => [
              SOURCE_NAMES[p],
              String(perProvider(p) || 'via discovery'),
              'Public job-board API of each company',
            ])}
          />
          <DataTable
            label="JOB BOARDS"
            head={['BOARD', 'REGION', 'READS']}
            rows={CATALOG.boards.map((b) => [b.name, b.country, BOARD_NOTES[b.ats_provider] || 'Tech listings'])}
          />
        </DocSection>

        <DocSection id="discovery" index="06" kicker="MODULE://D · DISCOVERY" title="Funded startups, found for you">
          <p>
            RADAR reads startup directories only where the site allows it, and asks each company&apos;s own careers feed
            for the jobs.
          </p>
          <Points
            items={[
              [
                'STARTUPMAP',
                'Crawled every 48h as its robots.txt invites: sitemap, hiring pages (your cities first), then each startup page, whose job links name the ATS board. One request every 1.5s, an honest bot name, and a pause at the first "slow down".',
              ],
              [
                'FUNDEDSTARTUPSDAILY',
                'Its terms forbid scraping, so RADAR does not. Buy its CSV export (licensed for your own use) and drop it in Preferences → TARGETS.',
              ],
              [
                'WORLDSTARTUPMAP',
                'Its data sits behind an API that robots.txt closes and that is rate-limited against harvesting. Paste the websites of companies you like into TARGETS.',
              ],
              [
                'CAREERS FEEDS',
                'Every found company is matched to its Greenhouse, Lever, Ashby, Workable, Teamtailor (or other) board and scraped like any tracked company.',
              ],
            ]}
          />
        </DocSection>

        <DocSection id="companies" index="07" kicker="COMPANY_INDEX" title={`${CATALOG.companies} companies indexed`}>
          <p>
            <span className="text-phosphor">{CATALOG.tracked}</span> are scraped every cycle; the rest are selectable as
            dream companies.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {CATALOG.byCategory.map(({ category, companies }) => (
              <HudPanel
                key={category}
                label={category.toUpperCase()}
                status={String(companies.length)}
                tone="idle"
                bodyClassName="p-0"
              >
                <ul className="max-h-[420px] overflow-y-auto custom-scrollbar">
                  {companies.map((c) => (
                    <li
                      key={c.name}
                      className="flex items-center justify-between gap-3 border-b border-phosphor/10 px-4 py-2.5 last:border-b-0"
                    >
                      <span className={'text-sm ' + (c.ats_provider === 'custom' ? 'text-dim' : 'text-ink')}>
                        {c.name}
                      </span>
                      <span
                        className={
                          'font-mono text-[10px] tracking-wider ' +
                          (c.ats_provider === 'custom' ? 'text-dim/60' : 'text-phosphor/70')
                        }
                      >
                        {sourceName(c.ats_provider)}
                      </span>
                    </li>
                  ))}
                </ul>
              </HudPanel>
            ))}
          </div>
        </DocSection>
      </DocLayout>
    </>
  );
}
