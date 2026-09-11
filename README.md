# RADAR

Personal AI job radar. RADAR pulls openings from free public job APIs, embeds them with
Pinecone (`multilingual-e5-large`, 1024-d), scores each one against your resume, and drops the
strong matches into your **Vault** automatically every few hours.

**Stack:** Next.js 16 (App Router + route handlers) · Clerk (auth) · Supabase (Postgres) · Pinecone (vectors + embeddings)

## How it works

```
cron (Vercel daily + GitHub Actions every 6h)
  └─ /api/cron
       ├─ scrape   15 sources → normalize → dedupe → upsert jobs → embed new/changed only → close removed postings
       └─ match    per user: vector search + skill overlap + seniority + location → match_scores
                   score ≥ your threshold → Vault (status = saved, auto_saved = true)
```

### Sources

| Kind               | Sources                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Company ATS boards | Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, Personio, Breezy, Workday, Amazon |
| Job boards         | Hacker News "Who is hiring", Remotive, Remote OK, Arbeitnow, Himalayas                            |

Companies and their ATS tokens live in `src/lib/scraper/companies.ts`. Every scraped entry was
verified against its live endpoint; `custom` entries are selectable but not scraped.

### Scoring (`src/lib/ai/matcher.ts`)

`60% vector similarity + 40% skill overlap`, then:

- seniority: −30 for 5+ yr roles when you have < 4 yrs, +5 for entry-level roles
- location: +5 in one of your cities, −10 remote you didn't ask for, −25 elsewhere

## Project layout

```
src/
  app/
    (auth)/            Clerk sign-in / sign-up
    (dashboard)/       dashboard (Discovery · Vault · Applied), onboarding, settings
    api/
      cron/            full pipeline: scrape → match → auto-vault
      scrape/          scrape only
      match/           rescore the signed-in user
      vault/           move matches between new / saved / applied / dismissed
      dashboard/       matches for the dashboard
      companies/       companies really present in given cities
      settings/        read + edit profile and vault preferences
      onboarding/      resume upload + profile creation
      webhook/clerk/   user sync
  components/
    hero/              landing radar console
    providers/         smooth scroll
    ui/                small shared UI
  lib/
    scraper/           adapters (ATS), boards (job boards), company list, helpers
    pipeline/          scrape + match orchestration
    ai/                embeddings (Pinecone) + scoring
    geo/               city aliases + known offices per city
    supabase/          clients
supabase/migrations/   SQL, run in order
```

## Setup

1. `cp .env.example .env.local` and fill in the keys (Supabase → Project Settings → API Keys;
   Pinecone → API Keys).
2. Supabase SQL editor: run `supabase/migrations/001_initial_schema.sql`, `002_update_vector_dimensions.sql`,
   `003_sources_and_vault.sql` in order.
3. Pinecone: index `radar-jobs`, **1024** dimensions, cosine.
4. `npm install && npm run dev`, sign up, finish onboarding.
5. First run of the pipeline (no `CRON_SECRET` needed in dev):

   ```bash
   curl -X POST http://localhost:3000/api/cron
   ```

### Scheduling in production

- Set `CRON_SECRET` in Vercel. `vercel.json` runs `/api/cron` daily.
- For every 6 hours, add repo secrets `RADAR_URL` and `CRON_SECRET`; `.github/workflows/radar-cron.yml` does the rest.

Tuning knobs (search terms, title filter, caps, similarity band) are documented in `.env.example`.

## Scripts

| Command          | What it does                              |
| ---------------- | ----------------------------------------- |
| `npm run dev`    | local dev server                          |
| `npm run check`  | typecheck + lint + tests (CI also builds) |
| `npm test`       | unit tests (Vitest)                       |
| `npm run format` | format everything with Prettier           |
| `npm run build`  | production build                          |

## Docs

- [Architecture](docs/architecture.md): pipeline, match lifecycle, scoring
- [Adding a company or source](docs/adding-a-source.md)
- [Database](docs/database.md)
- [Contributing](CONTRIBUTING.md): setup, workflow, conventions
