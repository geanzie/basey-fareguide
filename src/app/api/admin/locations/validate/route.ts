import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { validateLocation, LocationValidationRequest } from '@/utils/locationValidation';

/**
 * POST /api/admin/locations/validate
 * Validate location coordinates and data
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; userType: string };
    
    if (decoded.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

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
      description
    }, baseUrl);

    return NextResponse.json({
      validation: validationResult
    });
  } catch (error) {
    console.error('Error validating location:', error);
    return NextResponse.json(
      { error: 'Failed to validate location: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
