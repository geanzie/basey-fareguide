import { beforeEach, describe, expect, it, vi } from 'vitest'

const settingsMock = vi.hoisted(() => ({
  getDriverSessionSettings: vi.fn(),
}))

vi.mock('@/lib/driverSessionSettings/settingsService', () => ({
  getDriverSessionSettings: settingsMock.getDriverSessionSettings,
}))

import { GET } from '@/app/api/config/trip-flow/route'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/config/trip-flow', () => {
  it('returns the suspended vehicle types without requiring auth', async () => {
    settingsMock.getDriverSessionSettings.mockResolvedValue({
      suspendedVehicleTypes: ['TRICYCLE', 'HABAL_HABAL'],
    })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ suspendedVehicleTypes: ['TRICYCLE', 'HABAL_HABAL'] })
  })

  it('reports an empty list when the admin has resumed every type', async () => {
    settingsMock.getDriverSessionSettings.mockResolvedValue({ suspendedVehicleTypes: [] })

    const response = await GET()

    expect(await response.json()).toEqual({ suspendedVehicleTypes: [] })
  })
})
