import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

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

// GET /api/enforcer/notifications
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'ENFORCER') {
      return NextResponse.json({ message: 'Access denied. Enforcer role required.' }, { status: 403 })
    }

    // Mock notifications for now - replace with actual database queries
    const notifications = [
      {
        id: '1',
        type: 'incident',
        title: 'New High-Priority Incident',
        message: 'Reckless driving reported near Basey Elementary School',
        timestamp: new Date().toISOString(),
        read: false,
        actionRequired: true,
        incidentId: 'INC001'
      },
      {
        id: '2',
        type: 'evidence',
        title: 'Evidence Uploaded',
        message: 'New video evidence submitted for incident #INC002',
        timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
        read: false,
        incidentId: 'INC002'
      }
    ]

    return NextResponse.json({ notifications })
      } catch (error) {    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
