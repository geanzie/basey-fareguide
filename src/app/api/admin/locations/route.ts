import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

/**
 * GET /api/admin/locations
 * List all locations with filtering and pagination
 */
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';
    const barangay = searchParams.get('barangay') || '';
    const validationStatus = searchParams.get('validationStatus') || '';
    const isActive = searchParams.get('isActive');

    // Build filter conditions
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { barangay: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (type) where.type = type;
    if (barangay) where.barangay = barangay;
    if (validationStatus) where.validationStatus = validationStatus;
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    // Get total count
    const total = await prisma.location.count({ where });

    // Get paginated locations
    const locations = await prisma.location.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    return NextResponse.json({
      locations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/locations
 * Create a new location
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
      type,
      coordinates,
      barangay,
      description,
      validationResult
    } = body;

    // Validate required fields
    if (!name || !type || !coordinates) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, coordinates' },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existing = await prisma.location.findUnique({
      where: { name }
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Location with this name already exists' },
        { status: 400 }
      );
    }

    // Create location with admin user ID
    const location = await prisma.location.create({
      data: {
        name,
        type,
        coordinates,
        barangay: barangay || null,
        description: description || null,
        isActive: true,
        createdBy: decoded.userId, // Add the user ID from JWT token
        // Store validation results if provided
        googlePlaceId: validationResult?.googlePlaceId || null,
        googleFormattedAddress: validationResult?.googleAddress || null,
        validationStatus: validationResult?.googleMapsValid ? 'VALIDATED' : 'PENDING',
        isWithinMunicipality: validationResult?.withinMunicipality || false,
        isWithinBarangay: validationResult?.withinBarangay || false,
        actualBarangay: validationResult?.detectedBarangay || null,
        lastValidated: validationResult ? new Date() : null
      }
    });

    return NextResponse.json({
      message: 'Location created successfully',
      location
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating location:', error);
    return NextResponse.json(
      { error: 'Failed to create location' },
      { status: 500 }
    );
  }
}
