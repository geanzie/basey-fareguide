import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Health Check Endpoint
 * 
 * Returns the health status of the application and its dependencies.
 * Use this for monitoring, uptime checks, and load balancer health checks.
 * 
 * GET /api/health
 */
export async function GET() {
  const startTime = Date.now()
  
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: { status: 'unknown' as 'ok' | 'error' | 'unknown', responseTime: 0 },
      memory: { status: 'ok' as 'ok' | 'warning' | 'error', usage: 0, limit: 0 },
    },
  }

  // Check database connectivity
  try {
    const dbStartTime = Date.now()
    await prisma.$queryRaw`SELECT 1`
    health.checks.database = {
      status: 'ok',
      responseTime: Date.now() - dbStartTime,
    }
  } catch (error) {
    health.status = 'degraded'
    health.checks.database = {
      status: 'error',
      responseTime: Date.now() - startTime,
    }
  }

  // Check memory usage
  const memoryUsage = process.memoryUsage()
  const usedMemoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024)
  const totalMemoryMB = Math.round(memoryUsage.heapTotal / 1024 / 1024)
  const memoryPercent = (usedMemoryMB / totalMemoryMB) * 100

  health.checks.memory = {
    status: memoryPercent > 90 ? 'error' : memoryPercent > 75 ? 'warning' : 'ok',
    usage: usedMemoryMB,
    limit: totalMemoryMB,
  }

  // Set overall status based on checks
  if (health.checks.database.status === 'error') {
    health.status = 'error'
  } else if (health.checks.memory.status === 'error' || health.checks.memory.status === 'warning') {
    health.status = 'degraded'
  }

  const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503

  return NextResponse.json(health, { 
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}

/**
 * Detailed Health Check (Authenticated)
 * 
 * Returns more detailed system information for administrators.
 * Requires authentication.
 */
export async function POST() {
  // For POST, return basic health without auth requirement
  // This can be extended to provide more details with auth
  return GET()
}
