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

  // Hot on the scan path. A short CDN window keeps a crowd of riders off the
  // function; the server decides the real flow regardless of what this said.
  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60' },
  })
}
