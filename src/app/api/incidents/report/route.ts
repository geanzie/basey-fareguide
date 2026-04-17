import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { createAuthErrorResponse, requireRequestUser } from '@/lib/auth'
import { extractEvidenceFiles, uploadEvidenceFiles } from '@/lib/evidenceStorage'
import {
  REPORTABLE_FARE_HISTORY_DAYS,
  REPORTABLE_FARE_HISTORY_LIMIT,
  buildTripRouteLabel,
  getReportableFareHistoryCutoff,
} from '@/lib/incidents/reportTripSelection'
import { resolvePinLabel } from '@/lib/locations/pinLabelResolver'
import { prisma } from '@/lib/prisma'
import { formatFareLocationLabel } from '@/lib/serializers/fares'

interface SubmittedCoordinates {
  latitude: number
  longitude: number
}

interface ResolvedIncidentVehicle {
  id: string
  plateNumber: string
  driverLicense: string | null
  vehicleType: string
}

function parseSubmittedCoordinates(payload: string | null): SubmittedCoordinates | null {
  if (!payload) {
    return null
  }

  try {
    const parsed = JSON.parse(payload) as {
      latitude?: unknown
      longitude?: unknown
    }

    const { latitude, longitude } = parsed

    if (typeof latitude !== 'number' || !Number.isFinite(latitude)) {
      return null
    }

    if (typeof longitude !== 'number' || !Number.isFinite(longitude)) {
      return null
    }

    return {
      latitude,
      longitude,
    }
  } catch {
    return null
  }
}

