# Coding Agent — Start Here

Implement **MyArea**, a four-day neighbourhood issue-reporting MVP using a **Next.js frontend + Express backend + PostgreSQL via Drizzle ORM**. Inspect first, make small changes, test each phase, and **keep the docs current as you go**.

## Read these first (in order)
1. `docs/PRODUCT_REQUIREMENTS.md`: what to build and the acceptance criteria
2. `docs/ARCHITECTURE.md`: stack, directory structure, layering rules, data flow, env vars
3. `docs/DATABASE.md`: tables, enums, relations, migration workflow and log
4. `docs/API_CONTRACT.md`: every endpoint and the error envelope
5. `docs/UI_UX_GUIDELINES.md`: design tokens, responsive and accessibility rules, screen specs
6. `docs/features/`: per-feature build docs (tables, migrations, files, tests)
7. `docs/IMPLEMENTATION_PLAN.md`, `docs/TESTING_STRATEGY.md`, `docs/DEFINITION_OF_DONE.md`
8. `docs/DOCS_MAINTENANCE.md`: which docs to update for each kind of change
9. `docs/DECISIONS.md` and `docs/PROGRESS.md`

## First task: inspect only
1. Inspect the repo tree, root `package.json`, lockfile, `.gitignore`, workspace config, app manifests and existing tests.
2. Identify what exists. Do not overwrite a working setup or regenerate the app without a reason.
3. Check Node/npm versions and workspace names.
4. Read all the docs above.
5. Report the current state, blockers, minimal changes and the commands you plan to run.
6. Stop. Do not implement the MVP in one pass.

## Product objective
A society **admin** (created by CLI) sets up their residential society and invites **residents** and **managers** by email. Everyone signs in. Residents submit a neighbourhood issue with a title, description, category, human-readable location and a photo. The report is saved in PostgreSQL, scoped to their society. After it is saved, one shared issue-management inbox gets an email. Managers review their society's reports, update status and may upload resolution evidence. The UI uses the "Courtyard" design with a light default theme and a dark-mode toggle. AI suggestions and community voting are stretch goals.

## Fixed decisions (see `docs/DECISIONS.md`)
- Monorepo: npm Workspaces (`apps/frontend`, `apps/backend`), no Turborepo, **no shared `packages/` workspace yet**. `docs/API_CONTRACT.md` is the contract and the frontend mirrors types in `src/types/api.ts`.
- Frontend: Next.js 16 + TypeScript (strict), App Router with Cache Components, Tailwind CSS v4, hand-written `components/ui/` primitives. **Read `apps/frontend/AGENTS.md` and the bundled docs in `node_modules/next/dist/docs/` before writing Next.js code**, because its APIs differ from older versions.
- Backend: Express + TypeScript (strict), feature modules (`routes → controller → service → repository`). Do not use NestJS.
- Database: PostgreSQL + **Drizzle ORM** (`drizzle-orm` + `pg`, `drizzle-kit` for migrations). **Not Prisma.**
- Media: Cloudinary behind a backend-only `MediaStorage` adapter.
- Email: one recipient (`ISSUE_MANAGEMENT_EMAIL`), one provider (Resend OR Nodemailer/SMTP) behind `EmailSender`. Never invent credentials.
- Tests: Vitest for both apps; React Testing Library for UI; Supertest for Express; a dedicated test DB for repository integration tests.
- No map or map SDK.
- Never expose database, Cloudinary, AI or email secrets via `NEXT_PUBLIC_` variables.
- No live email, media or AI provider calls in tests. Mock the provider interfaces.
- Auth (D014): email + password, DB sessions in an httpOnly cookie, roles `ADMIN`/`MANAGER`/`RESIDENT`, invite-only membership, one society per user. **Every report/member query is scoped to the session's `society_id`; never trust a society id from the client.** Auth comes first (Phase 2).
- Responsive (mobile-first) and accessible (WCAG 2.2 AA) UI is a requirement, not polish, in **both light (default) and dark themes** (D018 Courtyard, D019).

## Database rules (Drizzle)
- Schema lives in `apps/backend/src/db/schema/*.ts`. Migrations are generated into `apps/backend/drizzle/` and committed.
- Workflow: propose in the feature doc → **approval** → edit schema → `npm run db:generate -w backend -- --name <change>` → **read the SQL** → `npm run db:migrate -w backend` → update `docs/DATABASE.md` (table status + **migration log row**) and the feature doc's "Migrations" section.
- Never `drizzle-kit push` to a shared DB. Never edit applied migrations; fix forward.
- Only `*.repository.ts` and `src/db/` import Drizzle.

## Documentation rules (mandatory, see `docs/DOCS_MAINTENANCE.md`)
Every change updates its docs **in the same change**:
- **Feature work** → `docs/features/<feature>.md` (create it from `_TEMPLATE.md` before coding): flow, API, tables, linked migrations, files, UI states, tests, limitations, changelog.
- **Schema** → `docs/DATABASE.md` + migration log + feature doc.
- **Endpoint** → `docs/API_CONTRACT.md` + frontend `src/types/api.ts`.
- **Setup, scripts, env or dependencies** → `README.md` + the app's `.env.example` (`apps/backend/` or `apps/frontend/`).
- **Structure** → `docs/ARCHITECTURE.md`. **Decisions** → `docs/DECISIONS.md`. **Progress** → `docs/PROGRESS.md`.

## Work protocol
For each phase in `docs/IMPLEMENTATION_PLAN.md`:
1. State the goal and the expected files.
2. Implement only that phase.
3. Add or update tests.
4. Run the relevant tests, lint, typecheck and build scripts.
5. Report exact commands and actual results. Fix failures rather than hiding them.
6. Update the docs (checklist in `docs/DOCS_MAINTENANCE.md §6`).
7. Stop for approval before **schema, package-management, auth-boundary or architecture** changes.

## Package rules
- Use Node 24 (`nvm use`, see `.nvmrc`).
- Use root npm Workspaces and one root `package-lock.json`.
- Confirm workspace names before `npm install ... -w`.
- Install from the repo root and keep dependencies in the owning workspace.
- Avoid `--force` and `--legacy-peer-deps`.
- Use native `fetch`, not Axios.
- Keep `drizzle-orm` and `drizzle-kit` versions compatible with each other.
- Don't keep Prisma/NestJS packages or scripts if they exist. Explain any removals.

## Phase report
Summarise: files changed, dependencies and reasons, migrations (file + log row), commands and results, tests, docs updated, security limitations, next phase.

Start with **repository inspection only**.
