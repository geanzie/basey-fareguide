This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/route.ts`. The page auto-updates as you edit the file.

## Development Performance Note

If local `next dev` feels unusually slow on Windows, move this project out of a OneDrive-synced directory before doing deeper tuning. OneDrive file syncing can add noticeable overhead for `.next-dev`, `.next-prod`, `node_modules`, and Prisma engine files, which makes first-hit route compilation and Prisma client startup feel slower than the deployed app.

This project intentionally separates development and production build artifacts:

- `npm run dev` writes to `.next-dev`
- `npm run build` and `npm start` use `.next-prod`

That split prevents the `Cannot find module './<chunk>.js'` runtime error that can happen when `next dev` and production output overwrite each other in the same folder. If you still hit a stale-chunk error after changing branches or interrupting builds, stop the app and remove `.next-dev` and `.next-prod` before restarting.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## API Routes

This directory contains example API routes for the headless API app.

For more details, see [route.js file convention](https://nextjs.org/docs/app/api-reference/file-conventions/route).
