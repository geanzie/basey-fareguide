import { PrismaPg } from '@prisma/adapter-pg'
import type { PrismaClient as PrismaClientType } from '@prisma/client'
import { Pool } from 'pg'

const requireForPrisma = eval('require') as NodeRequire
const prismaClientModulePath = requireForPrisma.resolve('@prisma/client')

// In dev, schema changes can outpace the cached generated client module.
delete requireForPrisma.cache[prismaClientModulePath]

const { PrismaClient } = requireForPrisma('@prisma/client') as typeof import('@prisma/client')

const PRISMA_SCHEMA_RUNTIME_VERSION = '2026-04-ticket-payments-v3'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientType | undefined
  prismaPool: Pool | undefined
  prismaSchemaRuntimeVersion: string | undefined
}

const shouldReuseClient =
  globalForPrisma.prisma && globalForPrisma.prismaSchemaRuntimeVersion === PRISMA_SCHEMA_RUNTIME_VERSION

const prismaClient: PrismaClientType = shouldReuseClient
  ? globalForPrisma.prisma!
  : (new PrismaClient({
      adapter: createPrismaAdapter(),
    }) as PrismaClientType)

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
    })

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prismaPool = pool
  }

  return new PrismaPg(pool, schema ? { schema } : undefined)
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prismaClient
  globalForPrisma.prismaSchemaRuntimeVersion = PRISMA_SCHEMA_RUNTIME_VERSION
}
