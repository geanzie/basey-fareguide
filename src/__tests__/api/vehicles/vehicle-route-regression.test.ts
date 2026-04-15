import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ error: message }), { status })
  }),
}))

const prismaMock = vi.hoisted(() => ({
  vehicle: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

const serializersMock = vi.hoisted(() => ({
  serializeVehicle: vi.fn((vehicle: Record<string, unknown>) => ({
    ...vehicle,
    serialized: true,
  })),
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_OR_ENCODER: ['ADMIN', 'DATA_ENCODER'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/incidents/penaltyRules', () => ({
  normalizePlateNumber: (plateNumber: string | null | undefined) => {
    if (!plateNumber) {
      return null
    }

    const normalized = plateNumber.trim().toUpperCase()
    return normalized.length > 0 ? normalized : null
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/serializers', () => ({
  serializeVehicle: serializersMock.serializeVehicle,
}))

import { POST as createVehicle } from '@/app/api/vehicles/route'
import { PATCH as updateVehicle, DELETE as deleteVehicle } from '@/app/api/vehicles/[id]/route'

function makeJsonRequest(url: string, body: unknown, method: 'POST' | 'PATCH' | 'DELETE') {
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

describe('vehicle route regression coverage', () => {
  const createPayload = {
    plateNumber: 'ABC123',
    vehicleType: 'JEEPNEY',
    make: 'Toyota',
    model: 'HiAce',
    year: '2020',
    color: 'White',
    capacity: '18',
    ownerName: 'Owner Name',
    ownerContact: '09123456789',
    driverName: 'Driver Name',
    driverLicense: 'D-123',
    registrationExpiry: '2027-01-01',
    insuranceExpiry: '2027-02-01',
  }

  it('rejects unauthenticated vehicle creation attempts', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Unauthorized'))

    const response = await createVehicle(
      makeJsonRequest('http://localhost/api/vehicles', createPayload, 'POST') as never,
    )

    expect(response.status).toBe(401)
    expect(prismaMock.vehicle.create).not.toHaveBeenCalled()
  })

  it('creates vehicles through the shared serializer and coerces numeric fields correctly', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValueOnce(null)
    prismaMock.vehicle.create.mockResolvedValueOnce({
      id: 'vehicle-1',
      plateNumber: 'ABC123',
      year: 2020,
      capacity: 18,
    })

    const response = await createVehicle(
      makeJsonRequest('http://localhost/api/vehicles', createPayload, 'POST') as never,
    )
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(prismaMock.vehicle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          year: 2020,
          capacity: 18,
          driverName: 'Driver Name',
          driverLicense: 'D-123',
        }),
      }),
    )
    expect(serializersMock.serializeVehicle).toHaveBeenCalled()
    expect(json.serialized).toBe(true)
  })

  it('rejects wrong-role vehicle updates', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Forbidden'))

    const response = await updateVehicle(
      makeJsonRequest('http://localhost/api/vehicles/vehicle-1', { color: 'Blue' }, 'PATCH') as never,
      { params: Promise.resolve({ id: 'vehicle-1' }) },
    )

    expect(response.status).toBe(403)
    expect(prismaMock.vehicle.update).not.toHaveBeenCalled()
  })

  it('blocks plate changes when a vehicle has an active driver assignment', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValueOnce({
      id: 'vehicle-1',
      plateNumber: 'ABC123',
      assignedDriver: {
        id: 'driver-1',
        username: 'ABC123',
      },
    })

    const response = await updateVehicle(
      makeJsonRequest('http://localhost/api/vehicles/vehicle-1', { plateNumber: 'XYZ789' }, 'PATCH') as never,
      { params: Promise.resolve({ id: 'vehicle-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.error).toMatch(/active driver assignment/i)
    expect(prismaMock.vehicle.update).not.toHaveBeenCalled()
  })

  it('soft-deactivates vehicles instead of hard deleting them', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValueOnce({ id: 'vehicle-1', isActive: true })
    prismaMock.vehicle.update.mockResolvedValueOnce({ id: 'vehicle-1', isActive: false })

    const response = await deleteVehicle(
      makeJsonRequest('http://localhost/api/vehicles/vehicle-1', {}, 'DELETE') as never,
      { params: Promise.resolve({ id: 'vehicle-1' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.message).toBe('Vehicle deactivated successfully')
    expect(prismaMock.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'vehicle-1' },
        data: expect.objectContaining({ isActive: false }),
      }),
    )
  })
})
