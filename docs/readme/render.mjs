// Renders the README's terminal panels: animated SVGs in the JD terminal's look (pure black, Monokai text,
// deep red/green diff bands, bright word boxes, a typing caret, a radar-sweep status line whose word decrypts
// itself, scanlines).
// GitHub runs SVG animations (SMIL + CSS) inside README images; scripts never run.
//   node docs/readme/render.mjs      → docs/readme/*.svg

import fs from 'node:fs';

const W = 960;
const FS = 15; // font size
const CW = 9; // advance per character; every text run is pinned to it with textLength, whatever the font
const LH = 25; // line height
const TOP = 36; // prompt bar
const NUM_X = 76; // right edge of line numbers
const MARK_X = 88;
const CODE_X = 108;
const SEC_X = 22;
const SEC_TEXT_X = 44;
const SPEED = 0.016; // seconds per character: fast, but you can watch it type
const FONT = "'JetBrains Mono','Cascadia Mono',Consolas,Menlo,'DejaVu Sans Mono',monospace";

const COLOR = {
  plain: '#f8f8f2',
  dim: '#8a8a8a',
  kw: '#f92672',
  decl: '#66d9ef',
  fn: '#a6e22e',
  str: '#e6db74',
  num: '#ae81ff',
  req: '#fd971f',
  bad: '#ff6b6b',
  head: '#66d9ef',
  phos: '#00ff41',
};
// Status-line colours, one per panel in turn (the JD terminal cycles the same five per word).
const HUES = ['#66d9ef', '#f92672', '#ae81ff', '#e6db74', '#a6e22e'];
const NOISE = '01<>/|{}[]#$%&*+=?!^~ABCDEF';
const BAND = { '+': '#003e00', '-': '#500000' };
const BOX = { '+': '#127a12', '-': '#9c1616' };
const NUMC = { '+': '#5fd35f', '-': '#ff6b6b' };

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** A coloured run of text; `box` puts the bright diff box behind it. */
const t = (text, tone = 'plain', box = false) => ({ text, tone, box });
/** A fixed-width column, so values line up like real terminal output. */
const col = (text, width, tone = 'plain') => t(text.padEnd(width), tone);

function runText(x, y, seg, extra = '') {
  const len = [...seg.text].length;
  if (!seg.text.trim()) return '';
  const weight = seg.tone === 'head' ? ' font-weight="700"' : '';
  return `<text x="${x}" y="${y}" fill="${seg.color || COLOR[seg.tone]}"${weight} textLength="${len * CW}" lengthAdjust="spacingAndGlyphs" xml:space="preserve"${extra}>${esc(seg.text)}</text>`;
}

/**
 * One terminal panel.
 * lines: { sec: [runs] } for "⎿" lines, or { mark: '+'|'-'|null, segs: [runs] } for numbered lines.
 */
/** Glyph noise the length of `word`, seeded by it so a re-render gives the same file. */
function noise(word, variant) {
  let seed = [...word].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7 + variant * 101);
  return [...word]
    .map((c) => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return c === ' ' ? ' ' : NOISE[seed % NOISE.length];
    })
    .join('');
}

/**
 * The status line: a radar sweep, then the word, which decrypts itself every few seconds (glyph noise
 * settling left to right), a blinking "_" and the detail after a "│".
 */
