# Adding a company or job source

## The easy way: let discovery do it

Paste the company's website (or a CSV with a `Website` column) into **Preferences → CONFIG://10 · TARGETS**.
The next discovery run (`/api/cron/discover`) reads its homepage and careers page, finds the ATS board from the
job links (verifying guessed Greenhouse tokens and Teamtailor feeds), and adds the company. Startups listed on
StartupMap and YC companies that are hiring are found the same way automatically, every 48h.

## A company on a supported ATS, by hand

1. Find the ATS from the careers page. Open it, view source, and search for one of:

   | Look for                                                                | Provider          | `ats_identifier`                                              |
   | ----------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------- |
   | `boards.greenhouse.io/<token>` or `job-boards.greenhouse.io/<token>`    | `greenhouse`      | `<token>`                                                     |
   | `jobs.lever.co/<slug>`                                                  | `lever`           | `<slug>` (`eu:<slug>` for `jobs.eu.lever.co`)                 |
   | `jobs.ashbyhq.com/<name>`                                               | `ashby`           | `<name>`                                                      |
   | `apply.workable.com/<slug>`                                             | `workable`        | `<slug>`                                                      |
   | `jobs.smartrecruiters.com/<Company>`                                    | `smartrecruiters` | `<Company>` (case-sensitive)                                  |
   | `<sub>.recruitee.com`                                                   | `recruitee`       | `<sub>`                                                       |
   | `<sub>.jobs.personio.de`                                                | `personio`        | `<sub>`                                                       |
   | `<sub>.breezy.hr`                                                       | `breezy`          | `<sub>`                                                       |
   | `<sub>.teamtailor.com`, or `/jobs/<id>-<title>` links on a careers site | `teamtailor`      | the careers host, e.g. `careers.neat.no` (check `/jobs.json`) |
   | `<tenant>.wd<N>.myworkdayjobs.com/<site>`                               | `workday`         | `<tenant>/wd<N>/<site>`                                       |

2. Check it returns jobs, e.g. `curl https://boards-api.greenhouse.io/v1/boards/<token>/jobs | head`.
   Also check the jobs belong to the company you meant; different companies can share a name.
3. Add a line to `src/lib/scraper/companies.ts`. The next pipeline run inserts it; existing rows
   are updated by name.

## A new ATS or job board

1. Write `scrapeX()` in `src/lib/scraper/adapters.ts` (company ATS) or `boards.ts` (multi-employer
   board). Return `ScrapedJob[]` built with `finalizeJob()` so skills, seniority and work type are
   derived consistently. Boards must set `employer`.
2. Add the provider to the dispatcher (`scrapeCompany` / `scrapeBoard`), to `Provider` in
   `src/types/index.ts`, and to the `companies_ats_provider_check` constraint in a new migration.
3. Add a test in `adapters.test.ts` / `boards.test.ts` with a trimmed real response.
4. Respect the source's terms: public endpoints only, a few calls per day, link back where required.