async function loadEligibleFareCalculationIds(userId: string): Promise<string[]> {
  const eligibleCalculations = await prisma.fareCalculation.findMany({
    where: {
      userId,
      createdAt: {
        gte: getReportableFareHistoryCutoff(),
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: REPORTABLE_FARE_HISTORY_LIMIT,
    select: {
      id: true,
    },
  })

  return eligibleCalculations.map((calculation) => calculation.id)
}

async function loadFareCalculationContext(userId: string, fareCalculationId: string) {
  return prisma.fareCalculation.findFirst({
    where: {
      id: fareCalculationId,
      userId,
      createdAt: {
        gte: getReportableFareHistoryCutoff(),
      },
    },
    select: {
      id: true,
      fromLocation: true,
      toLocation: true,
      calculatedFare: true,
      discountType: true,
      createdAt: true,
      calculationType: true,
      vehicle: {
        select: {
          id: true,
          plateNumber: true,
          driverLicense: true,
          vehicleType: true,
          permit: {
            select: {
              permitPlateNumber: true,
            },
          },
        },
      },
    },
  })
}

async function resolveSupplementalVehicle(vehicleId: string | null): Promise<ResolvedIncidentVehicle | null> {
  if (!vehicleId) {
    return null
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: {
      id: vehicleId,
    },
    select: {
      id: true,
      plateNumber: true,
      driverLicense: true,
      vehicleType: true,
      isActive: true,
      permit: {
        select: {
          status: true,
        },
      },
    },
  })

  if (!vehicle) {
    throw new Error('Selected vehicle was not found.')
  }

  if (!vehicle.isActive || vehicle.permit?.status !== 'ACTIVE') {
    throw new Error('Selected vehicle must have an active permit.')
  }

  return {
    id: vehicle.id,
    plateNumber: vehicle.plateNumber,
    driverLicense: vehicle.driverLicense,
    vehicleType: vehicle.vehicleType,
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRequestUser(request)
    const formData = await request.formData()

    const incidentType = (formData.get('incidentType') as string | null)?.trim() ?? ''
    const description = (formData.get('description') as string | null)?.trim() ?? ''
    const submittedLocation = ((formData.get('location') as string | null) ?? '').trim()
    const incidentDate = (formData.get('incidentDate') as string | null)?.trim() ?? ''
    const incidentTime = (formData.get('incidentTime') as string | null)?.trim() ?? ''
    const fareCalculationId = ((formData.get('fareCalculationId') as string | null) ?? '').trim()
    const vehicleId = ((formData.get('vehicleId') as string | null) ?? '').trim() || null
    const coordinates = (formData.get('coordinates') as string | null) ?? null
    const evidenceFiles = extractEvidenceFiles(formData)
    const parsedCoordinates = parseSubmittedCoordinates(coordinates)
    const shouldEnforceTripSelection = user.userType === 'PUBLIC'

    if (!incidentType || !description || !incidentDate || !incidentTime) {
      return NextResponse.json(
        { message: 'Missing required fields: incidentType, description, incidentDate, incidentTime' },
        { status: 400 },
      )
    }

    if (evidenceFiles.length === 0) {
      return NextResponse.json(
        { message: 'At least one evidence file is required to submit an incident report.' },
        { status: 400 },
      )
    }

    const eligibleFareCalculationIds =
      shouldEnforceTripSelection || fareCalculationId
        ? await loadEligibleFareCalculationIds(user.id)
        : []

    if (shouldEnforceTripSelection && eligibleFareCalculationIds.length > 0 && !fareCalculationId) {
      return NextResponse.json(
        {
          message: `Select one of your ${REPORTABLE_FARE_HISTORY_LIMIT} most recent trips from the last ${REPORTABLE_FARE_HISTORY_DAYS} days before submitting a report.`,
        },
        { status: 400 },
      )
    }

    if (fareCalculationId && !eligibleFareCalculationIds.includes(fareCalculationId)) {
      return NextResponse.json(
        {
          message: `The selected trip is no longer eligible. Choose one of your latest ${REPORTABLE_FARE_HISTORY_LIMIT} trips from the last ${REPORTABLE_FARE_HISTORY_DAYS} days.`,
        },
        { status: 400 },
      )
    }

    const selectedFareCalculation = fareCalculationId
      ? await loadFareCalculationContext(user.id, fareCalculationId)
      : null

    if (fareCalculationId && !selectedFareCalculation) {
      return NextResponse.json(
        { message: 'The selected trip could not be found for your account.' },
        { status: 404 },
      )
    }

    const tripOrigin = selectedFareCalculation
      ? formatFareLocationLabel(selectedFareCalculation.fromLocation)
      : null
    const tripDestination = selectedFareCalculation
      ? formatFareLocationLabel(selectedFareCalculation.toLocation)
      : null
    const tripLocation = tripOrigin && tripDestination
      ? buildTripRouteLabel(tripOrigin, tripDestination)
      : ''
    const supplementalVehicle = selectedFareCalculation?.vehicle
      ? null
      : await resolveSupplementalVehicle(vehicleId)
    const incidentVehicle = selectedFareCalculation?.vehicle
      ? {
          id: selectedFareCalculation.vehicle.id,
          plateNumber: selectedFareCalculation.vehicle.plateNumber,
          driverLicense: selectedFareCalculation.vehicle.driverLicense,
          vehicleType: selectedFareCalculation.vehicle.vehicleType,
        }
      : supplementalVehicle

    if (selectedFareCalculation && !incidentVehicle) {
      return NextResponse.json(
        { message: 'Select the vehicle involved because this trip record does not have linked vehicle data.' },
        { status: 400 },
      )
    }

    if (!selectedFareCalculation && !incidentVehicle) {
      return NextResponse.json(
        { message: 'Select the vehicle involved before submitting a manual report.' },
        { status: 400 },
      )
    }

    const resolvedLocation = selectedFareCalculation
      ? tripLocation
      : submittedLocation || (
          parsedCoordinates
            ? resolvePinLabel(parsedCoordinates.latitude, parsedCoordinates.longitude).displayLabel
            : ''
        )

    if (!resolvedLocation) {
      return NextResponse.json(
        { message: 'Location is required when no eligible trip history is available.' },
        { status: 400 },
      )
    }

    const incidentDateTime = new Date(`${incidentDate}T${incidentTime}:00`)

    if (Number.isNaN(incidentDateTime.getTime())) {
      return NextResponse.json(
        { message: 'Incident date and time are invalid.' },
        { status: 400 },
      )
    }

    const incident = await prisma.incident.create({
      data: {
        incidentType: incidentType as never,
        description,
        location: resolvedLocation,
        coordinates: selectedFareCalculation ? null : coordinates || null,
        fareCalculationId: selectedFareCalculation?.id ?? null,
        tripOrigin,
        tripDestination,
        tripFare: selectedFareCalculation?.calculatedFare ?? null,
        tripDiscountType: selectedFareCalculation?.discountType ?? null,
        tripCalculatedAt: selectedFareCalculation?.createdAt ?? null,
        tripCalculationType: selectedFareCalculation?.calculationType ?? null,
        tripVehicleType: selectedFareCalculation?.vehicle?.vehicleType ?? null,
        tripPermitPlateNumber: selectedFareCalculation?.vehicle?.permit?.permitPlateNumber ?? null,
        tripPlateNumber: selectedFareCalculation?.vehicle?.plateNumber ?? null,
        vehicleId: incidentVehicle?.id ?? null,
        plateNumber: incidentVehicle?.plateNumber ?? null,
        driverLicense: incidentVehicle?.driverLicense ?? null,
        vehicleType: incidentVehicle ? (incidentVehicle.vehicleType as never) : null,
        incidentDate: incidentDateTime,
        reportedById: user.id,
        status: 'PENDING',
      },
      include: {
        reportedBy: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
    })

    try {
      const evidence = await uploadEvidenceFiles({
        incidentId: incident.id,
        files: evidenceFiles,
        uploadedBy: user.id,
      })

      return NextResponse.json({
        referenceNumber: incident.id,
        evidenceCount: evidence.length,
        message: 'Incident reported successfully',
      })
    } catch (error) {
      try {
        await prisma.incident.delete({
          where: { id: incident.id },
        })
      } catch {}

      const message = error instanceof Error ? error.message : 'Failed to save incident evidence'
      return NextResponse.json({ message }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Selected vehicle was not found.') {
      return NextResponse.json({ message: error.message }, { status: 404 })
    }

    if (error instanceof Error && error.message === 'Selected vehicle must have an active permit.') {
      return NextResponse.json({ message: error.message }, { status: 400 })
    }

    console.error('Incident report submission failed:', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        {
          message:
            process.env.NODE_ENV === 'production'
              ? 'Unable to save the incident report right now.'
              : error.message,
        },
        { status: 500 },
      )
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        {
          message:
            process.env.NODE_ENV === 'production'
              ? 'The incident report payload is invalid.'
              : error.message,
        },
        { status: 500 },
      )
    }

    if (error instanceof Error && process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return createAuthErrorResponse(error)
  }
}