function statusLine(name, [word, detail], y, hue) {
  const x = SEC_TEXT_X;
  const w = [...word].length * CW;
  const cycle = 6;
  const k = (0.45 / cycle).toFixed(3);
  const loop = `dur="${cycle}s" begin="0.4s" repeatCount="indefinite"`;
  const clips =
    `<clipPath id="${name}-sw"><rect x="${x}" y="${y - 16}" width="0" height="22"><animate attributeName="width" values="0;${w};${w}" keyTimes="0;${k};1" ${loop}/></rect></clipPath>` +
    `<clipPath id="${name}-sn"><rect x="${x}" y="${y - 16}" width="${w}" height="22"><animate attributeName="x" values="${x};${x + w};${x + w}" keyTimes="0;${k};1" ${loop}/></rect></clipPath>`;
  const flicker = [0, 1, 2]
    .map(
      (j) =>
        `<text x="${x}" y="${y}" fill="${hue}" opacity="0" textLength="${w}" lengthAdjust="spacingAndGlyphs" xml:space="preserve"><animate attributeName="opacity" values="${[0, 1, 2].map((q) => (q === j ? 0.5 : 0)).join(';')}" dur="0.18s" repeatCount="indefinite" calcMode="discrete"/>${esc(noise(word, j))}</text>`,
    )
    .join('');
  const cx = SEC_X + 7;
  const cy = y - 5;
  const sweep =
    `<circle cx="${cx}" cy="${cy}" r="7" fill="none" stroke="${hue}" stroke-opacity="0.5"/>` +
    `<g transform="translate(${cx} ${cy})"><g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1.4s" repeatCount="indefinite"/><path d="M0 0V-7A7 7 0 0 1 7 0Z" fill="${hue}" opacity="0.3"/><path d="M0 0H7" stroke="${hue}" stroke-width="1.5"/></g><circle r="1.3" fill="${hue}"/></g>`;
  const svg =
    sweep +
    `<g clip-path="url(#${name}-sw)" style="filter:drop-shadow(0 0 5px ${hue}88)">${runText(x, y, { text: word, color: hue })}</g>` +
    `<g clip-path="url(#${name}-sn)">${flicker}</g>` +
    `<text x="${x + w}" y="${y}" fill="${hue}"><animate attributeName="opacity" values="1;0" dur="1s" repeatCount="indefinite" calcMode="discrete"/>_</text>` +
    runText(x + w + 2 * CW, y, t('│ ' + detail, 'dim'));
  return { clips, svg };
}

