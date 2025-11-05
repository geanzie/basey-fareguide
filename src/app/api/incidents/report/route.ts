import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

async function verifyAuth(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        userType: true,
        isActive: true
      }
    })

    return user?.isActive ? user : null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    
    const incidentType = formData.get('incidentType') as string
    const description = formData.get('description') as string
    const location = formData.get('location') as string
    const plateNumber = formData.get('plateNumber') as string
    const driverLicense = formData.get('driverLicense') as string
    const vehicleType = formData.get('vehicleType') as string
    const incidentDate = formData.get('incidentDate') as string
    const incidentTime = formData.get('incidentTime') as string
    const coordinates = formData.get('coordinates') as string

    // Validate required fields
    if (!incidentType || !description || !location || !incidentDate || !incidentTime) {
      return NextResponse.json({ 
        message: 'Missing required fields: incidentType, description, location, incidentDate, incidentTime' 
      }, { status: 400 })
    }

    // Combine date and time
    const incidentDateTime = new Date(`${incidentDate}T${incidentTime}:00`)

    // Create incident
    const incident = await prisma.incident.create({
      data: {
        incidentType: incidentType as any,
        description,
        location,
        plateNumber: plateNumber || null,
        driverLicense: driverLicense || null,
        vehicleType: vehicleType ? (vehicleType as any) : null,
        coordinates: coordinates || null,
        incidentDate: incidentDateTime,
        reportedById: user.id,
        status: 'PENDING',
        evidenceUrls: [], // TODO: Handle file uploads
      },
      include: {
        reportedBy: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        }
      }
    })

    return NextResponse.json({
      incident,
      message: 'Incident reported successfully'
    })

  } catch (error) {
    console.error('POST /api/incidents/report error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
