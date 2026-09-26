# Database

Postgres on Supabase. Migrations live in `supabase/migrations/` and are applied in order in the
Supabase SQL editor. Never edit an applied migration; add a new numbered file.

| Table                  | Key columns                                                                                                                                                        | Notes                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `companies`            | `name`, `ats_provider`, `ats_identifier`, `category`, `last_scraped_at`                                                                                            | Synced from `src/lib/scraper/companies.ts`. `custom` = not scraped                                     |
| `jobs`                 | `(company_id, external_id)` unique, `title`, `description`, `location`, `skills[]`, `employer`, `posted_at`, `content_hash`, `is_active`                           | `employer` is set for job-board sources. Vector lives in Pinecone under the job `id`                   |
| `user_profiles`        | `id` (Clerk user id), `skills[]`, `location`, `is_fresher`, `experience_years`, `resume_text`, `resume_embedding`, `current_role`, `vault_min_score`, `auto_vault` | `location`: comma-separated cities, may contain `Remote`; `current_role`: comma-separated target roles |
| `user_dream_companies` | `(user_id, company_id)`                                                                                                                                            |                                                                                                        |
| `match_scores`         | `(user_id, job_id)` unique, `score`, `reasoning`, `section`, `status`, `auto_saved`                                                                                | The Vault. `status`: `new` / `saved` / `applied` / `dismissed`                                         |
| `scrape_logs`          | `company_id`, `status`, `jobs_found`, `error_message`                                                                                                              | One row per company per run                                                                            |
| `pipeline_runs`        | counts per run, `notes` (failures)                                                                                                                                 | One row per `/api/cron` call                                                                           |

All server code uses the service-role client (`src/lib/supabase/client.ts`), so row-level security
policies only matter if the browser ever queries Supabase directly.
