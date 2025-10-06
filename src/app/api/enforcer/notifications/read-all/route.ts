import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

async function verifyAuth(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        userType: true
      }
    })

    return user
  } catch (error) {
    return null
  }
}

// POST /api/enforcer/notifications/read-all
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'ENFORCER') {
      return NextResponse.json({ message: 'Access denied. Enforcer role required.' }, { status: 403 })
    }
    
    // In a real implementation, mark all notifications as read in the database
    console.log(`Marking all notifications as read for user ${user.id}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/enforcer/notifications/read-all error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
