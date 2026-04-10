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

- `npm run build` runs the deployment build: `prisma migrate deploy`, then `next build`
- `npm run build:app` runs `next build` without applying migrations
- `npm run db:generate` refreshes Prisma client code explicitly when schema changes require it
- `npm run test` runs the Vitest suite
- `npm run db:generate` regenerates the Prisma client
- `npm run db:push` pushes the Prisma schema to the configured database
- `npm run deadcode:py` runs the checked-in `ruff` and `vulture` pass for `scripts/*.py`
- `npm run deadcode:ts` runs the checked-in `knip` pass for unused TS/JS files and exports

## Practical Build Note

On Windows inside a OneDrive-synced directory, `prisma generate` can fail when Prisma tries to rename its engine DLL. The deployment path avoids that redundant step during build and relies on install-time generation plus `npm run db:generate` when you explicitly need to refresh the client locally.

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