function panel({ name, title, prompt, status, statusTone = 'fn', lines, footer, hue, logo = null, startLine = 1 }) {
  const logoH = logo ? logo.length * 19 + 26 : 0;
  const H = TOP + 14 + logoH + lines.length * LH + 50;
  const out = [];
  const defs = [];
  let clock = 0.35;
  let n = startLine - 1;
  let y = TOP + 14 + logoH + 18;

  lines.forEach((line, i) => {
    const segs = line.sec || line.segs;
    const x0 = line.sec ? SEC_TEXT_X : CODE_X;
    const chars = segs.reduce((k, s) => k + [...s.text].length, 0);
    const end = x0 + chars * CW;
    const dur = Math.max(0.18, chars * SPEED);
    const begin = clock;
    clock += dur + (line.sec ? 0.32 : 0.12);

    // Band first (fades in as the line starts), then everything the typing clip reveals.
    const mark = line.sec ? null : line.mark || null;
    if (mark)
      out.push(
        `<rect x="30" y="${y - 18}" width="${W - 46}" height="${LH}" fill="${BAND[mark]}" opacity="0"><set attributeName="opacity" to="1" begin="${begin.toFixed(2)}s"/></rect>`,
      );
    defs.push(
      `<clipPath id="${name}-c${i}"><rect x="0" y="${y - 19}" width="0" height="${LH + 2}"><animate attributeName="width" values="${line.sec ? SEC_TEXT_X : CODE_X};${end + 12}" begin="${begin.toFixed(2)}s" dur="${dur.toFixed(2)}s" fill="freeze"/></rect></clipPath>`,
    );
    const g = [];
    if (line.sec) g.push(`<text x="${SEC_X}" y="${y}" fill="${COLOR.dim}">⎿</text>`);
    else {
      n += 1;
      g.push(`<text x="${NUM_X}" y="${y}" text-anchor="end" fill="${mark ? NUMC[mark] : '#6e6e6e'}">${n}</text>`);
      if (mark) g.push(`<text x="${MARK_X}" y="${y}" fill="${NUMC[mark]}">${mark === '-' ? '−' : '+'}</text>`);
    }
    let x = x0;
    for (const s of segs) {
      const len = [...s.text].length;
      if (s.box && mark)
        g.push(`<rect x="${x - 1}" y="${y - 16}" width="${len * CW + 2}" height="21" rx="2" fill="${BOX[mark]}"/>`);
      g.push(runText(x, y, s));
      x += len * CW;
    }
    out.push(`<g clip-path="url(#${name}-c${i})">${g.join('')}</g>`);
    // The caret rides the typing edge, then parks after the last line and blinks.
    const last = i === lines.length - 1;
    out.push(
      `<rect x="${x0}" y="${y - 15}" width="${CW}" height="19" fill="#e8e8e8" opacity="0"><set attributeName="opacity" to="1" begin="${begin.toFixed(2)}s"/><animate attributeName="x" from="${x0}" to="${end + 2}" begin="${begin.toFixed(2)}s" dur="${dur.toFixed(2)}s" fill="freeze"/>${
        last
          ? `<animate attributeName="opacity" values="1;0" dur="1s" begin="${(begin + dur).toFixed(2)}s" repeatCount="indefinite" calcMode="discrete"/>`
          : `<set attributeName="opacity" to="0" begin="${(begin + dur).toFixed(2)}s"/>`
      }</rect>`,
    );
    y += LH;
  });

  // Big glitching wordmark (boot panel only).
  const logoSvg = logo
    ? (() => {
        const rows = logo
          .map(
            (row, r) =>
              `<text x="${W / 2}" y="${TOP + 34 + r * 19}" text-anchor="middle" textLength="${[...row].length * 11}" lengthAdjust="spacingAndGlyphs" xml:space="preserve">${esc(row)}</text>`,
          )
          .join('');
        return `<g font-size="18" class="glitch-r" fill="#ff2a6d" opacity="0.55">${rows}</g><g font-size="18" class="glitch-c" fill="#05d9e8" opacity="0.55">${rows}</g><g font-size="18" fill="${COLOR.phos}" class="glow">${rows}</g>`;
      })()
    : '';

  let footerSvg = '';
  if (footer) {
    const { clips, svg } = statusLine(name, footer, H - 18, hue);
    defs.push(clips);
    footerSvg = `<g>${svg}</g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${name}-t">
<title id="${name}-t">${esc(title)}</title>
<style>
  text { font-family: ${FONT}; font-size: ${FS}px; }
  .led { animation: led 1.6s steps(2, jump-none) infinite; }
  .roll { animation: roll 0.18s steps(2) infinite; }
  .glow { filter: drop-shadow(0 0 6px rgba(0,255,65,0.55)); }
  .glitch-r { animation: gr 3.2s steps(1) infinite; }
  .glitch-c { animation: gc 3.2s steps(1) infinite; }
  @keyframes led { 50% { opacity: 0.25; } }
  @keyframes roll { 50% { transform: translateY(1px); } }
  @keyframes gr { 0%,88%,100% { transform: translate(0,0); } 90% { transform: translate(-4px,1px); } 94% { transform: translate(3px,-1px); } }
  @keyframes gc { 0%,88%,100% { transform: translate(0,0); } 91% { transform: translate(4px,-1px); } 95% { transform: translate(-3px,1px); } }
  @media (prefers-reduced-motion: reduce) { .led, .roll, .glitch-r, .glitch-c { animation: none; } }
</style>
<defs>
  <clipPath id="${name}-win"><rect width="${W}" height="${H}" rx="10"/></clipPath>
  <pattern id="${name}-scan" width="6" height="3" patternUnits="userSpaceOnUse"><rect width="6" height="1" fill="#ffffff" opacity="0.035"/></pattern>
  ${defs.join('\n  ')}
</defs>
<g clip-path="url(#${name}-win)">
  <rect width="${W}" height="${H}" fill="#000"/>
  <rect width="${W}" height="${TOP}" fill="#2b2b2b"/>
  ${runText(16, 23, t('> ' + prompt, 'dim'))}
  <text x="${W - 22}" y="23" text-anchor="end" fill="${COLOR[statusTone]}" font-size="13"><tspan class="led">●</tspan> ${esc(status)}</text>
  ${logoSvg}
  ${out.join('\n  ')}
  ${footerSvg}
  <rect width="${W}" height="${H}" fill="url(#${name}-scan)" class="roll"/>
</g>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="none" stroke="#303030"/>
</svg>
`;
}

const LOGO = [
  '██████╗  █████╗ ██████╗  █████╗ ██████╗ ',
  '██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔══██╗',
  '██████╔╝███████║██║  ██║███████║██████╔╝',
  '██╔══██╗██╔══██║██║  ██║██╔══██║██╔══██╗',
  '██║  ██║██║  ██║██████╔╝██║  ██║██║  ██║',
  '╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝',
];

const PANELS = [
  {
    name: '00-boot',
    title: 'RADAR boot sequence',
    prompt: './radar --boot --mission "never apply by hand"',
    status: 'ONLINE',
    logo: LOGO,
    lines: [
      { sec: [t('Booting RADAR '), t('(job-intelligence engine · runs 24/7)', 'dim')] },
      {
        segs: [t('[ OK ] ', 'fn'), t('clerk     '), t('······ ', 'dim'), t('sessions, fresh JWT on every call', 'str')],
      },
      {
        segs: [
          t('[ OK ] ', 'fn'),
          t('supabase  '),
          t('······ ', 'dim'),
          t('postgres · 12 tables · service role only', 'str'),
        ],
      },
      {
        segs: [
          t('[ OK ] ', 'fn'),
          t('pinecone  '),
          t('······ ', 'dim'),
          t('multilingual-e5-large · 1024-d · cosine', 'str'),
        ],
      },
      {
        segs: [t('[ OK ] ', 'fn'), t('crawler   '), t('······ ', 'dim'), t('robots.txt obeyed · 1 req / 1.5s', 'str')],
      },
      {
        segs: [
          t('[ OK ] ', 'fn'),
          t('ai        '),
          t('······ ', 'dim'),
          t('anthropic · gemini · grok (AI_PROVIDER picks)', 'str'),
        ],
      },
      {
        segs: [
          t('[ OK ] ', 'fn'),
          t('sources   '),
          t('······ ', 'dim'),
          t('20', 'num'),
          t(' feeds · ', 'plain'),
          t('11', 'num'),
          t(' ATS + ', 'plain'),
          t('9', 'num'),
          t(' job boards', 'plain'),
        ],
      },
      {
        mark: '+',
        segs: [t('[LIVE] ', 'fn'), t('mission   '), t('······ ', 'dim'), t('"never apply by hand"', 'str', true)],
      },
    ],
    footer: ['Watching the market', '3 crons daily · every 6h via GitHub Actions'],
  },
  {
    name: '01-discover',
    title: 'DISCOVER: StartupMap crawl to ATS boards',
    prompt: 'radar discover --source startupmap.one --polite',
    status: 'DISCOVER',
    statusTone: 'decl',
    lines: [
      { sec: [t('Read robots.txt '), t('(Allow: /  ·  Disallow: /api)', 'dim')] },
      {
        segs: [
          t('GET  ', 'kw'),
          t('/sitemap.xml', 'str'),
          t('                        200  ', 'dim'),
          t('4,671', 'num'),
          t(' startups'),
        ],
      },
      {
        segs: [
          t('GET  ', 'kw'),
          t('/jobs/berlin/engineering', 'str'),
          t('            200  ', 'dim'),
          t('44', 'num'),
          t(' hiring now, queued first'),
        ],
      },
      {
        segs: [
          t('GET  ', 'kw'),
          t('/startup/pleo_dk', 'str'),
          t('                    200  ', 'dim'),
          t('JSON-LD + job links'),
        ],
      },
      {
        mark: '+',
        segs: [t('pleo     '), t('→ '), t('ashby:pleo', 'fn', true), t('                   board found', 'dim')],
      },
      {
        mark: '+',
        segs: [t('helsing  '), t('→ '), t('greenhouse:helsing', 'fn', true), t('           gh_jid verified', 'dim')],
      },
      {
        mark: '+',
        segs: [t('neat     '), t('→ '), t('teamtailor:careers.neat.no', 'fn', true), t('   /jobs.json ok', 'dim')],
      },
      {
        mark: '-',
        segs: [
          t('011h     '),
          t('→ '),
          t('no open roles', 'bad', true),
          t('                recheck in 60 days', 'dim'),
        ],
      },
      {
        mark: '-',
        segs: [
          t('GET  ', 'kw'),
          t('/api/startups', 'bad', true),
          t('   never requested: disallowed by robots.txt', 'dim'),
        ],
      },
      { sec: [t('DONE '), t('(+3 companies tracked · next sync in 48h · pause on 429/403/503)', 'dim')] },
    ],
    footer: ['Crawling politely', 'StartupMap every 48h · your CSV imports on every run'],
  },
  {
    name: '02-ingest',
    title: 'INGEST: jobs through public ATS and job-board APIs',
    prompt: 'radar scrape --least-recent-first --budget 180s --cap 60s',
    status: 'INGEST',
    lines: [
      { sec: [t('Fetching feeds '), t('(4 in parallel · no company may hold the run past 60s)', 'dim')] },
      {
        segs: [t('greenhouse  ', 'decl'), t('boards-api.greenhouse.io/v1/boards/<token>/jobs', 'str'), t('  ✓', 'fn')],
      },
      { segs: [t('ashby       ', 'decl'), t('api.ashbyhq.com/posting-api/job-board/<board>', 'str'), t('   ✓', 'fn')] },
      { segs: [t('lever       ', 'decl'), t('api.lever.co/v0/postings/<site>?mode=json', 'str'), t('       ✓', 'fn')] },
      { segs: [t('teamtailor  ', 'decl'), t('<careers-host>/jobs.json', 'str'), t('                        ✓', 'fn')] },
      {
        segs: [t('boards      ', 'decl'), t('adzuna · jooble · remotive · the muse · jobicy …', 'str'), t(' ✓', 'fn')],
      },
      {
        segs: [
          t('filter      ', 'decl'),
          t('title ∈ engineer | developer | data | ai | ml … ', 'plain'),
          t('(tech only)', 'dim'),
        ],
      },
      {
        mark: '+',
        segs: [
          t('703', 'num', true),
          t(' jobs  → '),
          t('UPSERT', 'kw'),
          t(' jobs '),
          t('ON CONFLICT', 'kw'),
          t(' (company_id, external_id)', 'dim'),
        ],
      },
      {
        mark: '+',
        segs: [
          t('163', 'num', true),
          t(' new/changed  → '),
          t('Pinecone', 'fn'),
          t(' e5-large · sha1 hash skips the rest', 'dim'),
        ],
      },
      {
        mark: '-',
        segs: [
          t('12', 'num', true),
          t(' gone from feed  → '),
          t('is_active = false', 'bad'),
          t(' · vector deleted', 'dim'),
        ],
      },
      { sec: [t('DONE '), t('(142s · 20 companies · slow ones retried next run)', 'dim')] },
    ],
    footer: ['Ingesting', 'least recently scraped first · resumes where it stopped'],
  },
  {
    name: '03-supabase',
    title: 'DATA: what lives in Supabase',
    prompt: 'radar db --map',
    status: 'SUPABASE',
    statusTone: 'fn',
    lines: [
      { sec: [t('Postgres on Supabase '), t('(service-role key stays on the server)', 'dim')] },
      { segs: [t('const', 'decl'), t(' tables '), t('=', 'kw'), t(' {')] },
      { segs: [t('  companies', 'fn'), t(':            '), t('"seeds + discovery → ATS board"', 'str'), t(',')] },
      {
        segs: [
          t('  jobs', 'fn'),
          t(':                 '),
          t('"one row per live posting · hash · verified_at"', 'str'),
          t(','),
        ],
      },
      {
        segs: [
          t('  user_profiles', 'fn'),
          t(':        '),
          t('"resume · skills · roles · cities · bar"', 'str'),
          t(','),
        ],
      },
      {
        mark: '+',
        segs: [
          t('  match_scores', 'fn'),
          t(':         '),
          t('"score · status · stage — the Vault"', 'str', true),
          t(','),
        ],
      },
      { segs: [t('  tailored_resumes', 'fn'), t(':     '), t('"OVERCLOCK CVs · PDF on demand"', 'str'), t(',')] },
      {
        segs: [
          t('  ops_events', 'fn'),
          t(':           '),
          t('"Gmail + RADAR timeline per application"', 'str'),
          t(','),
        ],
      },
      { segs: [t('  discovered_companies', 'fn'), t(': '), t('"startups waiting for their feed"', 'str'), t(',')] },
      {
        segs: [
          t('  pipeline_runs', 'fn'),
          t(':        '),
          t('"every loop, counted"', 'str'),
          t(',  '),
          t('// + 3 more', 'dim'),
        ],
      },
      { segs: [t('};')] },
      { sec: [t('Pinecone '), t('(one vector per open job, keyed by jobs.id)', 'dim')] },
    ],
    footer: ['Syncing state', 'migrations 001 → 007 · each safe to re-run'],
  },
  {
    name: '04-match',
    title: 'MATCH: how every job gets its score',
    prompt: 'radar match --user you --top-k 400',
    status: 'MATCH',
    statusTone: 'num',
    lines: [
      { sec: [t('Embedding your resume '), t('(nearest 400 jobs by cosine, + every dream-company job)', 'dim')] },
      {
        segs: [
          t('score  ', 'fn'),
          t('= '),
          t('0.6', 'num'),
          t(' × meaning + '),
          t('0.4', 'num'),
          t(' × skills', 'plain'),
        ],
      },
      { segs: [t('score ', 'fn'), t('+= '), t('10', 'num'), t('  title contains a target role', 'dim')] },
      {
        segs: [
          t('score ', 'fn'),
          t('±  '),
          t('seniority', 'plain'),
          t(' (−30…+5) · '),
          t('location', 'plain'),
          t(' (−25…+5)', 'dim'),
        ],
      },
      {
        mark: '+',
        segs: [t('AI Engineer        '), t('Northwind AI · Remote   ', 'dim'), t(' 92 ', 'num', true), t('  → Vault')],
      },
      {
        mark: '+',
        segs: [t('Backend Engineer   '), t('Contoso · Bengaluru     ', 'dim'), t(' 86 ', 'num', true), t('  → Vault')],
      },
      {
        segs: [
          t('Data Engineer      '),
          t('Fabrikam · Pune         ', 'dim'),
          t(' 71 ', 'num'),
          t('  → '),
          t('OVERCLOCK', 'req'),
        ],
      },
      {
        mark: '-',
        segs: [
          t('Staff Engineer     '),
          t('Initech · asks ', 'dim'),
          t('5+ years', 'bad', true),
          t('  44 ', 'num'),
          t('  → skip', 'dim'),
        ],
      },
      { sec: [t('DONE '), t('(396 scored · 2 ≥ 80 · 1 near-miss)', 'dim')] },
    ],
    footer: ['Scoring', 'bar 80 by default · 50–79 goes to OVERCLOCK'],
  },
  {
    name: '05-vault',
    title: 'VAULT: nothing enters unverified',
    prompt: 'radar vault --verify --auto',
    status: 'VERIFY',
    statusTone: 'str',
    lines: [
      { sec: [t('Opening apply links '), t('(board jobs · ATS feeds already list only open roles)', 'dim')] },
      {
        mark: '+',
        segs: [
          t('GET  ', 'kw'),
          col('remotive.com/…/ai-engineer', 28, 'str'),
          col('200 "Apply now"', 24, 'dim'),
          t('LIVE', 'fn', true),
          t(' → saved'),
        ],
      },
      {
        mark: '-',
        segs: [
          t('GET  ', 'kw'),
          col('remoteok.com/…/backend-dev', 28, 'str'),
          col('redirected to /', 24, 'dim'),
          t('CLOSED', 'bad', true),
          t(' → out'),
        ],
      },
      {
        mark: '-',
        segs: [
          t('GET  ', 'kw'),
          col('jobicy.com/…/ml-engineer', 28, 'str'),
          col('"no longer accepting"', 24, 'dim'),
          t('CLOSED', 'bad', true),
          t(' → out'),
        ],
      },
      {
        mark: '+',
        segs: [
          t('FEED ', 'kw'),
          col('ashby:northwind', 28, 'str'),
          col('listed at last scrape', 24, 'dim'),
          t('LIVE', 'fn', true),
          t(' → saved'),
        ],
      },
      {
        segs: [
          t('GET  ', 'kw'),
          col('careers.example.io/…', 28, 'str'),
          col('403 (blocked)', 24, 'dim'),
          t('UNKNOWN', 'req'),
          t(' → kept, not closed', 'dim'),
        ],
      },
      { sec: [t('DONE '), t('(+2 saved · −2 closed · the Vault is re-checked every 24h)', 'dim')] },
    ],
    footer: ['Verifying', 'unknown is never treated as closed'],
  },
  {
    name: '06-overclock',
    title: 'OVERCLOCK: honest resume tailoring for near-misses',
    prompt: 'radar overclock --band 50-79 --provider $AI_PROVIDER',
    status: 'OVERCLOCK',
    statusTone: 'req',
    lines: [
      { sec: [t('Tailoring for '), t('Data Engineer · Fabrikam (71%)', 'dim')] },
      {
        segs: [
          col('engine', 11, 'decl'),
          t('gemini:gemini-3.1-pro-preview', 'str'),
          t('   fallback → 3.8-flash, grok, anthropic', 'dim'),
        ],
      },
      { segs: [col('rules', 11, 'decl'), t('only facts already in your resume · nothing invented', 'plain')] },
      {
        mark: '-',
        segs: [
          col('gap', 11, 'decl'),
          t('"Kubernetes in production"', 'bad', true),
          t('   listed as a gap, never faked', 'dim'),
        ],
      },
      {
        mark: '+',
        segs: [col('rewrite', 11, 'decl'), t('led with the data-pipeline project', 'plain'), t(' · 9 edits', 'dim')],
      },
      {
        mark: '+',
        segs: [
          col('project', 11, 'decl'),
          t('71 → 84', 'num', true),
          t('   measured by the same scorer as a scan', 'dim'),
        ],
      },
      {
        mark: '+',
        segs: [
          col('vault', 11, 'decl'),
          t('84 ≥ 80', 'fn', true),
          t(' → moved to the Vault · tailored CV attached', 'plain'),
        ],
      },
      { sec: [t('DONE '), t('(fabrikam-data-engineer.pdf ready · PDF on demand)', 'dim')] },
    ],
    footer: ['Overclocking', 'auto mode: your best 50–79 matches daily, under your cap'],
  },
  {
    name: '07-hack',
    title: 'HACK: one click, the form opens filled; INFILTRATE: step by step',
    prompt: 'radar hack northwind-ai',
    status: 'HACK',
    statusTone: 'kw',
    lines: [
      { sec: [t('↯ HACK://NORTHWIND AI '), t('(AI Engineer · 92% · one click)', 'dim')] },
      {
        segs: [
          t('[1/4] ', 'num'),
          t('FORM     ', 'decl'),
          t('▸ '),
          t('opened in a new tab, your facts filled in 1 s', 'plain'),
          t('  jobs.ashbyhq.com/… ↗', 'str'),
        ],
      },
      {
        segs: [
          t('[2/4] ', 'num'),
          t('ANSWERS  ', 'decl'),
          t('▸ '),
          t('every question · Yes/No · dropdowns · Location', 'plain'),
          t('  humanized', 'fn'),
        ],
      },
      {
        segs: [
          t('[3/4] ', 'num'),
          t('RESUME   ', 'decl'),
          t('▸ '),
          t('tailored PDF attached', 'plain'),
          t('  northwind-ai-engineer.pdf', 'str'),
        ],
      },
      {
        segs: [
          t('[4/4] ', 'num'),
          t('SUBMIT   ', 'decl'),
          t('▸ '),
          t('you press it, the one step RADAR leaves to you', 'req'),
        ],
      },
      {
        mark: '+',
        segs: [
          t('status '),
          t('applied', 'fn', true),
          t(' · stage '),
          t('APPLIED', 'fn', true),
          t(' · CV version stored with it', 'dim'),
        ],
      },
      {
        sec: [
          t('INFILTRATE ▸ '),
          t('(step by step: review every answer first · INFILTRATE ALL walks the Vault)', 'dim'),
        ],
      },
    ],
    footer: ['Hacking the form', 'filled in seconds · submitted by you'],
  },
  {
    name: '08-track',
    title: 'TRACK: Gmail replies move C2 OPS stages',
    prompt: 'radar ops --sync gmail --readonly',
    status: 'TRACK',
    statusTone: 'decl',
    lines: [
      { sec: [t('gmail.readonly '), t('(subject, sender and preview only · token AES-256-GCM)', 'dim')] },
      {
        mark: '+',
        segs: [
          t('"Next steps with Northwind AI"   ', 'str'),
          t('→ interview  ', 'plain'),
          t('APPLIED → INTERVIEW', 'fn', true),
        ],
      },
      {
        mark: '-',
        segs: [
          t('"Update on your application"     ', 'str'),
          t('→ rejection  ', 'plain'),
          t('INTERVIEW → REJECTED', 'bad', true),
        ],
      },
      { segs: [t('"Thanks for applying to Contoso" ', 'str'), t('→ received   ', 'plain'), t('stays APPLIED', 'dim')] },
      {
        mark: '+',
        segs: [
          t('"Your offer from Fabrikam"       ', 'str'),
          t('→ offer      ', 'plain'),
          t('INTERVIEW → OFFER', 'fn', true),
        ],
      },
      { sec: [t('DONE '), t('(3 stages moved · each message processed once)', 'dim')] },
    ],
    footer: ['Reading replies', 'daily autopilot · SYNC NOW any time'],
  },
  {
    name: '09-schedule',
    title: 'SCHEDULE: the three crons',
    prompt: 'radar cron --list',
    status: 'SCHEDULED',
    statusTone: 'fn',
    lines: [
      { sec: [t('vercel.json '), t('+ .github/workflows/radar-cron.yml', 'dim')] },
      { segs: [t('01:30 UTC  ', 'num'), t('/api/cron/discover   ', 'str'), t('StartupMap + imports → ATS boards')] },
      {
        segs: [
          t('02:30 UTC  ', 'num'),
          t('/api/cron            ', 'str'),
          t('scrape → embed → match → verify → Vault'),
        ],
      },
      {
        segs: [
          t('03:30 UTC  ', 'num'),
          t('/api/cron/autopilot  ', 'str'),
          t('Vault re-check · Gmail · auto-OVERCLOCK'),
        ],
      },
      {
        mark: '+',
        segs: [t('every 6h   ', 'num'), t('GitHub Actions       ', 'str'), t('all three, in order', 'fn', true)],
      },
      {
        mark: '-',
        segs: [
          t('no CRON_SECRET', 'bad', true),
          t('  → every scheduled run is refused (401) — set it in Vercel', 'dim'),
        ],
      },
      { sec: [t('/api/health '), t('→ pipeline.stale: false', 'fn')] },
    ],
    footer: ['Looping', 'time-boxed runs · every one resumes where the last stopped'],
  },
];

for (const [i, p] of PANELS.entries()) {
  const file = new URL(`./${p.name}.svg`, import.meta.url);
  fs.writeFileSync(file, panel({ ...p, hue: HUES[i % HUES.length] }));
  console.log('wrote', p.name + '.svg');
}
