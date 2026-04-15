import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST as createTicket } from '@/app/api/tickets/route'

function makeJsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/tickets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('direct ticket creation route', () => {
  it('returns gone because ticket issuance must use the assigned incident workflow', async () => {
    const response = await createTicket(
      makeJsonRequest({
        incidentType: 'FARE_OVERCHARGE',
        description: 'Fare mismatch',
        location: 'Amandayehan',
        plateNumber: 'ABC-123',
        penaltyAmount: 500,
        requiresPayment: false,
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(410)
    expect(json.message).toBe(
      'Direct ticket creation has been removed. Issue tickets from the assigned incident workflow after taking the incident and moving it into investigation.',
    )
  })
})