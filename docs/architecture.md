# Architecture

## Components

| Piece                   | Role                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Next.js app (`src/app`) | UI pages and API route handlers, deployed on Vercel                                                                        |
| Clerk                   | Authentication. API routes call `auth()`; the browser sends a fresh session token on every API call (`src/lib/use-api.ts`) |
| Supabase Postgres       | Companies, jobs, user profiles, match scores (the Vault), logs. Accessed server-side with the service-role key             |
| Pinecone                | Creates embeddings (`multilingual-e5-large`, 1024-d) and stores one vector per job for similarity search                   |

## Pipeline

```
/api/cron  (Vercel Cron daily, GitHub Actions every 6h, Bearer CRON_SECRET)
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
       score ≥ vault_min_score and status = 'new'  →  status = 'saved', auto_saved = true
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
- **skills**: share of the job's listed skills you have, after alias normalization
- **seniority**: −30 for 5+ yr roles below 4 yrs of experience, −15 for 3–5 yr roles below 2, +5 for entry-level roles
- **location**: +5 in one of your cities, +3 remote when you asked for remote, −10 remote otherwise, −25 elsewhere

## City-aware companies

`/api/companies?cities=…` merges two signals: companies with open jobs whose location matches the
city (live evidence, with counts) and a hand-checked list of established offices
(`src/lib/geo/city-companies.ts`). Nothing else is shown, so small cities get short, accurate lists.
