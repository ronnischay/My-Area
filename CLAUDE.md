# CLAUDE.md

Read [`AGENT_START_HERE.md`](AGENT_START_HERE.md) before doing anything. It is the work protocol for this repo.

Non-negotiables (details in the linked docs):
- Next.js frontend + Express backend in npm Workspaces. **Drizzle ORM** (not Prisma). No shared package yet.
- One phase at a time (`docs/IMPLEMENTATION_PLAN.md`). Stop for approval before schema, package, auth or architecture changes.
- Every migration is generated, its SQL reviewed, then logged in `docs/DATABASE.md` and linked from its `docs/features/*.md`.
- Every change updates its docs in the same change (`docs/DOCS_MAINTENANCE.md`), including `README.md` when setup, scripts or env change.
- UI must follow `docs/UI_UX_GUIDELINES.md`: mobile-first, responsive, WCAG 2.2 AA.
- Never put secrets in `NEXT_PUBLIC_*`. Never call live providers in tests.
- Node 24 (`nvm use`). Next.js 16 differs from older versions: read `apps/frontend/AGENTS.md` / `node_modules/next/dist/docs/` before writing frontend code.
- Gate before reporting: `npm run check` from the repo root (typecheck, lint, test, build in both workspaces).
