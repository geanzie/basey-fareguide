import { NextResponse } from 'next/server'

import type { TripFlowConfigDto } from '@/lib/contracts'
import { getDriverSessionSettings } from '@/lib/driverSessionSettings/settingsService'
import { getVehicleCapacitySettings } from '@/lib/vehicleCapacitySettings/settingsService'

export const dynamic = 'force-dynamic'

/**
 * Which vehicle types are suspended from the driver session flow, and how many
 * seats each seat-managed type may sell. Both clients read this to decide
 * whether a scanned vehicle takes the rider-confirmed path or the
 * driver-accept one, and to price a charter. Unauthenticated on purpose: a
 * rider can scan a sticker before logging in, and neither list is sensitive.
 *
 * Both settings ride on one response because the rider needs them on the same
 * screen, and a second round-trip on the scan path buys nothing.
 */
export async function GET() {
  const [sessionSettings, capacitySettings] = await Promise.all([
    getDriverSessionSettings(),
    getVehicleCapacitySettings(),
  ])

  const response: TripFlowConfigDto = {
    suspendedVehicleTypes: sessionSettings.suspendedVehicleTypes,
    seatCapacities: capacitySettings.seatCapacities,
  }

  return NextResponse.json(response)
}
