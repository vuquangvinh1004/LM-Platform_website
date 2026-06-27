# Learning Management Platform (LMP)

Learning Management Platform (LMP) is a lightweight academic hub for teachers who want to manage courses, classes, materials, classroom visuals, assessments, and results in one place without the overhead of a full LMS.

The project supports two assessment modes:
- `external` for Google Form / Microsoft Form.
- `internal` for the in-app runtime and assessment attempt lifecycle.

## What it covers

- Course management with scoped moderator/admin workflows.
- Class management with student membership and enrollment approval.
- Material library with personal storage, shared library, and download control.
- Classroom visual layout with announcements, direct messages, materials, and simulations.
- Assessment management with import/export, webhook sync, result mirroring, and grading contracts.
- Dashboard and reporting for teacher, moderator, and admin roles.

## Tech Stack

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Zod
- Vitest
- Playwright
- SheetJS (`xlsx`)

## Quick Start

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## Environment Variables

The app expects these values in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `APP_URL`
- `GOOGLE_FORM_WEBHOOK_SECRET`
- `MICROSOFT_FORM_WEBHOOK_SECRET`

## Useful Scripts

- `pnpm dev` - start the local app.
- `pnpm build` - production build.
- `pnpm start` - run the production build.
- `pnpm lint` - run ESLint.
- `pnpm test` - run unit tests.
- `pnpm test:integration` - run integration tests.
- `pnpm test:e2e` - run Playwright E2E tests with local Supabase.
- `pnpm security:scan` - scan tracked files for secret leaks.
- `pnpm ops:export:critical` - export critical operational data.

## Current Status

- Core flows are implemented and build successfully.
- External assessment, import/export, dashboard, classroom visual layout, and library workflows are in place.
- Internal assessment runtime is partially contract-ready and still being hardened in the docs and implementation.
- Performance work is ongoing around batch reads, refresh behavior, and load states.

## Contributing

If you want to help, open an issue or send a pull request for one of these areas:

- bug fixes
- UI/UX polish
- performance tuning
- accessibility
- test coverage
- documentation cleanup

## Docs

The design and implementation notes live in the docs folder. Start with:

1. `README.md`
2. `ARCHITECTURE.md`
3. `ROADMAP.md`
4. `SPEC_FINAL.md`
5. `DATABASE_SCHEMA.md`
6. `SERVICE_CONTRACT.md`
