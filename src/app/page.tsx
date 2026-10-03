'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { AnimatePresence, motion, useScroll } from 'framer-motion';
import { useAuth } from '@clerk/nextjs';
import { TerminalText } from '@/components/ui/TerminalText';
import { HudPanel, Prompt, SectionHeader, StatusLight, type Tone } from '@/components/hud/Hud';
import { SiteNav } from '@/components/site/SiteNav';
import { SiteFooter } from '@/components/site/SiteFooter';
import { CATALOG } from '@/lib/scraper/catalog';
import { DiscoveryCard } from '@/components/dashboard/DiscoveryCard';
import { JobTerminal, type JobDetail } from '@/components/dashboard/JobTerminal';
import type { MatchedJob } from '@/components/dashboard/types';

const HackerRadarHero = dynamic(() => import('@/components/hero/HackerRadarHero'), { ssr: false });
const SmoothScroll = dynamic(() => import('@/components/providers/SmoothScroll'), { ssr: false });

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

const MODULES: {
  code: string;
  anchor: string;
  name: string;
  title: string;
  desc: string;
  spec: [string, string][];
  status: string;
  tone: Tone;
}[] = [
  {
    code: 'A',
    anchor: 'dream-tracking',
    name: 'DREAM_TRACK',
    title: 'Dream company tracking',
    desc: `Pick up to 20 of ${CATALOG.companies} companies. Every open role at them is scored for you on each scan, even the ones outside the semantic top 400.`,
    spec: [
      ['feeds', `${CATALOG.tracked} ATS + ${CATALOG.boards.length} boards`],
      ['priority', 'always scored'],
      ['lane', 'DREAM'],
    ],
    status: 'ACTIVE',
    tone: 'ok',
  },
  {
    code: 'B',
    anchor: 'semantic-matching',
    name: 'SEMANTIC_MATCH',
    title: 'AI semantic matching',
    desc: 'Your resume and every job description become 1024-dimension vectors. Meaning, skills, target role, seniority and location blend into one score.',
    spec: [
      ['model', 'e5-large · 1024d'],
      ['blend', '60% meaning · 40% skills'],
      ['boost', '+10 target role'],
    ],
    status: 'OPTIMAL',
    tone: 'info',
  },
  {
    code: 'C',
    anchor: 'scan-loop',
    name: 'SCAN_LOOP',
    title: 'Automated scan loop',
    desc: 'Every 6 hours RADAR re-reads every feed, embeds only what changed, closes postings that were taken down and drops strong matches into your Vault.',
    spec: [
      ['cycle', 'every 6h'],
      ['dedupe', 'sha1 content hash'],
      ['vault', 'score ≥ your bar'],
    ],
    status: 'ARMED',
    tone: 'warn',
  },
];

const STAGES = [
  {
    n: '01',
    title: 'SCRAPE',
    body: `${CATALOG.sources} adapters pull openings straight from company ATS feeds and job boards.`,
    stat: `${CATALOG.tracked + CATALOG.boards.length} feeds`,
  },
  {
    n: '02',
    title: 'EMBED',
    body: 'New or changed postings become 1024-d vectors. Unchanged ones are skipped by content hash.',
    stat: '1024-d',
  },
  {
    n: '03',
    title: 'MATCH',
    body: 'Your profile meets every open job: meaning, skills, role, seniority, location.',
    stat: '0-100',
  },
  {
    n: '04',
    title: 'VAULT',
    body: 'Jobs above your threshold are saved for you. Dismissed ones never come back.',
    stat: '≥ 70%',
  },
];

type Mark = 'yes' | 'no' | 'part';
const COMPARISON: [string, Mark, Mark, Mark][] = [
  ['AI resume ↔ JD matching (1024-d)', 'yes', 'no', 'no'],
  ['Reads company ATS feeds directly', 'yes', 'no', 'no'],
  ['Rescans on its own every 6h', 'yes', 'no', 'no'],
  ['Fresher-first ranking', 'yes', 'no', 'part'],
  ['Location-aware sorting', 'yes', 'part', 'part'],
];
const MARK: Record<Mark, { glyph: string; cls: string }> = {
  yes: { glyph: '[+]', cls: 'text-phosphor' },
  no: { glyph: '[-]', cls: 'text-hud-red/70' },
  part: { glyph: '[~]', cls: 'text-hud-amber/80' },
};

