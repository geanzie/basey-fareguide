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
  $transaction: vi.fn(),
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
  RESOLVED_EVIDENCE_RETENTION_DAYS: 30,
  cleanupEvidenceFiles: cleanupMock.cleanupEvidenceFiles,
}))

import { PATCH as takeIncident } from '@/app/api/incidents/[incidentId]/take/route'
import { GET as getTicketPenaltyPreview, PATCH as issueTicket } from '@/app/api/incidents/[incidentId]/issue-ticket/route'
import { PATCH as markTicketPaid } from '@/app/api/incidents/[incidentId]/payment/route'
import { PATCH as resolveIncident } from '@/app/api/incidents/[incidentId]/resolve/route'
import { PATCH as verifyEvidence } from '@/app/api/incidents/[incidentId]/verify-evidence/route'
import { PATCH as dismissIncident } from '@/app/api/incidents/[incidentId]/dismiss/route'

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
  vi.resetAllMocks()
  authMock.requireRequestRole.mockResolvedValue({ id: 'enforcer-1', userType: 'ENFORCER' })
  cleanupMock.cleanupEvidenceFiles.mockResolvedValue(undefined)
  prismaMock.incident.count.mockResolvedValue(0)
  prismaMock.incident.aggregate.mockResolvedValue({
    _count: { id: 0 },
    _sum: { penaltyAmount: null },
  })
  prismaMock.$transaction.mockImplementation(
    (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock),
  )
})

