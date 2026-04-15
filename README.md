# Frontend Application

This folder contains the live Basey Fare Check application built with Next.js, React, TypeScript, Tailwind CSS, Prisma, and SWR.

## Core Scripts

```bash
npm install
npm run dev
npm run type-check
npx next build
```

Additional project scripts:

- `npm run build` runs the deployment build: `npm run db:migrate:deploy`, then `next build`
- `npm run build:app` runs `next build` without applying migrations
- `npm run db:migrate:dev -- --name <migration_name>` runs Prisma `migrate dev` only for local databases by default; remote databases require explicit opt-in plus `SHADOW_DATABASE_URL`
- `npm run db:migrate:deploy` applies Prisma migrations using a direct database connection for Neon/Vercel deploys
- `npm run db:generate` refreshes Prisma client code explicitly when schema changes require it
- `npm run test` runs the Vitest suite
- `npm run db:generate` regenerates the Prisma client
- `npm run db:push` pushes the Prisma schema to the configured database
- `npm run deadcode:py` runs the checked-in `ruff` and `vulture` pass for `scripts/*.py`
- `npm run deadcode:ts` runs the checked-in `knip` pass for unused TS/JS files and exports

## Practical Build Note

On Windows inside a OneDrive-synced directory, `prisma generate` can fail when Prisma tries to rename its engine DLL. The deployment path avoids that redundant step during build and relies on install-time generation plus `npm run db:generate` when you explicitly need to refresh the client locally.

For Neon deployments, Prisma migrations should not run through the pooled `DATABASE_URL` host because advisory-lock acquisition can time out during deploys. `npm run db:migrate:deploy` now prefers `DIRECT_DATABASE_URL` when provided and otherwise derives a direct Neon host from the pooled URL before calling `prisma migrate deploy`.

If another deploy is already holding Prisma's advisory lock, the wrapper retries `prisma migrate deploy` automatically. You can tune that behavior with `PRISMA_MIGRATE_DEPLOY_MAX_ATTEMPTS` and `PRISMA_MIGRATE_DEPLOY_RETRY_DELAY_MS`.

`npm run db:migrate:dev` is intentionally stricter: it refuses to run against remote databases unless you explicitly set `PRISMA_MIGRATE_DEV_ALLOW_REMOTE=1` and provide `SHADOW_DATABASE_URL`. Use that only for disposable remote branches. Do not run `migrate dev` against the live/shared Neon schema; use `npm run db:migrate:deploy` there.

## Routing Configuration

Official commuter fare calculation now uses verified road routes only.

- Planner order is OpenRouteService first, Google Routes second.
- If both providers fail, the planner returns `ROUTE_UNVERIFIED` instead of saving an estimated official fare.
- `GOOGLE_ROUTES_API_KEY` is supported as a dedicated server-side key for `routes.googleapis.com`.
- `GOOGLE_MAPS_SERVER_API_KEY` remains valid as the fallback key for server-side Google calls when a dedicated routes key is not supplied.
- Do not apply HTTP referrer restrictions to the server-side Routes key, because the planner calls Google from the Next.js server.
- Optional timeout knobs: `ROUTING_ORS_TIMEOUT_MS` and `ROUTING_GOOGLE_ROUTES_TIMEOUT_MS`.

## Docs In This Folder

- `docs/mobile/` contains the current mobile manual verification checklist and validation log template.
- `docs/email/` contains the email/password-reset setup and testing notes.
- `docs/data/` contains frontend-specific data integration notes.
- `src/data/BASEY_LOCATIONS_USAGE.md` stays next to the location dataset it documents.
- `scripts/LOCATIONS_README.md` stays next to the script workflow it documents.

## Working Notes

The Git repository root is this `frontend/` directory.
