# Contributing

## Setup

```bash
nvm use            # Node version from .nvmrc
npm install        # also installs the git pre-commit hook
cp .env.example .env.local
npm run dev
```

## Workflow

- Branch from `main`: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(scraper): add Teamtailor adapter`.
- The pre-commit hook formats and lints staged files. Run `npm run check` before pushing; CI runs the same plus a build.
- Open a PR using the template. Keep PRs focused on one change.

## Code conventions

- TypeScript everywhere; shared domain types in `src/types`.
- Read env vars through `src/lib/env.ts`, never `process.env` directly for secrets.
- Browser → API calls go through `useApi()` so they carry a fresh Clerk token.
- Business logic lives in `src/lib`; route handlers stay thin.
- New scraping or scoring logic needs a test next to it (`*.test.ts`).
- Database changes are new files in `supabase/migrations/`.

## Docs

- [Architecture](docs/architecture.md)
- [Adding a company or source](docs/adding-a-source.md)
- [Database](docs/database.md)
