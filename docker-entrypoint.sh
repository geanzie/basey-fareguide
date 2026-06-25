#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migration deploy..."
node scripts/prisma-migrate-deploy.js

echo "[entrypoint] Starting Next.js server..."
exec node server.js
