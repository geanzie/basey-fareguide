import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth';
import { invalidatePlannerLocationsCache } from '@/lib/locations/plannerLocations';
import {
  buildLocationValidationLog,
  buildLocationValidationSummary,
  validateLocation,
  LocationValidationRequest
} from '@/utils/locationValidation';

/**
 * POST /api/admin/locations/validate
 * Validate location coordinates and data
 */
export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireRequestRole(request, [...ADMIN_ONLY]);

    const body = await request.json();
    const {
      name,
      coordinates,
      barangay,
      type,
      description
    } = body as LocationValidationRequest;

    // Validate required fields
    if (!name || !coordinates || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, coordinates, type' },
        { status: 400 }
      );
    }

    // Perform validation with base URL for Google Maps API calls
    // Construct base URL from request headers
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    const validationResult = await validateLocation({
      name,
      coordinates,
      barangay,
      type,
      description,
      locationId: body.locationId
    }, baseUrl);

    let persisted = false;

    if (body.locationId) {
      const existingLocation = await prisma.location.findUnique({
        where: { id: body.locationId },
        select: { id: true }
      });

      if (existingLocation) {
        const validatedAt = new Date();
        await prisma.location.update({
          where: { id: body.locationId },
          data: {
            ...buildLocationValidationSummary(validationResult, adminUser.id, validatedAt),
            validationLogs: {
              create: buildLocationValidationLog(
                validationResult,
                adminUser.id,
                'VALIDATE',
                validatedAt
              )
            }
          }
        });
        persisted = true;
        invalidatePlannerLocationsCache();
      }
    }

    return NextResponse.json({
      validation: validationResult,
      persisted
    });
  } catch (error) {
    console.error('Error validating location:', error);
    return createAuthErrorResponse(error);
  }
}
