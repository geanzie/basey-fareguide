# ============================================================
# Stage 1: Install dependencies (production only)
# ============================================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install libc for native modules (sharp, etc.)
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev
RUN npx prisma generate

# ============================================================
# Stage 2: Build the Next.js application
# ============================================================
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Full install including devDependencies needed for build
RUN npm ci

COPY . .

# Generate Prisma client (full deps available here)
RUN npx prisma generate

# Build Next.js standalone output.
# Use build:app (= next build) not build:deploy — migrations run at runtime.
RUN npm run build:app

# ============================================================
# Stage 3: Production runner image
# ============================================================
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma runtime artifacts needed by the app and migration script
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Prisma CLI needed for prisma-migrate-deploy.js
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
# pg driver needed by @prisma/adapter-pg at runtime
COPY --from=builder /app/node_modules/pg ./node_modules/pg
COPY --from=builder /app/node_modules/pg-pool ./node_modules/pg-pool
COPY --from=builder /app/node_modules/pg-protocol ./node_modules/pg-protocol
COPY --from=builder /app/node_modules/pg-types ./node_modules/pg-types
COPY --from=builder /app/node_modules/pgpass ./node_modules/pgpass
# AWS SDK for MinIO/S3 evidence storage
COPY --from=builder /app/node_modules/@aws-sdk ./node_modules/@aws-sdk
COPY --from=builder /app/node_modules/@smithy ./node_modules/@smithy

# Prisma schema and migrations for prisma migrate deploy at startup
COPY --from=builder /app/prisma ./prisma/

# Migration script run by docker-entrypoint.sh
COPY --from=builder /app/scripts/prisma-migrate-deploy.js ./scripts/prisma-migrate-deploy.js

# Entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Transfer ownership to non-root user
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
