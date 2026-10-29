# MyArea

A society admin sets up their residential society and invites residents and managers. Members sign in, report neighbourhood problems (a photo, category and human-readable location), and managers review and resolve them. This is a four-day MVP built as an npm Workspaces monorepo: **Next.js** frontend, **Express** backend and **PostgreSQL via Drizzle ORM**.

> **Status:** Phase 2 complete (2026-10-28): PostgreSQL + Drizzle, login/sessions, invite-only membership, society setup and member management (backend API, tested). Next is Phase 3 (society-scoped reports API). The UI ("Courtyard" design, light default + dark toggle) comes in Phase 6. See [`docs/PROGRESS.md`](docs/PROGRESS.md).
> Items marked *(Phase N)* don't exist yet. Everything else was verified on 2026-10-28.

## Stack
| Layer | Choice |
|---|---|
| Monorepo | npm Workspaces (`apps/frontend`, `apps/backend`), no Turborepo, no shared package yet |
| Frontend | Next.js 16 (App Router, Cache Components) · React 19 · TypeScript 5.9 · Tailwind CSS v4 |
| Backend | Express 5 · TypeScript 5.9 (ESM) · Zod 4 · helmet · cors |
| Database | PostgreSQL 17 · Drizzle ORM 0.45 (`drizzle-orm`, `pg`) · `drizzle-kit` 0.31 migrations |
| Auth | Email + password (scrypt), DB sessions in an httpOnly cookie, roles Admin/Manager/Resident, invite-only |
| Media | Report photos on the server's disk (`UPLOAD_DIR`), metadata stripped, served only to the society's members (multer upload) |
| Email | SMTP via nodemailer (console sender for local dev): invites, and a new-report email to the society's managers (admins if none), sent after the response |
| Design | "Courtyard": Bricolage Grotesque + Figtree, brand green `#07ab12` (`#057a0d` for white-text buttons/links), light default + dark toggle |
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
- **PostgreSQL 17** via Homebrew, with two databases:
  ```bash
  brew install postgresql@17 && brew services start postgresql@17
  createdb myarea_dev && createdb myarea_test
  ```
  `myarea_dev` is your working data. `myarea_test` is only for `npm run test:integration`, which empties its tables on every run.
- SMTP credentials for real email (optional locally: `EMAIL_PROVIDER=console` prints invite emails, with their links, to the backend log), backend only.

## Setup
```bash
nvm use                                                   # Node 24
npm install                                               # from repo root; one lockfile for all workspaces
cp apps/backend/.env.example apps/backend/.env            # then set DATABASE_URL / DATABASE_URL_TEST (your macOS user name)
cp apps/frontend/.env.example apps/frontend/.env.local    # API_BASE_URL (server-only)
npm run db:migrate -w backend                             # create the tables in myarea_dev
DATABASE_URL=postgres://$USER@localhost:5432/myarea_test npm run db:migrate -w backend   # and in the test DB
npm run user:create-admin -w backend -- --email you@example.com --name "Your Name"     # asks for a password
npm run db:seed -w backend                                # optional demo data; set SEED_PASSWORD in apps/backend/.env first
npm run dev                                               # backend http://localhost:4000, frontend http://localhost:3000
```
Check it's working: `curl localhost:4000/health` returns `{"status":"ok"}`, and http://localhost:3000 shows the home page.
The backend refuses to start without `DATABASE_URL`. All other variables have local defaults; see `apps/backend/.env.example`.

Open http://localhost:3000 and sign in. A new admin is taken to society setup first. Screens not built yet (members, reports) can be used through the API ([`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)). With `EMAIL_PROVIDER=console`, the invite link appears in the backend log. Reports: `POST /api/reports` (multipart: `title`, `description`, `category`, `locationText` and one `photo`, JPEG/PNG/WebP up to 5 MB), `GET /api/reports`, `GET /api/reports/:id`; photos are served at `GET /api/media/:id` to signed-in members of the report's society. Managers and admins change a report's status (`PATCH /api/reports/:id/status`, with a timeline everyone can see), add a resolution photo, and see counts at `/management`.

For demo data, run `npm run db:seed -w backend`. It adds the society "Green Park Residency" with an admin (`asha.rao@greenpark.example`), a manager (`rohit.sharma@greenpark.example`), two residents (`meera.iyer@…`, `farhan.qureshi@…`) and 10 reports. All four sign in with the `SEED_PASSWORD` from `apps/backend/.env`. Running it again changes nothing.

## Scripts
Run from the repo root.

| Command | What it does |
|---|---|
| `npm run dev` | Backend (`tsx watch`) and frontend (`next dev`) together via `concurrently` |
| `npm run dev:backend` / `npm run dev:frontend` | One app only |
| `npm run check` | **Full gate**: typecheck, lint, test and build across both workspaces |
| `npm run test` / `typecheck` / `lint` / `build` | Each step across both workspaces |
| `npm run <script> -w backend` or `-w frontend` | One workspace: `test`, `test:watch`, `test:coverage`, `typecheck`, `lint`, `build`, `start` |
| `npm run db:generate -w backend -- --name <change>` | Generate a SQL migration from the Drizzle schema (read the SQL before applying) |
| `npm run db:migrate -w backend` | Apply migrations to `DATABASE_URL` |
| `npm run db:check` / `db:studio` `-w backend` | Migration consistency / local DB browser |
| `npm run db:seed -w backend` | Demo society, members and reports; needs `SEED_PASSWORD`; safe to re-run; refuses to run in production |
| `npm run user:create-admin -w backend -- --email <e> --name "<n>"` | Create a society admin, the only way to create one (non-interactive: set `ADMIN_PASSWORD`) |
| `npm run test:integration -w backend` | Repository tests against `DATABASE_URL_TEST` (must be a `*_test` database) |

Production-style run: `npm run build` then `npm run start -w backend` and `npm run start -w frontend`.

## Environment
Each app has its own committed `.env.example` with placeholders: [`apps/backend/.env.example`](apps/backend/.env.example) and [`apps/frontend/.env.example`](apps/frontend/.env.example). Variables for later phases are listed commented out. What each variable does is in [`docs/ARCHITECTURE.md §7`](docs/ARCHITECTURE.md#7-environment-variables).

- Secrets are **backend-only** and live in the git-ignored `apps/backend/.env` (`DATABASE_URL`, `SMTP_USER`, `SMTP_PASS`). Defaults in code are public local-dev values only. The frontend has no `NEXT_PUBLIC_` variables: the browser calls same-origin `/api/*`, which Next.js rewrites to `API_BASE_URL` (server-only, default `http://localhost:4000`). Restart `next dev` after changing it.
- Demo data: `SEED_PASSWORD` (backend `.env` only) is the password for every account `db:seed` creates.
- Photos: `UPLOAD_DIR` (default `uploads`, i.e. `apps/backend/uploads/`, git-ignored). Back it up together with the database: a report's photo exists only there.
- Email: `EMAIL_PROVIDER=console` (default; refused in production) or `smtp` with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, plus `EMAIL_FROM` and `APP_URL` (used in invite links).
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
- Login rate limiting is in memory (per process, resets on restart).
- Resolved and Rejected are final; the reporter isn't emailed when the status changes.
- The theme preference is saved per device, not per account.
- Photos live on one server's disk (no CDN, no multi-server sharing); seeded demo reports have no photo.
- The new-report email is attempted once, after the response is sent. A failure is only logged (no retry, no record in the database); managers still see every report in the app.
