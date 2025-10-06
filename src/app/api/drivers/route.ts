import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const [drivers, total] = await Promise.all([
      prisma.driverProfile.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          licenseNumber: true,
          isActive: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              username: true
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
      }),
      prisma.driverProfile.count({
        where: {
          isActive: true
        }
      })
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      drivers,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    })
  } catch (error) {
    console.error('Error fetching drivers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch drivers' },
      { status: 500 }
    )
  }
}
