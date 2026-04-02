import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireRequestRole(request, [...ADMIN_ONLY])
    const body = await request.json()
    const { userId, isActive } = body

    if (!userId) {
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

    // Toggle the active status
    const newStatus = typeof isActive === 'boolean' ? isActive : !user.isActive
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: newStatus
      }
    })

    // Log the status change
    await prisma.userVerificationLog.create({
      data: {
        userId,
        action: newStatus ? 'ACTIVATED' : 'DEACTIVATED',
        performedBy: adminUser.id,
        reason: `User ${newStatus ? 'activated' : 'deactivated'} by admin`
      }
    })

    return NextResponse.json({
      success: true,
      message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
      newStatus
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
