import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/locations
 * Public endpoint to fetch all active locations for route planning
 * No authentication required - this is public data for the route planner
 */
export async function GET(request: NextRequest) {
  try {
    // Fetch only active and validated locations
    const locations = await prisma.location.findMany({
      where: {
        isActive: true,
        // Include locations that are validated or pending (admin might have manually verified)
        validationStatus: {
          in: ['VALIDATED', 'PENDING']
        }
      },
      select: {
        id: true,
        name: true,
        type: true,
        coordinates: true,
        barangay: true,
        description: true,
        googleFormattedAddress: true,
        validationStatus: true,
        createdAt: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Transform database locations to match the Location interface used by locationService
    const formattedLocations = locations.map(loc => {
      const [lat, lng] = loc.coordinates.split(',').map(coord => parseFloat(coord.trim()));
      
      return {
        name: loc.name,
        coordinates: {
          lat,
          lng
        },
        address: loc.googleFormattedAddress || `${loc.name}, Basey, Samar`,
        verified: loc.validationStatus === 'VALIDATED',
        type: loc.type,
        category: loc.type === 'BARANGAY' ? 'barangay' : 'landmark',
        source: 'database',
        barangay: loc.barangay || undefined
      };
    });

    return NextResponse.json({
      success: true,
      locations: formattedLocations,
      count: formattedLocations.length
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch locations',
        locations: [],
        count: 0
      },
      { status: 500 }
    );
  }
}
