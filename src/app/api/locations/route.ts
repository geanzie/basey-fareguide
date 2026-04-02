import { NextRequest, NextResponse } from 'next/server';
import { listPlannerLocations } from '@/lib/locations/plannerLocations';

/**
 * GET /api/locations
 * Public endpoint to fetch all active locations for route planning
 * No authentication required - this is public data for the route planner
 */
export async function GET(request: NextRequest) {
  try {
    const locations = await listPlannerLocations();
    const lastUpdated = locations.reduce<string | null>((latest, location) => {
      if (!latest) return location.updatedAt;
      return new Date(location.updatedAt) > new Date(latest)
        ? location.updatedAt
        : latest;
    }, null);

    return NextResponse.json({
      success: true,
      locations,
      count: locations.length,
      metadata: {
        municipality: 'Basey',
        province: 'Samar',
        total_locations: locations.length,
        last_updated: lastUpdated,
        sources: ['database']
      }
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch locations',
        locations: [],
        count: 0,
        metadata: null
      },
      { status: 500 }
    );
  }
}
