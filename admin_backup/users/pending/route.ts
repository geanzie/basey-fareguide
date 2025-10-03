import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Get users who are not verified (pending verification)
    const pendingUsers = await prisma.user.findMany({
      where: {
        isVerified: false,
        userType: 'PUBLIC' // Only public users need manual verification
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        userType: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        governmentId: true,
        barangayResidence: true,
        reasonForRegistration: true,
        dateOfBirth: true,
        occupation: true,
        emergencyContact: true,
        emergencyContactPhone: true
      }
    });

    return NextResponse.json({
      success: true,
      users: pendingUsers
    });

  } catch (error) {
    console.error('Error fetching pending users:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch pending users'
    }, { status: 500 });
  }
}