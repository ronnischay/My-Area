# MyArea

MyArea is a neighbourhood issue-reporting app for residential societies. Residents report problems with a photo, and the society's managers track them until they're fixed.

Built with **Next.js** (frontend), **Express** (backend) and **PostgreSQL** with Drizzle ORM, in an npm Workspaces monorepo. See [Architecture.md](Architecture.md) for how the project is put together and [Database.md](Database.md) for the tables and how they connect.

## Features
- **Roles:** an **Admin** creates societies and invites people to them, **Managers** handle a society's reports, and **Residents** report issues.
- **Invite-only sign-in:** people join by an email invite and set their own password. Each person belongs to one society.
- **Societies:** admins create and edit any number of societies and manage each one's members (invite, change role, disable). Managers can invite residents to their own society.
- **Reports:** title, category, location, description and a photo. Photos are resized, turned upright and stripped of location data.
- **AI autofill (optional):** fills in the title, category and description from the photo using Google Gemini.
- **Thumbs-up:** residents back each other's open reports.
- **Management:** a queue with status counts, status changes with notes (Open → In progress → Resolved / Rejected), a timeline everyone can see, and photos showing the fix.
- **Email:** invites, and a new-report email to the society's managers.
- **Responsive, light and dark themes**, and usable with a keyboard.

## Requirements
- **Node.js 24** (`nvm install 24 && nvm use`)
- **PostgreSQL 17**

## Setup
```bash
# 1. Install
nvm use
npm install

# 2. Databases
createdb myarea_dev
createdb myarea_test          # only for the integration tests

# 3. Environment
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local
#    In apps/backend/.env set DATABASE_URL and DATABASE_URL_TEST to your Postgres user.

# 4. Tables
npm run db:migrate -w backend

# 5. Start
npm run dev                   # frontend http://localhost:3000, backend http://localhost:4000
```

## Admin account
Create the admin, then enter `@dmin@1234` when it asks for the password (passwords need at least 10 characters):
```bash
npm run user:create-admin -w backend -- --email admin@myarea.local --name "Admin"
```
Sign in at http://localhost:3000 with `admin@myarea.local` / `@dmin@1234`. You land on **Societies**: create a society, then invite its managers and residents. Change this password before using the app anywhere other than your own machine.

## Demo data (optional)
Set `SEED_PASSWORD` in `apps/backend/.env` (at least 10 characters), then run:
```bash
npm run db:seed -w backend
```
This adds an admin (`asha.rao@greenpark.example`) and a society, "Green Park Residency", with a manager (`rohit.sharma@greenpark.example`), two residents (`meera.iyer@greenpark.example`, `farhan.qureshi@greenpark.example`) and 10 reports. All of them sign in with `SEED_PASSWORD`. Running it again changes nothing.

## Configuration
All settings are in `apps/backend/.env`; `apps/backend/.env.example` lists each one.

| Setting | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection (required) |
| `EMAIL_PROVIDER` | `console` (default): emails, including invite links, are printed in the backend log. `smtp`: real email, with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` |
| `EMAIL_FROM`, `APP_URL` | Sender address, and the site address used in email links |
| `UPLOAD_DIR` | Where photos are stored (default `apps/backend/uploads`) |
| `GEMINI_API_KEY` | Turns on AI autofill (optional) |

Secrets stay in the backend `.env`, which git ignores. The frontend needs only `API_BASE_URL` (default `http://localhost:4000`).

## Commands
Run these from the repo root.

| Command | What it does |
|---|---|
| `npm run dev` | Start the frontend and backend |
| `npm run check` | Typecheck, lint, test and build everything |
| `npm run test` | Unit and API tests |
| `npm run test:integration -w backend` | Database tests (uses `myarea_test`) |
| `npm run db:migrate -w backend` | Apply database migrations |
| `npm run db:seed -w backend` | Add demo data |
| `npm run user:create-admin -w backend -- --email <email> --name "<name>"` | Create an admin |
| `npm run build`, then `npm run start -w backend` and `npm run start -w frontend` | Production build and run |
