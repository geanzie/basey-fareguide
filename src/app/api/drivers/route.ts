import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    const drivers = await prisma.driverProfile.findMany({
      take: limit,
      select: {
        id: true,
        licenseNumber: true,
        isActive: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      where: {
        isActive: true
      },
      orderBy: {
        user: {
          firstName: 'asc'
        }
      }
    })

    return NextResponse.json({
      drivers
    })
  } catch (error) {
    console.error('Error fetching drivers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch drivers' },
      { status: 500 }
    )
  }
}