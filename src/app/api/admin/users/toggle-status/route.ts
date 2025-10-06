import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, updatedBy } = body

    if (!userId || !updatedBy) {
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
    const newStatus = !user.isActive
    
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
        performedBy: updatedBy,
        reason: `User ${newStatus ? 'activated' : 'deactivated'} by admin`
      }
    })

    return NextResponse.json({
      success: true,
      message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
      newStatus
    })
  } catch (error) {
    console.error('Error toggling user status:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
