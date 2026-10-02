# Architecture

## Components

| Piece                   | Role                                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js app (`src/app`) | UI pages and API route handlers, deployed on Vercel                                                                                                      |
| Clerk                   | Authentication. API routes call `auth()`; the browser sends a fresh session token on every API call (`src/lib/use-api.ts`)                               |
| Supabase Postgres       | Companies, jobs, user profiles, match scores (the Vault), logs. Accessed server-side with the service-role key                                           |
| Pinecone                | Creates embeddings (`multilingual-e5-large`, 1024-d) and stores one vector per job for similarity search                                                 |
| RADAR · Auto-Fill       | Chrome extension (`extension/`): opens a match's application form filled with the answers from `POST /api/apply/prepare`; marks Submit, never presses it |

## Pipeline

Three routes, each time-boxed and resumable, all behind `Bearer CRON_SECRET`. Vercel Cron calls them daily
(01:30, 02:30, 03:30 UTC); GitHub Actions calls all three every 6 hours.

```
/api/cron/discover                  src/lib/discovery/run.ts
│  StartupMap every 48h: robots.txt → sitemap → /jobs/<city>/engineering (your cities first, cursor)
│  queue (discovered_companies): startup page → job links → ATS board (gh_jid / Teamtailor verified)
│  YC every 48h: yc-oss hiring.json (one static file) → queue, your cities / remote first, then India
│  your imports and YC companies: homepage → careers page → ATS board
└─ new companies → companies table   (then scraped like any other)
```

```
/api/cron  (scrape → match → verified auto-vault)
│
├─ runScrape()                      src/lib/pipeline/scrape.ts
│    ensureCompaniesSeeded()        sync companies table with src/lib/scraper/companies.ts
│    for each company (4 parallel, least-recently-scraped first, time-boxed):
│      scrapeCompany()              src/lib/scraper/adapters.ts → one adapter per ATS/board
│      upsert jobs                  keyed by (company_id, external_id)
│      embed new/changed only       sha1 content_hash; unchanged jobs are not re-embedded
│      close missing jobs           is_active = false when a posting disappears
│
└─ matchAllUsers()                  src/lib/pipeline/match.ts
     for each user with a resume/profile:
       Pinecone top-K by resume vector  (+ every open job at a dream company)
       computeMatchScore()          src/lib/ai/matcher.ts
       upsert match_scores          status is preserved
       score ≥ vault_min_score and status = 'new'
         → gateForVault(): job-board postings get their apply link opened; closed ones are deactivated
         → status = 'saved', auto_saved = true
```

```
/api/cron/autopilot                 daily after the pipeline
├─ reverifyVault()                  src/lib/pipeline/verify.ts   board postings in a Vault, re-checked every 24h
├─ syncAllGmail()                   src/lib/gmail.ts             recruiter replies → ops_events → C2 · OPS stage
└─ autoOverclockAll()               src/lib/overclock.ts         opt-in, daily cap, 50–79% matches → tailored CV
```

A run that hits the time limit stops cleanly; the next run starts with the companies that were skipped.

## Match status lifecycle

```
new ──save/auto-vault──▶ saved ──apply──▶ applied
 │                        │                  │
 └──── dismiss ───────────┴── remove ──▶ dismissed      applied ──back──▶ saved
```

`dismissed` rows are never promoted again, so removing a job from the Vault is permanent.

## Scoring

`score = 0.6 × vector + 0.4 × skills`, then adjustments:

- **vector**: cosine similarity stretched from `[0.72, 0.88]` to `[0, 100]` (`RADAR_SIM_FLOOR` / `RADAR_SIM_CEIL`)
- **skills**: share of the job's listed skills you have, after alias normalization. When the job or the profile lists
  no skills the score is the vector part alone, so a vague non-tech posting cannot outrank a real partial match.
  Profiles without confirmed skills use the skills found in the resume.
- **target role**: +10 when every word of one of your target roles (`user_profiles.current_role`, comma-separated)
  appears in the job title, ignoring seniority words
- **seniority**: −30 for 5+ yr roles below 4 yrs of experience, −15 for 3–5 yr roles below 2, +5 for entry-level roles
- **location**: +5 in one of your cities, +3 remote when you asked for remote, −10 remote otherwise, −25 elsewhere
- **freshness**: +5 for postings from the last 4 days, −5 after 45 days, −10 after 90; no date, no change
- **auto-vault gate**: a role the seniority rule marks down (5+ yrs below 4, 3–5 yrs below 2) never enters the Vault
  by itself, however high it scores

## Resilience

- The Supabase client times out requests after 25 s and retries transient failures: connection failures for every
  method, gateway errors and dropped connections for reads only (a write that may have landed is never repeated).
- Closed postings lose their Pinecone vector, so they cannot crowd the top-K search.
- The Clerk webhook writes identity fields only (a late retry never resets preferences) and deletes the profile on
  `user.deleted`; dream companies and matches cascade.
- `GET /api/health` reports database and vector-index reachability for uptime monitors.

## City-aware companies

`/api/companies?cities=…` merges two signals: companies with open jobs whose location matches the
city (live evidence, with counts) and a hand-checked list of established offices
(`src/lib/geo/city-companies.ts`). Nothing else is shown, so small cities get short, accurate lists.