const STATS = [
  { value: CATALOG.sources, suffix: '', label: 'SOURCE ADAPTERS' },
  { value: CATALOG.companies, suffix: '', label: 'COMPANIES INDEXED' },
  { value: 1024, suffix: 'D', label: 'EMBEDDING DIMS' },
  { value: 6, suffix: 'H', label: 'SCAN CYCLE' },
];

const QUOTES = [
  "Your placement officer can't do what RADAR does in 60 seconds.",
  "Gharwale poochenge 'Beta job lagi?' — You say 'RADAR laga rakha hai.'",
  'While you sleep, RADAR scrapes. While they scroll LinkedIn, you apply first.',
  '50 companies. 1 click. 0 recruiter ghosting. Math checks out.',
  "We don't find jobs. We intercept them before they go viral.",
];

const FAQ = [
  {
    q: 'Where do jobs come from?',
    a: 'Straight from company careers pages through their public ATS feeds (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, Personio, Workday, Amazon Jobs), including European companies you know from Welcome to the Jungle, plus job boards and official job APIs: Hacker News "Who is hiring", Remotive, Remote OK, Arbeitnow, Himalayas, Jobicy, The Muse, Adzuna and Jooble.',
  },
  {
    q: 'How is the match score calculated?',
    a: '60% semantic similarity between your resume and the job description, 40% skill overlap, +10 when the title contains one of your target roles, then seniority and location adjustments. The full spec is on the Protocol page.',
  },
  {
    q: 'How is this different from LinkedIn?',
    a: 'RADAR rescans every 6 hours on its own, reads the source feeds directly instead of reposts, and ranks every job against your resume, not against keywords.',
  },
  {
    q: 'Can I change my preferences later?',
    a: 'Any time. Target roles, skills, cities, dream companies, your resume and the auto-vault threshold are all editable in Preferences, and a rescan applies them immediately.',
  },
  {
    q: 'Is my resume safe?',
    a: 'It is parsed on the server, used only to score jobs for you, never shared with employers, and deleted with your account. The Privacy page lists exactly what is stored.',
  },
  {
    q: 'What happens to jobs I dismiss?',
    a: 'They are gone for good: a dismissed job is never shown in Discovery or auto-saved to your Vault again.',
  },
  {
    q: 'Is this for freshers only?',
    a: 'Built for Indian freshers and early-career engineers first, but anyone can use it.',
  },
];

function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        obs.disconnect();
        let v = 0;
        const step = Math.max(1, Math.ceil(target / 40));
        timer = setInterval(() => {
          v = Math.min(target, v + step);
          setN(v);
          if (v >= target) clearInterval(timer);
        }, 25);
      },
      { threshold: 0.5 },
    );
    if (ref.current) obs.observe(ref.current);
    return () => {
      obs.disconnect();
      clearInterval(timer);
    };
  }, [target]);
  return (
    <span ref={ref}>
      {n}
      {suffix}
    </span>
  );
}

const JOURNEY = [
  {
    n: '01',
    time: '≈ 2 MIN',
    title: 'Brief the radar',
    body: 'Upload your resume, then pick target roles, cities and up to 20 dream companies. Everything stays editable.',
  },
  {
    n: '02',
    time: 'EVERY 6H',
    title: 'It scans for you',
    body: `RADAR reads ${CATALOG.tracked + CATALOG.boards.length} live feeds, scores every new opening against your profile and explains each score.`,
  },
  {
    n: '03',
    time: '1 CLICK',
    title: 'Apply from the Vault',
    body: 'Strong matches wait in your Vault. Open the real apply link and RADAR tracks it on your Battlefield.',
  },
];

// A made-up match rendered with the real Discovery card, so the preview is exactly what users get.
const SAMPLE: MatchedJob = {
  id: 'sample',
  score: 91,
  reasoning:
    'Title matches Software Engineer. Matches 5/6 listed skills. Missing: kubernetes. Strong resume-JD alignment. Remote',
  matching_skills: ['python', 'typescript', 'llm', 'rag', 'react'],
  missing_skills: ['kubernetes'],
  section: 'dream',
  status: 'new',
  auto_saved: false,
  status_changed_at: null,
  first_seen_at: null,
  stage: null,
  stage_changed_at: null,
  applied_at: null,
  notes: null,
  resume_version_id: null,
  last_event: null,
  job: {
    id: 'sample',
    title: 'Software Engineer, AI Platform',
    location: 'Remote · India',
    work_type: 'remote',
    skills: [],
    apply_url: '/sign-up',
    form_url: '/sign-up',
    department: 'Engineering',
    posted_at: null,
    is_active: true,
    experience_required: '1-3',
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    company: { name: 'Northwind AI', source: null, category: 'Growth' },
  },
};

