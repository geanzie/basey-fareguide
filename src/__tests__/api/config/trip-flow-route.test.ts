import { beforeEach, describe, expect, it, vi } from 'vitest'

const settingsMock = vi.hoisted(() => ({
  getDriverSessionSettings: vi.fn(),
}))

const capacityMock = vi.hoisted(() => ({
  getVehicleCapacitySettings: vi.fn(),
}))

vi.mock('@/lib/driverSessionSettings/settingsService', () => ({
  getDriverSessionSettings: settingsMock.getDriverSessionSettings,
}))

vi.mock('@/lib/vehicleCapacitySettings/settingsService', () => ({
  getVehicleCapacitySettings: capacityMock.getVehicleCapacitySettings,
}))

import { GET } from '@/app/api/config/trip-flow/route'

const SEAT_CAPACITIES = { HABAL_HABAL: 3, TRICYCLE: 6 }

beforeEach(() => {
  vi.clearAllMocks()
  capacityMock.getVehicleCapacitySettings.mockResolvedValue({
    seatCapacities: SEAT_CAPACITIES,
  })
})

describe('GET /api/config/trip-flow', () => {
  it('returns the suspended vehicle types without requiring auth', async () => {
    settingsMock.getDriverSessionSettings.mockResolvedValue({
      suspendedVehicleTypes: ['TRICYCLE', 'HABAL_HABAL'],
    })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({
      suspendedVehicleTypes: ['TRICYCLE', 'HABAL_HABAL'],
      seatCapacities: SEAT_CAPACITIES,
    })
  })

  it('reports an empty list when the admin has resumed every type', async () => {
    settingsMock.getDriverSessionSettings.mockResolvedValue({ suspendedVehicleTypes: [] })

    const response = await GET()

    expect(await response.json()).toEqual({
      suspendedVehicleTypes: [],
      seatCapacities: SEAT_CAPACITIES,
    })
  })

  it('carries seat capacities so a rider can price a charter before logging in', async () => {
    settingsMock.getDriverSessionSettings.mockResolvedValue({
      suspendedVehicleTypes: ['TRICYCLE', 'HABAL_HABAL'],
    })
    capacityMock.getVehicleCapacitySettings.mockResolvedValue({
      seatCapacities: { HABAL_HABAL: 2, TRICYCLE: 4 },
    })

    const json = await (await GET()).json()

    expect(json.seatCapacities).toEqual({ HABAL_HABAL: 2, TRICYCLE: 4 })
  })

  it('omits a type the municipality does not seat-manage rather than sending zero', async () => {
    settingsMock.getDriverSessionSettings.mockResolvedValue({ suspendedVehicleTypes: [] })
    capacityMock.getVehicleCapacitySettings.mockResolvedValue({
      seatCapacities: { HABAL_HABAL: 3 },
    })

    const json = await (await GET()).json()

    // A missing key means "no ceiling, no charter". Zero would block every scan.
    expect(json.seatCapacities).toEqual({ HABAL_HABAL: 3 })
    expect(json.seatCapacities.TRICYCLE).toBeUndefined()
  })
})
