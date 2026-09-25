import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ADMIN_OR_ENFORCER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import type { EnforcerIncidentWatermarkDto } from '@/lib/contracts'

/**
 * The only live poll on the enforcer control center. One indexed read tells
 * the page whether a new incident was reported; the page refetches the full
 * /api/enforcer/operations payload only when the answer changes.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_OR_ENFORCER])

    const latest = await prisma.incident.findFirst({
      select: { id: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })

    const body: EnforcerIncidentWatermarkDto = {
      checkedAt: new Date().toISOString(),
      latestId: latest?.id ?? null,
      latestCreatedAt: latest?.createdAt.toISOString() ?? null,
    }

    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
