import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { userId, action, reason } = await request.json();

    if (action === 'approve') {
      // Approve the user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          isVerified: true,
          verifiedAt: new Date(),
          verifiedBy: 'SYSTEM_ADMIN', // In real app, use actual admin ID
          isActive: true
        }
      });

      // Log the verification
      await prisma.userVerificationLog.create({
        data: {
          userId,
          action: 'VERIFIED',
          performedBy: 'SYSTEM_ADMIN',
          reason: reason || 'User verified and approved by administrator'
        }
      });

      return NextResponse.json({
        success: true,
        message: 'User approved successfully',
        user: updatedUser
      });

    } else if (action === 'reject') {
      // Reject the user (deactivate and mark as rejected)
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          isVerified: false
        }
      });

      // Log the rejection
      await prisma.userVerificationLog.create({
        data: {
          userId,
          action: 'SUSPENDED',
          performedBy: 'SYSTEM_ADMIN',
          reason: reason || 'User registration rejected by administrator'
        }
      });

      return NextResponse.json({
        success: true,
        message: 'User rejected successfully',
        user: updatedUser
      });

    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error verifying user:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to verify user'
    }, { status: 500 });
  }
}