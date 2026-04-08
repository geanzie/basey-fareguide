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
    count: vi.fn(),
    aggregate: vi.fn(),
    update: vi.fn(),
  },
}))

const cleanupMock = vi.hoisted(() => ({
  cleanupEvidenceFiles: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_OR_ENCODER: ['ADMIN', 'DATA_ENCODER'],
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
import { GET as getTicketPenaltyPreview } from '@/app/api/incidents/[incidentId]/issue-ticket/route'
import { PATCH as issueTicket } from '@/app/api/incidents/[incidentId]/issue-ticket/route'
import { PATCH as markTicketPaid } from '@/app/api/incidents/[incidentId]/payment/route'
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

function makeRequest(url: string, method: 'GET' | 'PATCH' = 'GET'): Request {
  return new Request(url, { method })
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestRole.mockResolvedValue({ id: 'enforcer-1', userType: 'ENFORCER' })
  cleanupMock.cleanupEvidenceFiles.mockResolvedValue(undefined)
  prismaMock.incident.count.mockResolvedValue(0)
  prismaMock.incident.aggregate.mockResolvedValue({
    _count: { id: 0 },
    _sum: { penaltyAmount: null },
  })
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
        plateNumber: 'ABC-123',
        incidentDate: new Date('2026-04-01T10:00:00.000Z'),
        createdAt: new Date('2026-04-01T10:05:00.000Z'),
        remarks: null,
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
        remarks: 'Confirmed overcharge',
      }) as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.message).toBe(
      'Ticket T-100 issued successfully. Incident marked as resolved and evidence cleanup initiated.',
    )
    expect(json.penalty).toEqual(
      expect.objectContaining({
        offenseNumber: 1,
        offenseTier: 'FIRST',
        offenseTierLabel: '1st offense',
        penaltyAmount: 500,
        currentPenaltyAmount: 500,
        carriedForwardPenaltyAmount: 0,
        priorTicketCount: 0,
        priorUnpaidTicketCount: 0,
        ruleVersion: '2026-04-municipal-v1',
      }),
    )
    expect(prismaMock.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          plateNumber: 'ABC-123',
          penaltyAmount: 500,
          offenseNumberAtIssuance: 1,
          offenseTierAtIssuance: 'FIRST',
          penaltyRuleVersion: '2026-04-municipal-v1',
        }),
      }),
    )
    expect(json.evidenceCleanupInitiated).toBe(true)
    expect(cleanupMock.cleanupEvidenceFiles).toHaveBeenCalledWith('incident-1')
  })

  it('returns a computed penalty preview for the assigned investigating incident', async () => {
    prismaMock.incident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'INVESTIGATING',
      handledById: 'enforcer-1',
      ticketNumber: null,
      plateNumber: 'ABC-123',
      incidentDate: new Date('2026-04-03T08:00:00.000Z'),
      createdAt: new Date('2026-04-03T08:05:00.000Z'),
    })
    prismaMock.incident.count.mockResolvedValueOnce(1)
    prismaMock.incident.aggregate.mockResolvedValueOnce({
      _count: { id: 1 },
      _sum: { penaltyAmount: 500 },
    })

    const response = await getTicketPenaltyPreview(
      makeRequest('http://localhost/api/incidents/incident-1/issue-ticket') as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.plateNumber).toBe('ABC-123')
    expect(json.penalty).toEqual({
      offenseNumber: 2,
      offenseTier: 'SECOND',
      offenseTierLabel: '2nd offense',
      penaltyAmount: 1500,
      currentPenaltyAmount: 1000,
      carriedForwardPenaltyAmount: 500,
      priorTicketCount: 1,
      priorUnpaidTicketCount: 1,
      ruleVersion: '2026-04-municipal-v1',
    })
  })

  it('caps the computed penalty at the third-and-above tier', async () => {
    prismaMock.incident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'INVESTIGATING',
      handledById: 'enforcer-1',
      ticketNumber: null,
      plateNumber: 'ABC-123',
      incidentDate: new Date('2026-04-03T08:00:00.000Z'),
      createdAt: new Date('2026-04-03T08:05:00.000Z'),
    })
    prismaMock.incident.count.mockResolvedValueOnce(4)
    prismaMock.incident.aggregate.mockResolvedValueOnce({
      _count: { id: 4 },
      _sum: { penaltyAmount: 4500 },
    })

    const response = await getTicketPenaltyPreview(
      makeRequest('http://localhost/api/incidents/incident-1/issue-ticket') as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.penalty).toEqual(
      expect.objectContaining({
        offenseNumber: 5,
        offenseTier: 'THIRD_PLUS',
        penaltyAmount: 6000,
        currentPenaltyAmount: 1500,
        carriedForwardPenaltyAmount: 4500,
        priorUnpaidTicketCount: 4,
      }),
    )
  })

  it('lets the encoder office mark a ticket as paid without changing its resolution state', async () => {
    authMock.requireRequestRole.mockResolvedValueOnce({ id: 'encoder-1', userType: 'DATA_ENCODER' })
    prismaMock.incident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      ticketNumber: 'T-101',
      handledById: 'enforcer-1',
      paymentStatus: 'UNPAID',
      remarks: null,
    })
    prismaMock.incident.update.mockResolvedValueOnce({
      id: 'incident-1',
      ticketNumber: 'T-101',
      paymentStatus: 'PAID',
      status: 'RESOLVED',
    })

    const response = await markTicketPaid(
      makeJsonRequest('http://localhost/api/incidents/incident-1/payment', {
        officialReceiptNumber: 'OR-1001',
      }) as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.message).toBe('Ticket T-101 marked as paid.')
    expect(prismaMock.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: 'PAID',
          officialReceiptNumber: 'OR-1001',
        }),
      }),
    )
  })

  it('blocks ticket issuance when the incident has no usable plate number', async () => {
    prismaMock.incident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'INVESTIGATING',
      handledById: 'enforcer-1',
      ticketNumber: null,
      plateNumber: null,
      incidentDate: new Date('2026-04-03T08:00:00.000Z'),
      createdAt: new Date('2026-04-03T08:05:00.000Z'),
    })

    const response = await issueTicket(
      makeJsonRequest('http://localhost/api/incidents/incident-1/issue-ticket', {
        ticketNumber: 'T-200',
      }) as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.message).toMatch(/plate number is required/i)
    expect(prismaMock.incident.update).not.toHaveBeenCalled()
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
