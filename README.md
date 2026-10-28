# MyArea

A society admin sets up their residential society and invites residents and managers. Members sign in, report neighbourhood problems (a photo, category and human-readable location), and managers review and resolve them. This is a four-day MVP built as an npm Workspaces monorepo: **Next.js** frontend, **Express** backend and **PostgreSQL via Drizzle ORM**.

> **Status:** Phase 1 complete (2026-10-28): both apps are scaffolded, with tooling, tests, the UI foundation and `GET /health`. Scope updated on 2026-10-28: societies, roles and invite-only login (D014), plus the "Courtyard" design with a light default and a dark-mode toggle (D018/D019). Next is Phase 2 (database + auth, societies and members API), which needs schema approval first. See [`docs/PROGRESS.md`](docs/PROGRESS.md).
> Items marked *(Phase N)* don't exist yet. Everything else was verified on 2026-10-28.

## Stack
| Layer | Choice |
|---|---|
| Monorepo | npm Workspaces (`apps/frontend`, `apps/backend`), no Turborepo, no shared package yet |
| Frontend | Next.js 16 (App Router, Cache Components) · React 19 · TypeScript 5.9 · Tailwind CSS v4 |
| Backend | Express 5 · TypeScript 5.9 (ESM) · Zod 4 · helmet · cors |
| Database | PostgreSQL 17 · Drizzle ORM (`drizzle-orm`, `pg`) · `drizzle-kit` migrations *(Phase 2)* |
| Auth | Email + password, DB sessions in an httpOnly cookie, roles Admin/Manager/Resident, invite-only *(Phase 2)* |
| Media | Cloudinary (backend-only adapter) *(Phase 4)* |
| Email | Resend **or** SMTP: invites *(Phase 2)*, new-report email to one shared inbox *(Phase 5)* |
| Design | "Courtyard": Bricolage Grotesque + Figtree, light default + dark toggle *(Phase 6)* |
| Tests | Vitest 5 · React Testing Library · Supertest |

## Repository layout
```text
apps/frontend/   Next.js app   → src/app, src/components/{ui,layout}, src/lib, src/types
apps/backend/    Express API   → src/app.ts, src/server.ts, src/config, src/middleware, src/modules/<feature>, src/lib
docs/            Product, architecture, DB, API, UI/UX, feature docs, plan, progress
```
Details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Prerequisites
- **Node.js 24** (pinned in `.nvmrc`): `nvm install 24 && nvm use`. npm 11 ships with it.
- **PostgreSQL 17** via Homebrew *(needed from Phase 2)*:
  ```bash
  brew install postgresql@17 && brew services start postgresql@17
  createdb myarea_dev && createdb myarea_test
  ```
- Email provider credentials *(Phase 2; locally `EMAIL_PROVIDER=console` prints invite links instead)* and a Cloudinary account *(Phase 4)*, backend only.

## Setup
```bash
nvm use                                                   # Node 24
npm install                                               # from repo root; one lockfile for all workspaces
cp apps/backend/.env.example apps/backend/.env            # backend config (secrets live only here)
cp apps/frontend/.env.example apps/frontend/.env.local    # NEXT_PUBLIC_API_BASE_URL
npm run dev                                               # backend http://localhost:4000, frontend http://localhost:3000
```
Check it's working: `curl localhost:4000/health` returns `{"status":"ok"}`, and http://localhost:3000 shows the home page.
Both `.env` files are optional for Phase 1, because the defaults match the commands above.

*(Phase 2)* `npm run db:migrate -w backend`, then create the first admin with `npm run user:create-admin -w backend -- --email you@example.com --name "Your Name"` (you'll be asked for a password). Sign in, create your society, and invite members. *(Phase 3)* `npm run db:seed -w backend` adds a demo society with users and reports.

## Scripts
Run from the repo root.

| Command | What it does |
|---|---|
| `npm run dev` | Backend (`tsx watch`) and frontend (`next dev`) together via `concurrently` |
| `npm run dev:backend` / `npm run dev:frontend` | One app only |
| `npm run check` | **Full gate**: typecheck, lint, test and build across both workspaces |
| `npm run test` / `typecheck` / `lint` / `build` | Each step across both workspaces |
| `npm run <script> -w backend` or `-w frontend` | One workspace: `test`, `test:watch`, `test:coverage`, `typecheck`, `lint`, `build`, `start` |
| *(Phase 2)* `npm run db:generate -w backend -- --name <change>` | Generate a SQL migration from the Drizzle schema |
| *(Phase 2)* `npm run db:migrate -w backend` | Apply migrations to `DATABASE_URL` |
| *(Phase 2)* `npm run db:check` / `db:studio` / `db:seed` `-w backend` | Migration consistency / local DB browser / demo data |
| *(Phase 2)* `npm run user:create-admin -w backend -- --email <e> --name "<n>"` | Create a society admin (the only way to create one) |
| *(Phase 2)* `npm run test:integration -w backend` | Repository tests against `DATABASE_URL_TEST` |

Production-style run: `npm run build` then `npm run start -w backend` and `npm run start -w frontend`.

## Environment
Each app has its own committed `.env.example` with placeholders: [`apps/backend/.env.example`](apps/backend/.env.example) and [`apps/frontend/.env.example`](apps/frontend/.env.example). Variables for later phases are listed commented out. What each variable does is in [`docs/ARCHITECTURE.md §7`](docs/ARCHITECTURE.md#7-environment-variables).

- Secrets are **backend-only**. The frontend reads only `NEXT_PUBLIC_API_BASE_URL`, which is public and inlined at build time.
- The backend validates its environment at startup and exits with a list of the invalid variables (names only, never values).

## Documentation
| Doc | Purpose |
|---|---|
| [`AGENT_START_HERE.md`](AGENT_START_HERE.md) | Master prompt and work protocol for coding agents |
| [`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md) | Scope, users, acceptance criteria |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Stack, structure, layering, data flow, env |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Tables, enums, relations, migration workflow and log |
| [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) | Endpoints, payloads, error codes |
| [`docs/UI_UX_GUIDELINES.md`](docs/UI_UX_GUIDELINES.md) | Design tokens, responsive and a11y rules, screen specs |
| [`docs/features/`](docs/features/README.md) | How each feature is built: tables, migrations, files, tests |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | Phased plan with gates |
| [`docs/TESTING_STRATEGY.md`](docs/TESTING_STRATEGY.md) | Test levels and cases |
| [`docs/DEFINITION_OF_DONE.md`](docs/DEFINITION_OF_DONE.md) | Quality gates |
| [`docs/DOCS_MAINTENANCE.md`](docs/DOCS_MAINTENANCE.md) | Which docs to update for each change |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Decision log |
| [`docs/PROGRESS.md`](docs/PROGRESS.md) | Phase checklist and verified results |

**Keep docs current:** any change to features, schema, endpoints, setup or env updates the matching docs in the same change. See [`docs/DOCS_MAINTENANCE.md`](docs/DOCS_MAINTENANCE.md).

## Known limitations (MVP)
- No map, geocoding or coordinates. Location is free text.
- One society per admin and per user; members join by invite only; no forgot/change-password yet (see `docs/features/auth.md`).
- The theme preference is saved per device, not per account.
- Email is attempted once after save. Failures are recorded for manual retry, and there is no background worker.
