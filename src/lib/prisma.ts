import { PrismaClient } from '@/generated/prisma'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_Dkhqz6sVt7Wf@ep-fragrant-cake-a1l57i7a-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
    }
  }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma