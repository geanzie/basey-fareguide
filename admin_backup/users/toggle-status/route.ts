import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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