// What the JD terminal shows for the sample (a made-up posting from a made-up company).
const SAMPLE_DETAIL: JobDetail = {
  job: {
    id: 'sample',
    title: SAMPLE.job.title,
    company: 'Northwind AI',
    via: null,
    category: 'Growth',
    fundingStage: 'Series B',
    source: 'startupmap',
    provider: 'ashby',
    providerName: 'Ashby',
    location: 'Remote · India',
    workType: 'remote',
    salary: { min: null, max: null, currency: null },
    applyUrl: '/sign-up',
    description: [
      'About the role',
      'Northwind AI builds the retrieval and agent platform behind thousands of support teams. You will own the services that turn raw documents into answers, fast and at scale.',
      '',
      "What you'll do",
      '• Build RAG pipelines in Python and TypeScript that serve 40M queries a month',
      '• Ship LLM features end to end: prompts, evals and a streaming UI in React',
      '• Design APIs and data models on Postgres and Redis',
      '• Run services on Kubernetes and keep p95 latency under 300ms',
      '',
      "What we're looking for",
      '• 1-3 years building production software',
      '• Strong Python or TypeScript, and something you shipped with an LLM',
      '• Hands-on retrieval evaluation with a vector database',
      '• Kubernetes in production is a plus',
      '',
      'What we offer',
      '• Remote across India, core hours 11:00–16:00 IST',
      '• ₹28L – ₹40L base plus equity',
      '• Learning budget and a new laptop on day one',
    ].join('\n'),
  },
  match: { score: SAMPLE.score, matching: SAMPLE.matching_skills, missing: SAMPLE.missing_skills, status: 'new' },
  posting: { state: 'live', checkedAt: null, via: 'feed' },
  you: { experienceYears: 2 },
};

const ANATOMY: [string, string][] = [
  ['SCORE', 'Meaning and skills blended into one number, 0-100.'],
  ['+10', 'The title contains one of your target roles.'],
  ['SKILLS', 'Green: you have it. Red: the job wants it and you have not listed it.'],
  ['WHY', 'Every card says why it scored what it did, in one line.'],
  ['ACTIONS', 'Apply, keep it in the Vault, or dismiss it for good.'],
];

/** Scrolling strip of the companies RADAR reads every cycle. */
function SignalTicker() {
  const names = CATALOG.byCategory.flatMap((c) =>
    c.companies.filter((x) => x.ats_provider !== 'custom').map((x) => x.name),
  );
  return (
    <section aria-label="Companies RADAR tracks" className="relative border-y border-phosphor/15 bg-black/80">
      <div className="mx-auto flex max-w-[1280px] items-center gap-6 px-4 py-4 sm:px-6">
        <span className="shrink-0">
          <StatusLight tone="ok">LIVE FEEDS</StatusLight>
        </span>
        <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]">
          <div className="hud-marquee flex w-max gap-10 pr-10 font-mono text-xs tracking-[0.25em] text-dim">
            {[...names, ...names].map((n, i) => (
              <span key={i} aria-hidden={i >= names.length} className="whitespace-nowrap">
                <span className="text-phosphor/60">▸ </span>
                {n.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Rotating quotes, isolated so the timer re-renders only this panel. */
function Transmissions() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % QUOTES.length), 6000);
    return () => clearInterval(t);
  }, []);
  return (
    <HudPanel
      label={`INCOMING://TRANSMISSION 0x0${i + 1}`}
      status="DECRYPTED"
      tone="info"
      className="flex w-full flex-col"
      bodyClassName="flex flex-1 flex-col justify-center px-5 py-10 sm:px-10 sm:py-14"
    >
      <AnimatePresence mode="wait">
        <motion.p
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="min-h-[4.5rem] text-center font-mono text-lg font-bold leading-relaxed text-white sm:text-2xl"
        >
          <span className="text-phosphor">&quot;</span>
          <TerminalText text={QUOTES[i]} typingSpeed={22} />
          <span className="text-phosphor">&quot;</span>
        </motion.p>
      </AnimatePresence>
      <div className="mt-8 flex justify-center gap-2">
        {QUOTES.map((_, k) => (
          <button
            key={k}
            onClick={() => setI(k)}
            aria-label={'Transmission ' + (k + 1)}
            className={'h-1 transition-all duration-300 ' + (k === i ? 'w-8 bg-phosphor' : 'w-3 bg-phosphor/25')}
          />
        ))}
      </div>
    </HudPanel>
  );
}

