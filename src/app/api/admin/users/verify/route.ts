import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireRequestRole(request, [...ADMIN_ONLY])
    const body = await request.json()
    const { userId, action, reason } = body

    if (!userId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    if (action === 'approve') {
      // Approve the user
      await prisma.user.update({
        where: { id: userId },
        data: {
          isVerified: true,
          isActive: true,
          verifiedAt: new Date(),
          verifiedBy: adminUser.id
        }
      })

      // Log the verification
      await prisma.userVerificationLog.create({
        data: {
          userId,
          action: 'APPROVED',
          performedBy: adminUser.id,
          reason: reason?.trim() || 'User verification approved'
        }
      })

      return NextResponse.json({
        success: true,
        message: 'User approved successfully'
      })
    } else if (action === 'reject') {
      // Reject the user (deactivate)
      await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          isVerified: false
        }
      })

      // Log the rejection
      await prisma.userVerificationLog.create({
        data: {
          userId,
          action: 'REJECTED',
          performedBy: adminUser.id,
          reason: reason?.trim() || 'User verification rejected'
        }
      })

      return NextResponse.json({
        success: true,
        message: 'User rejected successfully'
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
