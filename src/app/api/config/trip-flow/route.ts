import { NextResponse } from 'next/server'

import type { TripFlowConfigDto } from '@/lib/contracts'
import { getDriverSessionSettings } from '@/lib/driverSessionSettings/settingsService'

export const dynamic = 'force-dynamic'

/**
 * Which vehicle types are suspended from the driver session flow. Both clients
 * read this to decide whether a scanned vehicle takes the rider-confirmed path
 * or the driver-accept one. Unauthenticated on purpose: a rider can scan a
 * sticker before logging in, and the list is not sensitive.
 */
export async function GET() {
  const settings = await getDriverSessionSettings()

  const response: TripFlowConfigDto = {
    suspendedVehicleTypes: settings.suspendedVehicleTypes,
  }

  return NextResponse.json(response)
}