export default function LandingPage() {
  const { isSignedIn } = useAuth();
  const [briefing, setBriefing] = useState(false);
  const { scrollYProgress } = useScroll();

  return (
    <main className="relative min-h-screen bg-void">
      <SmoothScroll />
      <motion.div className="scroll-progress w-full" style={{ scaleX: scrollYProgress }} />
      <SiteNav overlay />

      {/* HERO */}
      <section className="relative">
        <HackerRadarHero>
          <div className="font-mono">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="inline-flex items-center gap-3 mb-6 px-3 py-1.5 border border-[#00FF41]/40 bg-black/60 text-[11px] tracking-widest text-[#00FF41]"
            >
              <span className="w-2 h-2 rounded-full bg-[#00FF41] animate-pulse" />
              <span>root@radar:~# ./scan --sources={CATALOG.sources} --mode=live</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.35 }}
              className="glitch text-4xl sm:text-6xl lg:text-[4.75rem] font-black font-display tracking-display leading-[0.95] mb-6 text-white"
              data-text="INITIALIZING PROTOCOL"
            >
              <TerminalText text="INITIALIZING PROTOCOL" typingSpeed={70} className="text-matrix" />
            </motion.h1>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.6 }}
              className="mb-8 max-w-xl border-l-2 border-[#00FF41]/60 pl-4 space-y-1 text-sm sm:text-base text-[#9CA3AF]"
            >
              <p>
                <span className="text-[#00FF41]">&gt;</span> AI job-intelligence engine for your target companies.
              </p>
              <p>
                <span className="text-[#00FF41]">&gt;</span> {CATALOG.sources} live sources · 1024-d embeddings · 6h
                scan loop.
              </p>
              <p>
                <span className="text-[#00FF41]">&gt;</span> Strong matches land in your Vault automatically.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.85 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link
                href={isSignedIn ? '/dashboard' : '/sign-up'}
                className="px-8 py-4 text-sm font-bold tracking-widest text-black bg-[#00FF41] hover:bg-[#33FF66] shadow-[0_0_25px_rgba(0,255,65,0.35)] transition-colors text-center"
              >
                {isSignedIn ? '[ ENTER DASHBOARD ]' : '[ START SCAN ]'}
              </Link>
              <a
                href="#how-it-works"
                className="px-8 py-4 text-sm font-bold tracking-widest text-[#00FF41] border border-[#00FF41]/50 hover:bg-[#00FF41]/10 transition-colors text-center"
              >
                ./how-it-works
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="mt-10 grid grid-cols-3 max-w-md text-[11px] tracking-widest border border-[#00FF41]/20"
            >
              {[
                [String(CATALOG.sources), 'SOURCES'],
                ['1024D', 'VECTORS'],
                ['6H', 'CYCLE'],
              ].map(([v, l]) => (
                <div key={l} className="p-3 border-r last:border-r-0 border-[#00FF41]/20">
                  <div className="text-lg font-black text-[#00FF41]">{v}</div>
                  <div className="text-[#00FF41]/50">{l}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </HackerRadarHero>
      </section>

      <SignalTicker />

      {/* Everything below the hero shares its grid, so the page reads as one console. */}
      <div className="relative overflow-hidden">
        <div className="hud-grid pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(0,255,65,0.07),transparent_65%)]" />

        {/* HOW IT WORKS: the user's side of the loop */}
        <section id="how-it-works" className="relative mx-auto max-w-[1280px] scroll-mt-24 px-4 py-24 sm:px-6 sm:py-32">
          <motion.div {...reveal}>
            <SectionHeader index="01" kicker="HOW_IT_WORKS" title="Two minutes of setup. Then it runs itself.">
              You tell RADAR what you want once. From then on it does the searching, and you only do the applying.
            </SectionHeader>
          </motion.div>
          <div className="mt-14 grid gap-4 lg:grid-cols-3 lg:gap-0">
            {JOURNEY.map((j, i) => (
              <motion.div
                key={j.n}
                {...reveal}
                transition={{ ...reveal.transition, delay: i * 0.12 }}
                className="relative lg:pr-6"
              >
                {i < JOURNEY.length - 1 && (
                  <span className="hud-flow absolute right-0 top-10 hidden h-px w-6 lg:block" aria-hidden="true" />
                )}
                <HudPanel className="h-full" bodyClassName="p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-mono text-5xl font-extrabold text-transparent [-webkit-text-stroke:1px_rgba(0,255,65,0.7)]">
                      {j.n}
                    </span>
                    <span className="border border-hud-amber/40 px-2 py-1 font-mono text-[10px] tracking-[0.25em] text-hud-amber">
                      {j.time}
                    </span>
                  </div>
                  <h3 className="mt-5 font-mono text-xl font-bold text-white">{j.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-dim">{j.body}</p>
                </HudPanel>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CORE MODULES */}
        <section id="modules" className="relative mx-auto max-w-[1280px] scroll-mt-24 px-4 pb-24 sm:px-6 sm:pb-32">
          <motion.div {...reveal}>
            <SectionHeader index="02" kicker="CORE_MODULES" title="Three modules. One loop.">
              Each module runs on its own and hands off to the next. Together they turn thousands of openings into the
              handful worth your time.
            </SectionHeader>
          </motion.div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {MODULES.map((m, i) => (
              <motion.div key={m.code} {...reveal} transition={{ ...reveal.transition, delay: i * 0.1 }}>
                <Link href={`/system#${m.anchor}`} className="group block h-full">
                  <HudPanel
                    label={`MODULE://${m.code} · ${m.name}`}
                    status={m.status}
                    tone={m.tone}
                    className="flex h-full flex-col transition-colors duration-300 group-hover:border-phosphor/60 group-hover:bg-phosphor/[0.03]"
                    bodyClassName="flex flex-1 flex-col p-6"
                  >
                    <span className="font-mono text-5xl font-extrabold text-transparent [-webkit-text-stroke:1px_rgba(0,255,65,0.7)]">
                      {m.code}
                    </span>
                    <h3 className="mt-4 text-xl font-bold text-white">{m.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-dim">{m.desc}</p>
                    <dl className="mt-6 space-y-1.5 border-t border-dashed border-phosphor/15 pt-5 font-mono text-[11px]">
                      {m.spec.map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4">
                          <dt className="text-dim">{k}</dt>
                          <dd className="text-phosphor/90">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <span className="mt-auto pt-6 font-mono text-[11px] tracking-[0.25em] text-phosphor/70 transition-colors group-hover:text-phosphor">
                      $ open /system#{m.anchor}{' '}
                      <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                    </span>
                  </HudPanel>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {/* PREVIEW: a sample match on the real card */}
        <section className="relative mx-auto grid max-w-[1280px] items-center gap-10 px-4 pb-24 sm:px-6 sm:pb-32 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)] lg:gap-14">
          <motion.div {...reveal}>
            <SectionHeader index="03" kicker="PREVIEW" title="Every score explains itself.">
              No black box. Each match shows the number, the reasons behind it and what to do next.
            </SectionHeader>
            <dl className="mt-8 space-y-3 font-mono text-xs">
              {ANATOMY.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[76px_1fr] gap-4">
                  <dt className="font-bold tracking-[0.2em] text-phosphor">{k}</dt>
                  <dd className="text-dim">{v}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
          <motion.div {...reveal} className="relative">
            <span className="absolute -top-3 right-4 z-10 border border-hud-amber/50 bg-black px-2 py-0.5 font-mono text-[10px] tracking-[0.3em] text-hud-amber">
              SAMPLE MATCH
            </span>
            <div inert className="select-none">
              <DiscoveryCard match={SAMPLE} onAction={() => {}} onInfiltrate={() => {}} onHack={() => {}} />
            </div>
            <button
              type="button"
              onClick={() => setBriefing(true)}
              className="mt-4 flex w-full items-center justify-center gap-3 border border-phosphor/40 bg-black/70 py-3 font-mono text-[11px] font-bold tracking-[0.3em] text-phosphor transition-colors hover:bg-phosphor/10"
            >
              <span className="text-phosphor/60">[&gt;_]</span> OPEN THE BRIEFING TERMINAL
            </button>
          </motion.div>
        </section>

        {/* PIPELINE */}
        <section className="relative mx-auto max-w-[1280px] px-4 pb-24 sm:px-6 sm:pb-32">
          <motion.div {...reveal} className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <SectionHeader index="04" kicker="PIPELINE" title="From careers page to your Vault.">
              One run, four stages, fully automatic. Time-boxed runs pick up exactly where the last one stopped.
            </SectionHeader>
            <Link
              href="/architecture"
              className="shrink-0 font-mono text-[11px] tracking-[0.25em] text-phosphor/70 transition-colors hover:text-phosphor"
            >
              $ cat /architecture →
            </Link>
          </motion.div>
          <div className="mt-14 grid gap-4 lg:grid-cols-4 lg:gap-0">
            {STAGES.map((s, i) => (
              <motion.div
                key={s.n}
                {...reveal}
                transition={{ ...reveal.transition, delay: i * 0.12 }}
                className="relative lg:pr-6"
              >
                {i < STAGES.length - 1 && (
                  <span className="hud-flow absolute right-0 top-9 hidden h-px w-6 lg:block" aria-hidden="true" />
                )}
                <HudPanel bodyClassName="p-5">
                  <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.3em]">
                    <span className="text-phosphor">STAGE {s.n}</span>
                    <span className="text-hud-cyan">{s.stat}</span>
                  </div>
                  <p className="mt-4 font-mono text-2xl font-extrabold tracking-[0.15em] text-white">{s.title}</p>
                  <p className="mt-3 text-sm leading-relaxed text-dim">{s.body}</p>
                </HudPanel>
              </motion.div>
            ))}
          </div>
        </section>

        {/* DIFF */}
        <section className="relative mx-auto grid max-w-[1280px] items-center gap-10 px-4 pb-24 sm:px-6 sm:pb-32 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)] lg:gap-14">
          <motion.div {...reveal}>
            <SectionHeader index="05" kicker="DIFF" title="Us vs. everyone else.">
              Job boards show you reposts, days late, ranked by keywords. RADAR reads the source feeds, scores every job
              against your resume and keeps watch on its own.
            </SectionHeader>
            <p className="mt-6 font-mono text-[10px] tracking-[0.2em] text-dim">
              <span className="text-phosphor">[+]</span> yes · <span className="text-hud-amber/80">[~]</span> partly ·{' '}
              <span className="text-hud-red/70">[-]</span> no
            </p>
          </motion.div>
          <motion.div {...reveal}>
            <HudPanel label="$ radar diff --against linkedin,naukri" status="3 TARGETS" bodyClassName="overflow-x-auto">
              <table className="w-full min-w-[520px] font-mono text-sm">
                <thead>
                  <tr className="border-b border-phosphor/15 text-left text-[10px] tracking-[0.3em]">
                    <th className="p-4 font-normal text-dim">CAPABILITY</th>
                    <th className="bg-phosphor/[0.04] p-4 font-bold text-phosphor">RADAR</th>
                    <th className="p-4 font-normal text-dim">LINKEDIN</th>
                    <th className="p-4 font-normal text-dim">NAUKRI</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map(([label, ...marks]) => (
                    <tr
                      key={label}
                      className="border-b border-phosphor/10 transition-colors last:border-b-0 hover:bg-phosphor/[0.03]"
                    >
                      <td className="p-4 text-ink">{label}</td>
                      {marks.map((m, j) => (
                        <td key={j} className={'p-4 font-bold ' + MARK[m].cls + (j === 0 ? ' bg-phosphor/[0.04]' : '')}>
                          {MARK[m].glyph}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </HudPanel>
          </motion.div>
        </section>

        {/* SIGNAL DECK: telemetry beside the rotating transmissions */}
        <section className="relative mx-auto grid max-w-[1280px] gap-6 px-4 pb-24 sm:px-6 sm:pb-32 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
          <div className="grid grid-cols-2 border border-phosphor/20 bg-black/60">
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                {...reveal}
                transition={{ ...reveal.transition, delay: i * 0.08 }}
                className="flex flex-col justify-center border-phosphor/15 p-6 sm:p-8 [&:nth-child(-n+2)]:border-b [&:nth-child(odd)]:border-r"
              >
                <div className="font-mono text-4xl font-extrabold text-phosphor [text-shadow:0_0_18px_rgba(0,255,65,0.35)] sm:text-5xl">
                  <Counter target={s.value} suffix={s.suffix} />
                </div>
                <div className="mt-2 font-mono text-[10px] tracking-[0.3em] text-dim">{s.label}</div>
              </motion.div>
            ))}
          </div>
          <motion.div {...reveal} className="flex">
            <Transmissions />
          </motion.div>
        </section>

        {/* FAQ */}
        <section className="relative mx-auto grid max-w-[1280px] items-start gap-10 px-4 pb-24 sm:px-6 sm:pb-32 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)] lg:gap-14">
          <motion.div {...reveal} className="lg:sticky lg:top-28">
            <SectionHeader index="06" kicker="MAN RADAR" title="Frequently asked.">
              Short answers here. The exact scoring rules, thresholds and data handling live in the protocol spec.
            </SectionHeader>
            <Link
              href="/protocol"
              className="mt-6 inline-block font-mono text-[11px] tracking-[0.25em] text-phosphor/70 transition-colors hover:text-phosphor"
            >
              $ cat /protocol →
            </Link>
          </motion.div>
          <motion.div {...reveal}>
            <HudPanel label="$ radar --help" status={FAQ.length + ' ENTRIES'} tone="idle" bodyClassName="">
              {FAQ.map((f) => (
                <details key={f.q} className="group border-b border-phosphor/10 last:border-b-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 font-mono text-sm text-ink transition-colors hover:bg-phosphor/[0.03] [&::-webkit-details-marker]:hidden">
                    <span>
                      <span className="text-phosphor">&gt; </span>
                      {f.q}
                    </span>
                    <span className="text-phosphor transition-transform duration-200 group-open:rotate-45">+</span>
                  </summary>
                  <p className="px-5 pb-5 pl-9 text-sm leading-relaxed text-dim">{f.a}</p>
                </details>
              ))}
            </HudPanel>
          </motion.div>
        </section>

        {/* CTA */}
        <section className="relative px-4 pb-28 sm:px-6 sm:pb-36">
          <motion.div {...reveal} className="relative mx-auto max-w-[1280px]">
            <HudPanel
              label="SESSION://NEW"
              status="AWAITING INPUT"
              tone="warn"
              bodyClassName="relative overflow-hidden px-6 py-16 text-center sm:px-12 sm:py-24"
            >
              <span
                className="pointer-events-none absolute inset-0 flex select-none items-center justify-center font-mono text-[18vw] font-extrabold leading-none text-phosphor/[0.035] lg:text-[13rem]"
                aria-hidden="true"
              >
                INTERCEPT
              </span>
              <div className="relative">
                <Prompt>./intercept --target=you</Prompt>
                <h2 className="mt-6 font-mono text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
                  INITIATE SYSTEM
                  <br />
                  <span className="text-phosphor [text-shadow:0_0_24px_rgba(0,255,65,0.45)]">OVERRIDE.</span>
                </h2>
                <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-dim sm:text-base">
                  Point RADAR at the companies you want. It keeps watch, so you can spend your time applying.
                </p>
                <Link
                  href={isSignedIn ? '/dashboard' : '/sign-up'}
                  className="mt-10 inline-flex items-center gap-3 bg-phosphor px-10 py-4 font-mono text-sm font-bold tracking-[0.25em] text-black shadow-[0_0_30px_rgba(0,255,65,0.35)] transition-colors hover:bg-[#33FF66]"
                >
                  {isSignedIn ? '[ ENTER DASHBOARD ]' : '[ FIND YOUR DREAM JOB ]'}
                </Link>
                <div className="mt-8 flex justify-center">
                  <StatusLight tone="ok">{CATALOG.tracked + CATALOG.boards.length} FEEDS ONLINE</StatusLight>
                </div>
              </div>
            </HudPanel>
          </motion.div>
        </section>
      </div>

      <SiteFooter />
      <JobTerminal match={briefing ? SAMPLE : null} demo={SAMPLE_DETAIL} onClose={() => setBriefing(false)} />
    </main>
  );
}
