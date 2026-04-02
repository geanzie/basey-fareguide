import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuthErrorResponse, requireRequestUser } from '@/lib/auth'
import { extractEvidenceFiles, uploadEvidenceFiles } from '@/lib/evidenceStorage'

export async function POST(request: NextRequest) {
  try {
    const user = await requireRequestUser(request)

    const formData = await request.formData()
    
    const incidentType = formData.get('incidentType') as string
    const description = formData.get('description') as string
    const location = formData.get('location') as string
    const vehicleId = formData.get('vehicleId') as string
    const plateNumber = formData.get('plateNumber') as string
    const driverLicense = formData.get('driverLicense') as string
    const vehicleType = formData.get('vehicleType') as string
    const incidentDate = formData.get('incidentDate') as string
    const incidentTime = formData.get('incidentTime') as string
    const coordinates = formData.get('coordinates') as string
    const evidenceFiles = extractEvidenceFiles(formData)

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
        vehicleId: vehicleId || null,
        plateNumber: plateNumber || null,
        driverLicense: driverLicense || null,
        vehicleType: vehicleType ? (vehicleType as any) : null,
        coordinates: coordinates || null,
        incidentDate: incidentDateTime,
        reportedById: user.id,
        status: 'PENDING'
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

    try {
      const evidence = await uploadEvidenceFiles({
        incidentId: incident.id,
        files: evidenceFiles,
        uploadedBy: user.id
      })

      return NextResponse.json({
        incident,
        referenceNumber: incident.id,
        evidence,
        evidenceCount: evidence.length,
        message: 'Incident reported successfully'
      })
    } catch (error) {
      try {
        await prisma.incident.delete({
          where: { id: incident.id }
        })
      } catch {}

      const message = error instanceof Error ? error.message : 'Failed to save incident evidence'
      return NextResponse.json({ message }, { status: 400 })
    }

  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
