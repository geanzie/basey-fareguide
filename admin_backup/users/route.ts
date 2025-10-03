import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const users = await prisma.user.findMany({
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
        reasonForRegistration: true
      }
    });

    return NextResponse.json({
      success: true,
      users
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch users'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, isActive } = await request.json();

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive }
    });

    // Log the status change
    await prisma.userVerificationLog.create({
      data: {
        userId,
        action: isActive ? 'REACTIVATED' : 'SUSPENDED',
        performedBy: 'SYSTEM_ADMIN', // In real app, use actual admin ID
        reason: `User account ${isActive ? 'reactivated' : 'suspended'} by administrator`
      }
    });

    return NextResponse.json({
      success: true,
      user: updatedUser
    });

  } catch (error) {
    console.error('Error updating user status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update user status'
    }, { status: 500 });
  }
}