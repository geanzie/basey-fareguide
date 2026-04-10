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

- `npm run build` runs `prisma generate` and then `next build`
- `npm run test` runs the Vitest suite
- `npm run db:generate` regenerates the Prisma client
- `npm run db:push` pushes the Prisma schema to the configured database
- `npm run deadcode:py` runs the checked-in `ruff` and `vulture` pass for `scripts/*.py`
- `npm run deadcode:ts` runs the checked-in `knip` pass for unused TS/JS files and exports

## Practical Build Note

On Windows inside a OneDrive-synced directory, `npm run build` can fail during `prisma generate` because Prisma cannot reliably rename its engine DLL. When validating the app itself, prefer `npx next build` as the cleaner signal for frontend build health.

## Docs In This Folder

- `docs/mobile/` contains the current mobile manual verification checklist and validation log template.
- `docs/email/` contains the email/password-reset setup and testing notes.
- `docs/data/` contains frontend-specific data integration notes.
- `src/data/BASEY_LOCATIONS_USAGE.md` stays next to the location dataset it documents.
- `scripts/LOCATIONS_README.md` stays next to the script workflow it documents.

## Working Notes

The Git repository root is this `frontend/` directory.
