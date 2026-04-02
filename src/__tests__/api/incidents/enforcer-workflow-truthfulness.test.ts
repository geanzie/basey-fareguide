import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ message }), { status })
  }),
}))

const prismaMock = vi.hoisted(() => ({
  incident: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))

const cleanupMock = vi.hoisted(() => ({
  cleanupEvidenceFiles: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  ENFORCER_ONLY: ['ENFORCER'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/evidenceCleanup', () => ({
  cleanupEvidenceFiles: cleanupMock.cleanupEvidenceFiles,
}))

import { PATCH as takeIncident } from '@/app/api/incidents/[incidentId]/take/route'
import { PATCH as issueTicket } from '@/app/api/incidents/[incidentId]/issue-ticket/route'
import { PATCH as resolveIncident } from '@/app/api/incidents/[incidentId]/resolve/route'

function makeJsonRequest(url: string, body: unknown = {}): Request {
  return new Request(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestRole.mockResolvedValue({ id: 'enforcer-1', userType: 'ENFORCER' })
  cleanupMock.cleanupEvidenceFiles.mockResolvedValue(undefined)
})

describe('enforcer workflow truthfulness', () => {
  it('returns an explicit assignment message when an enforcer takes a pending incident', async () => {
    prismaMock.incident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'PENDING',
    })
    prismaMock.incident.update.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'INVESTIGATING',
    })

    const response = await takeIncident(
      makeJsonRequest('http://localhost/api/incidents/incident-1/take') as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.message).toBe('Incident assigned successfully')
    expect(prismaMock.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'INVESTIGATING',
          handledById: 'enforcer-1',
        }),
      }),
    )
  })

  it('returns a truthful ticket-and-resolution message and starts evidence cleanup', async () => {
    prismaMock.incident.findUnique
      .mockResolvedValueOnce({
        id: 'incident-1',
        status: 'INVESTIGATING',
        handledById: 'enforcer-1',
        ticketNumber: null,
      })
      .mockResolvedValueOnce(null)
    prismaMock.incident.update.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'RESOLVED',
      ticketNumber: 'T-100',
    })

    const response = await issueTicket(
      makeJsonRequest('http://localhost/api/incidents/incident-1/issue-ticket', {
        ticketNumber: 'T-100',
        penaltyAmount: 500,
        remarks: 'Confirmed overcharge',
      }) as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.message).toBe(
      'Ticket T-100 issued successfully. Incident marked as resolved and evidence cleanup initiated.',
    )
    expect(json.evidenceCleanupInitiated).toBe(true)
    expect(cleanupMock.cleanupEvidenceFiles).toHaveBeenCalledWith('incident-1')
  })

  it('blocks the resolve-without-ticket path once a ticket already exists', async () => {
    prismaMock.incident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'INVESTIGATING',
      handledById: 'enforcer-1',
      ticketNumber: 'T-101',
    })

    const response = await resolveIncident(
      makeJsonRequest('http://localhost/api/incidents/incident-1/resolve', {
        remarks: 'Already handled',
      }) as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.message).toMatch(/already has a ticket/i)
    expect(prismaMock.incident.update).not.toHaveBeenCalled()
  })

  it('returns a truthful resolve-without-ticket message and starts cleanup', async () => {
    prismaMock.incident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'INVESTIGATING',
      handledById: 'enforcer-1',
      ticketNumber: null,
      remarks: null,
    })
    prismaMock.incident.update.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'RESOLVED',
      ticketNumber: null,
      remarks: 'No ticket issued after field verification',
    })

    const response = await resolveIncident(
      makeJsonRequest('http://localhost/api/incidents/incident-1/resolve', {
        remarks: 'No ticket issued after field verification',
      }) as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.message).toBe('Incident resolved without issuing a ticket. Evidence cleanup has been initiated.')
    expect(json.evidenceCleanupInitiated).toBe(true)
    expect(cleanupMock.cleanupEvidenceFiles).toHaveBeenCalledWith('incident-1')
  })
})
