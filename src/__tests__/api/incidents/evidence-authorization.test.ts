import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestUser: vi.fn(),
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status =
      message === 'Unauthorized'
        ? 401
        : message === 'Forbidden'
          ? 403
          : 500

    return new Response(JSON.stringify({ message }), { status })
  }),
}))

const prismaMock = vi.hoisted(() => ({
  incident: {
    findUnique: vi.fn(),
  },
  evidence: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_OR_ENFORCER: ['ADMIN', 'ENFORCER'],
  requireRequestUser: authMock.requireRequestUser,
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

import { GET as getIncidentEvidence } from '@/app/api/incidents/[incidentId]/evidence/route'
import { PATCH as reviewEvidence } from '@/app/api/evidence/[evidenceId]/review/route'

function makeRequest(url: string, method: 'GET' | 'PATCH' = 'GET', body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.evidence.findMany.mockResolvedValue([])
  prismaMock.evidence.update.mockResolvedValue({ id: 'evidence-1', status: 'VERIFIED' })
})

describe('incident evidence authorization', () => {
  it('allows the reporting user to read incident evidence', async () => {
    authMock.requireRequestUser.mockResolvedValueOnce({ id: 'public-1', userType: 'PUBLIC' })
    prismaMock.incident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      reportedById: 'public-1',
      handledById: 'enforcer-1',
    })

    const response = await getIncidentEvidence(
      makeRequest('http://localhost/api/incidents/incident-1/evidence') as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )

    expect(response.status).toBe(200)
    expect(prismaMock.evidence.findMany).toHaveBeenCalled()
  })

  it('allows the assigned enforcer to read incident evidence', async () => {
    authMock.requireRequestUser.mockResolvedValueOnce({ id: 'enforcer-1', userType: 'ENFORCER' })
    prismaMock.incident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      reportedById: 'public-1',
      handledById: 'enforcer-1',
    })

    const response = await getIncidentEvidence(
      makeRequest('http://localhost/api/incidents/incident-1/evidence') as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.message).toBe('Evidence retrieved successfully')
    expect(prismaMock.evidence.findMany).toHaveBeenCalled()
  })

  it('rejects an unassigned enforcer from reading incident evidence', async () => {
    authMock.requireRequestUser.mockResolvedValueOnce({ id: 'enforcer-2', userType: 'ENFORCER' })
    prismaMock.incident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      reportedById: 'public-1',
      handledById: 'enforcer-1',
    })

    const response = await getIncidentEvidence(
      makeRequest('http://localhost/api/incidents/incident-1/evidence') as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.message).toBe(
      'You can only view evidence for incidents you reported or incidents assigned to you.',
    )
    expect(prismaMock.evidence.findMany).not.toHaveBeenCalled()
  })

  it('allows admins to read any incident evidence', async () => {
    authMock.requireRequestUser.mockResolvedValueOnce({ id: 'admin-1', userType: 'ADMIN' })
    prismaMock.incident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      reportedById: 'public-1',
      handledById: 'enforcer-1',
    })

    const response = await getIncidentEvidence(
      makeRequest('http://localhost/api/incidents/incident-1/evidence') as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )

    expect(response.status).toBe(200)
    expect(prismaMock.evidence.findMany).toHaveBeenCalled()
  })

  it('allows the assigned enforcer to review evidence', async () => {
    authMock.requireRequestRole.mockResolvedValueOnce({ id: 'enforcer-1', userType: 'ENFORCER' })
    prismaMock.evidence.findUnique.mockResolvedValueOnce({
      id: 'evidence-1',
      incident: {
        id: 'incident-1',
        reportedById: 'public-1',
        handledById: 'enforcer-1',
      },
      uploader: { firstName: 'Test', lastName: 'User', username: 'tester' },
    })

    const response = await reviewEvidence(
      makeRequest('http://localhost/api/evidence/evidence-1/review', 'PATCH', {
        status: 'VERIFIED',
        remarks: 'Looks valid',
      }) as never,
      { params: Promise.resolve({ evidenceId: 'evidence-1' }) },
    )

    expect(response.status).toBe(200)
    expect(prismaMock.evidence.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evidence-1' },
        data: expect.objectContaining({ reviewedBy: 'enforcer-1', status: 'VERIFIED' }),
      }),
    )
  })

  it('rejects an unassigned enforcer from reviewing evidence', async () => {
    authMock.requireRequestRole.mockResolvedValueOnce({ id: 'enforcer-2', userType: 'ENFORCER' })
    prismaMock.evidence.findUnique.mockResolvedValueOnce({
      id: 'evidence-1',
      incident: {
        id: 'incident-1',
        reportedById: 'public-1',
        handledById: 'enforcer-1',
      },
      uploader: { firstName: 'Test', lastName: 'User', username: 'tester' },
    })

    const response = await reviewEvidence(
      makeRequest('http://localhost/api/evidence/evidence-1/review', 'PATCH', {
        status: 'REJECTED',
        remarks: 'Not assigned',
      }) as never,
      { params: Promise.resolve({ evidenceId: 'evidence-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.message).toBe('Only the assigned enforcer for this incident can review its evidence.')
    expect(prismaMock.evidence.update).not.toHaveBeenCalled()
  })

  it('rejects admins from reviewing evidence without an explicit escalation path', async () => {
    authMock.requireRequestRole.mockResolvedValueOnce({ id: 'admin-1', userType: 'ADMIN' })
    prismaMock.evidence.findUnique.mockResolvedValueOnce({
      id: 'evidence-1',
      incident: {
        id: 'incident-1',
        reportedById: 'public-1',
        handledById: 'enforcer-1',
      },
      uploader: { firstName: 'Test', lastName: 'User', username: 'tester' },
    })

    const response = await reviewEvidence(
      makeRequest('http://localhost/api/evidence/evidence-1/review', 'PATCH', {
        status: 'VERIFIED',
        remarks: 'Admin override',
      }) as never,
      { params: Promise.resolve({ evidenceId: 'evidence-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.message).toBe('Only the assigned enforcer for this incident can review its evidence.')
    expect(prismaMock.evidence.update).not.toHaveBeenCalled()
  })
})