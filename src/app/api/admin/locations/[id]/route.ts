import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth';
import { invalidatePlannerLocationsCache } from '@/lib/locations/plannerLocations';
import {
  buildLocationValidationLog,
  buildLocationValidationSummary,
  type LocationValidationResult
} from '@/utils/locationValidation';

/**
 * PUT /api/admin/locations/[id]
 * Update an existing location
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminUser = await requireRequestRole(request, [...ADMIN_ONLY]);

    const body = await request.json();
    const {
      name,
      type,
      coordinates,
      barangay,
      description,
      isActive,
      validationResult
    } = body;

    // Check if location exists
    const existingLocation = await prisma.location.findUnique({
      where: { id }
    });

    if (!existingLocation) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    // Check for duplicate name (excluding current location)
    if (name && name !== existingLocation.name) {
      const duplicate = await prisma.location.findUnique({
        where: { name }
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'Location with this name already exists' },
          { status: 400 }
        );
      }
    }

    const validatedAt = validationResult ? new Date() : undefined;

    // Update location
    const updatedLocation = await prisma.location.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(coordinates && { coordinates }),
        ...(barangay !== undefined && { barangay }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        ...(validationResult
          ? buildLocationValidationSummary(
              validationResult as LocationValidationResult,
              adminUser.id,
              validatedAt
            )
          : {}),
        ...(validationResult
          ? {
              validationLogs: {
                create: buildLocationValidationLog(
                  validationResult as LocationValidationResult,
                  adminUser.id,
                  'UPDATE',
                  validatedAt
                )
              }
            }
          : {}),
        updatedAt: new Date()
      }
    });

    invalidatePlannerLocationsCache();

    return NextResponse.json({
      message: 'Location updated successfully',
      location: updatedLocation
    });
  } catch (error) {
    console.error('Error updating location:', error);
    return createAuthErrorResponse(error);
  }
}

/**
 * DELETE /api/admin/locations/[id]
 * Soft delete a location (set isActive to false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireRequestRole(request, [...ADMIN_ONLY]);

    // Check if location exists
    const location = await prisma.location.findUnique({
      where: { id }
    });

    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    // Soft delete (set isActive to false)
    await prisma.location.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });

    invalidatePlannerLocationsCache();

    return NextResponse.json({
      message: 'Location deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting location:', error);
    return createAuthErrorResponse(error);
  }
}

/**
 * GET /api/admin/locations/[id]
 * Get a specific location by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireRequestRole(request, [...ADMIN_ONLY]);

    const location = await prisma.location.findUnique({
      where: { id }
    });

    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ location });
  } catch (error) {
    console.error('Error fetching location:', error);
    return createAuthErrorResponse(error);
  }
}
