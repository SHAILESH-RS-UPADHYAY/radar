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

`60% vector similarity + 40% skill overlap` (similarity alone when the job or the profile lists no skills), then:

- target role: +10 when the job title contains one of your target roles
- seniority: −30 for 5+ yr roles when you have < 4 yrs, −15 for 3–5 yr roles below 2, +5 for entry-level roles
- location: +5 in one of your cities, +3 remote you asked for, −10 other remote, −25 elsewhere

Until you confirm skills in Preferences, the skills found in your resume are used. The full spec is rendered at `/protocol`.

## Project layout

```
src/
  proxy.ts             Clerk session gate for /dashboard, /onboarding, /settings (Next 16 "proxy")
  app/
    page.tsx           landing page
    (site)/            public docs: /system, /protocol, /architecture, /privacy, /terms
    (auth)/            Clerk sign-in / sign-up
    (dashboard)/       dashboard (Discovery · Vault · Battlefield), onboarding, settings
    api/
      cron/            full pipeline: scrape → match → auto-vault
      scrape/          scrape only
      match/           rescore the signed-in user (15 s cooldown)
      vault/           move matches between new / saved / applied / dismissed
      dashboard/       matches for the dashboard
      companies/       companies really present in given cities
      settings/        read + edit profile; settings/resume replaces the resume
      onboarding/      resume upload + profile creation
      webhook/clerk/   user sync (created / updated / deleted)
      health/          uptime check: database + vector index
    not-found.tsx, error.tsx, global-error.tsx, robots.ts, sitemap.ts, icon.svg
  components/
    brand/             animated RADAR logo
    hud/               HUD primitives (panels, status lights, toast, status screens)
    site/              public-site nav, footer, doc layout
    dashboard/         job cards and helpers
    hero/              landing radar console
  lib/
    scraper/           adapters (ATS), boards (job boards), company list, catalog, helpers
    pipeline/          scrape + match orchestration
    ai/                embeddings (Pinecone) + scoring
    geo/               city aliases + known offices per city
    supabase/          server client with timeouts and safe retries
    validate.ts        input rules shared by API routes and pages
supabase/migrations/   SQL, run in order
```

## Setup

1. `cp .env.example .env.local` and fill in the keys (Supabase → Project Settings → API Keys;
   Pinecone → API Keys).
2. Supabase SQL editor: run every file in `supabase/migrations/` in order (`001` → `004`). Each is safe to re-run.
3. Pinecone: index `radar-jobs`, **1024** dimensions, cosine.
4. Clerk → Webhooks: endpoint `https://<your-domain>/api/webhook/clerk` with `user.created`, `user.updated` and
   `user.deleted`; put its signing secret in `CLERK_WEBHOOK_SIGNING_SECRET`. Deleting an account then removes the
   user's resume, preferences and matches.
5. `npm install && npm run dev`, sign up, finish onboarding.
6. First run of the pipeline (no `CRON_SECRET` needed in dev when it is empty):

   ```bash
   curl -X POST http://localhost:3000/api/cron
   ```

### Scheduling and monitoring in production

- Set `CRON_SECRET` in Vercel. `vercel.json` runs `/api/cron` daily.
- For every 6 hours, add repo secrets `RADAR_URL` and `CRON_SECRET`; `.github/workflows/radar-cron.yml` does the rest.
- Point an uptime monitor at `GET /api/health`: 200 when the database and the vector index answer, 503 otherwise.

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
