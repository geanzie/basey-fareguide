import { createRequire } from 'node:module'
import path from 'node:path'

import { PrismaPg } from '@prisma/adapter-pg'
import type { PrismaClient as PrismaClientType } from '@prisma/client'
import { Pool } from 'pg'

import { getPgConnectionTimeoutMs } from '@/lib/databaseConfig'

const requireForPrisma = createRequire(import.meta.url)
const prismaClientModulePath = requireForPrisma.resolve('@prisma/client')
const prismaGeneratedClientDirectory = path.join(process.cwd(), 'node_modules', '.prisma', 'client')

// In dev, schema changes can outpace the cached generated client module.
for (const cacheKey of Object.keys(requireForPrisma.cache)) {
  if (cacheKey === prismaClientModulePath || cacheKey.startsWith(prismaGeneratedClientDirectory)) {
    delete requireForPrisma.cache[cacheKey]
  }
}

const { PrismaClient } = requireForPrisma('@prisma/client') as typeof import('@prisma/client')

const globalForPrisma = globalThis as unknown as {
  prismaPool: Pool | undefined
}

const prismaClient: PrismaClientType = new PrismaClient({
  adapter: createPrismaAdapter(),
}) as PrismaClientType

export const prisma: PrismaClientType = prismaClient

function createPrismaAdapter() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured.')
  }

  const parsedDatabaseUrl = new URL(databaseUrl)
  const schema = parsedDatabaseUrl.searchParams.get('schema') || undefined

  if (schema) {
    parsedDatabaseUrl.searchParams.delete('schema')
  }

  const pool =
    globalForPrisma.prismaPool ??
    new Pool({
      connectionString: parsedDatabaseUrl.toString(),
      connectionTimeoutMillis: getPgConnectionTimeoutMs(),
    })

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prismaPool = pool
  }

  return new PrismaPg(pool, schema ? { schema } : undefined)
}
