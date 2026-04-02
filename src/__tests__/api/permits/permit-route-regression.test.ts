import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ error: message }), { status })
  }),
}))

const transactionState = vi.hoisted(() => ({
  txPermitRenewalCreate: vi.fn(),
  txPermitUpdate: vi.fn(),
}))

const prismaMock = vi.hoisted(() => ({
  permit: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  vehicle: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      permitRenewal: {
        create: transactionState.txPermitRenewalCreate,
      },
      permit: {
        update: transactionState.txPermitUpdate,
      },
    }),
  ),
}))

const serializersMock = vi.hoisted(() => ({
  serializePermit: vi.fn((permit: Record<string, unknown>) => ({
    ...permit,
    serialized: true,
  })),
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_OR_ENCODER: ['ADMIN', 'DATA_ENCODER'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/serializers', () => ({
  serializePermit: serializersMock.serializePermit,
}))

import { POST as createPermit } from '@/app/api/permits/route'
import { PUT as updatePermit, DELETE as deletePermit } from '@/app/api/permits/[id]/route'
import { POST as renewPermit } from '@/app/api/permits/[id]/renew/route'

function makeJsonRequest(url: string, body: unknown, method: 'POST' | 'PUT' | 'DELETE') {
  return new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestRole.mockResolvedValue({ id: 'encoder-1', userType: 'DATA_ENCODER' })
})

describe('permit route regression coverage', () => {
  it('rejects unauthenticated permit creation attempts', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Unauthorized'))

    const response = await createPermit(
      makeJsonRequest(
        'http://localhost/api/permits',
        {
          vehicleId: 'vehicle-1',
          permitPlateNumber: 'perm-100',
          driverFullName: 'Driver Name',
          vehicleType: 'JEEPNEY',
          encodedBy: 'encoder-1',
        },
        'POST',
      ) as never,
    )

    expect(response.status).toBe(401)
    expect(prismaMock.permit.create).not.toHaveBeenCalled()
  })

  it('creates a permit for a vehicle that does not already have one', async () => {
    prismaMock.permit.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    prismaMock.vehicle.findUnique.mockResolvedValueOnce({ id: 'vehicle-1' })
    prismaMock.permit.create.mockResolvedValueOnce({
      id: 'permit-1',
      permitPlateNumber: 'PERM-100',
      vehicleId: 'vehicle-1',
      status: 'ACTIVE',
    })

    const response = await createPermit(
      makeJsonRequest(
        'http://localhost/api/permits',
        {
          vehicleId: 'vehicle-1',
          permitPlateNumber: 'perm-100',
          driverFullName: 'Driver Name',
          vehicleType: 'JEEPNEY',
          encodedBy: 'encoder-1',
          remarks: 'Initial permit',
        },
        'POST',
      ) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(prismaMock.permit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          permitPlateNumber: 'PERM-100',
          encodedBy: 'encoder-1',
          status: 'ACTIVE',
        }),
      }),
    )
    expect(json.serialized).toBe(true)
  })

  it('rejects wrong-role permit updates', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Forbidden'))

    const response = await updatePermit(
      makeJsonRequest(
        'http://localhost/api/permits/permit-1',
        {
          driverFullName: 'Updated Driver',
          updatedBy: 'encoder-1',
        },
        'PUT',
      ) as never,
      { params: Promise.resolve({ id: 'permit-1' }) },
    )

    expect(response.status).toBe(403)
    expect(prismaMock.permit.update).not.toHaveBeenCalled()
  })

  it('updates permit metadata and uppercases a changed permit plate', async () => {
    prismaMock.permit.findUnique
      .mockResolvedValueOnce({
        id: 'permit-1',
        permitPlateNumber: 'PERM-100',
      })
      .mockResolvedValueOnce(null)
    prismaMock.permit.update.mockResolvedValueOnce({
      id: 'permit-1',
      permitPlateNumber: 'PERM-200',
      lastUpdatedBy: 'encoder-1',
    })

    const response = await updatePermit(
      makeJsonRequest(
        'http://localhost/api/permits/permit-1',
        {
          permitPlateNumber: 'perm-200',
          driverFullName: 'Updated Driver',
          updatedBy: 'encoder-1',
        },
        'PUT',
      ) as never,
      { params: Promise.resolve({ id: 'permit-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(prismaMock.permit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          permitPlateNumber: 'PERM-200',
          driverFullName: 'Updated Driver',
          lastUpdatedBy: 'encoder-1',
        }),
      }),
    )
    expect(json.serialized).toBe(true)
  })

  it('renews permits transactionally and extends the expiry date from the later base date', async () => {
    const existingExpiry = new Date('2026-12-31T00:00:00.000Z')
    prismaMock.permit.findUnique.mockResolvedValueOnce({
      id: 'permit-1',
      expiryDate: existingExpiry,
    })
    transactionState.txPermitRenewalCreate.mockResolvedValueOnce({ id: 'renewal-1' })
    transactionState.txPermitUpdate.mockResolvedValueOnce({
      id: 'permit-1',
      expiryDate: new Date('2027-12-31T00:00:00.000Z'),
      status: 'ACTIVE',
    })

    const response = await renewPermit(
      makeJsonRequest(
        'http://localhost/api/permits/permit-1/renew',
        {
          renewedBy: 'encoder-1',
          notes: 'Annual renewal',
        },
        'POST',
      ) as never,
      { params: Promise.resolve({ id: 'permit-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(transactionState.txPermitRenewalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          permitId: 'permit-1',
          renewedBy: 'encoder-1',
          notes: 'Annual renewal',
        }),
      }),
    )
    expect(transactionState.txPermitUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'permit-1' },
        data: expect.objectContaining({
          status: 'ACTIVE',
          lastUpdatedBy: 'encoder-1',
        }),
      }),
    )
    expect(json.serialized).toBe(true)
  })

  it('deletes a permit only after confirming it exists', async () => {
    prismaMock.permit.findUnique.mockResolvedValueOnce({ id: 'permit-1' })
    prismaMock.permit.delete.mockResolvedValueOnce({ id: 'permit-1' })

    const response = await deletePermit(
      makeJsonRequest('http://localhost/api/permits/permit-1', {}, 'DELETE') as never,
      { params: Promise.resolve({ id: 'permit-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.message).toBe('Permit deleted successfully')
    expect(prismaMock.permit.delete).toHaveBeenCalledWith({
      where: { id: 'permit-1' },
    })
  })
})