describe('enforcer workflow truthfulness', () => {
  it('returns 410 Gone for the deprecated take-ownership route', async () => {
    const response = await takeIncident(
      makeJsonRequest('http://localhost/api/incidents/incident-1/take') as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(410)
    expect(json.message).toBe(
      'The take-ownership step has been removed. Scan the QR token and verify evidence to proceed.',
    )
    expect(prismaMock.incident.update).not.toHaveBeenCalled()
  })

  it('returns 410 Gone for the deprecated direct-resolve route', async () => {
    const response = await resolveIncident(
      makeJsonRequest('http://localhost/api/incidents/incident-1/resolve') as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(410)
    expect(json.message).toBe(
      'Direct resolution without payment has been removed. Issue a ticket and record confirmed full payment to resolve.',
    )
    expect(prismaMock.incident.update).not.toHaveBeenCalled()
  })

  it('verifies evidence on a pending incident and records the actor', async () => {
    prismaMock.incident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'PENDING',
      evidenceVerifiedAt: null,
      evidenceVerifiedById: null,
      _count: { evidence: 1 },
    })
    prismaMock.incident.update.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'PENDING',
      evidenceVerifiedAt: new Date(),
      evidenceVerifiedById: 'enforcer-1',
    })

    const response = await verifyEvidence(
      makeJsonRequest('http://localhost/api/incidents/incident-1/verify-evidence') as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.message).toMatch(/evidence verified/i)
    expect(prismaMock.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          evidenceVerifiedById: 'enforcer-1',
        }),
      }),
    )
  })

  it('returns 409 and skips the update when evidence was already verified', async () => {
    prismaMock.incident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'PENDING',
      evidenceVerifiedAt: new Date(),
      evidenceVerifiedById: 'enforcer-2',
    })

    const response = await verifyEvidence(
      makeJsonRequest('http://localhost/api/incidents/incident-1/verify-evidence') as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.message).toMatch(/already verified/i)
    expect(prismaMock.incident.update).not.toHaveBeenCalled()
  })

  it('dismisses a pending incident when remarks are supplied', async () => {
    prismaMock.incident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'PENDING',
      handledById: null,
    })
    prismaMock.incident.update.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'DISMISSED',
    })

    const response = await dismissIncident(
      makeJsonRequest('http://localhost/api/incidents/incident-1/dismiss', {
        remarks: 'Duplicate report.',
      }) as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.message).toMatch(/dismissed/i)
    expect(prismaMock.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DISMISSED',
          dismissRemarks: 'Duplicate report.',
          dismissedById: 'enforcer-1',
        }),
      }),
    )
  })

  it('rejects dismiss when remarks are blank', async () => {
    const response = await dismissIncident(
      makeJsonRequest('http://localhost/api/incidents/incident-1/dismiss', {
        remarks: '   ',
      }) as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.message).toMatch(/remarks/i)
    expect(prismaMock.incident.update).not.toHaveBeenCalled()
  })

  it('issues a ticket for a verified-evidence pending incident and sets status to TICKET_ISSUED', async () => {
    prismaMock.incident.findUnique
      .mockResolvedValueOnce({
        id: 'incident-1',
        status: 'PENDING',
        evidenceVerifiedAt: new Date('2026-04-01T09:50:00.000Z'),
        evidenceVerifiedById: 'enforcer-1',
        handledById: null,
        ticketNumber: null,
        plateNumber: 'ABC-123',
        incidentDate: new Date('2026-04-01T10:00:00.000Z'),
        createdAt: new Date('2026-04-01T10:05:00.000Z'),
        remarks: null,
      })
      .mockResolvedValueOnce(null)
    prismaMock.incident.update.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'TICKET_ISSUED',
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
      'Ticket T-100 issued. Awaiting confirmed full payment before the incident is marked as resolved. Evidence remains available for 30 days.',
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
          status: 'TICKET_ISSUED',
        }),
      }),
    )
    expect(json.evidenceRetainedUntilCleanup).toBe(true)
    expect(json.evidenceRetentionDays).toBe(30)
    expect(cleanupMock.cleanupEvidenceFiles).not.toHaveBeenCalled()
  })

  it('returns a computed penalty preview for a pending verified-evidence incident', async () => {
    prismaMock.incident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'PENDING',
      evidenceVerifiedAt: new Date('2026-04-03T07:50:00.000Z'),
      evidenceVerifiedById: 'enforcer-1',
      handledById: null,
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
      status: 'PENDING',
      evidenceVerifiedAt: new Date('2026-04-03T07:50:00.000Z'),
      evidenceVerifiedById: 'enforcer-1',
      handledById: null,
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

  it('rejects ticket issuance when evidence has not been verified', async () => {
    prismaMock.incident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'PENDING',
      evidenceVerifiedAt: null,
      evidenceVerifiedById: null,
      handledById: null,
      ticketNumber: null,
      plateNumber: 'ABC-123',
      incidentDate: new Date('2026-04-03T08:00:00.000Z'),
      createdAt: new Date('2026-04-03T08:05:00.000Z'),
    })

    const response = await issueTicket(
      makeJsonRequest('http://localhost/api/incidents/incident-1/issue-ticket', {
        ticketNumber: 'T-201',
      }) as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.message).toBe('Evidence must be verified before issuing a ticket.')
    expect(prismaMock.incident.update).not.toHaveBeenCalled()
  })

  it('rejects ticket issuance when incident is not in PENDING status', async () => {
    prismaMock.incident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'TICKET_ISSUED',
      evidenceVerifiedAt: new Date(),
      evidenceVerifiedById: 'enforcer-1',
      handledById: 'enforcer-1',
      ticketNumber: 'T-100',
      plateNumber: 'ABC-123',
      incidentDate: new Date('2026-04-03T08:00:00.000Z'),
      createdAt: new Date('2026-04-03T08:05:00.000Z'),
    })

    const response = await issueTicket(
      makeJsonRequest('http://localhost/api/incidents/incident-1/issue-ticket', {
        ticketNumber: 'T-201',
      }) as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.message).toBe('Can only issue tickets for pending incidents.')
    expect(prismaMock.incident.update).not.toHaveBeenCalled()
  })

  it('lets the encoder record confirmed full payment and auto-resolves the incident', async () => {
    authMock.requireRequestRole.mockResolvedValueOnce({ id: 'encoder-1', userType: 'DATA_ENCODER' })
    prismaMock.incident.findUnique
      .mockResolvedValueOnce({
        id: 'incident-1',
        ticketNumber: 'T-101',
        handledById: 'enforcer-1',
        paymentStatus: 'UNPAID',
        remarks: null,
      })
      .mockResolvedValueOnce({
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
    expect(json.message).toBe('Confirmed full payment for ticket T-101. Incident marked as resolved.')
    expect(prismaMock.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: 'PAID',
          officialReceiptNumber: 'OR-1001',
          status: 'RESOLVED',
          paymentRecordedById: 'encoder-1',
        }),
      }),
    )
  })

  it('keeps ticket payment outside the enforcer workflow', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Forbidden'))

    const response = await markTicketPaid(
      makeJsonRequest('http://localhost/api/incidents/incident-1/payment', {
        officialReceiptNumber: 'OR-1002',
      }) as never,
      { params: Promise.resolve({ incidentId: 'incident-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.message).toBe('Forbidden')
    expect(prismaMock.incident.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.incident.update).not.toHaveBeenCalled()
  })
})
