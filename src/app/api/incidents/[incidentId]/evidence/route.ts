import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import jwt from 'jsonwebtoken'
import { writeFile } from 'fs/promises'
import { join } from 'path'

const prisma = new PrismaClient()

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

function getFileType(mimeType: string) {
  if (mimeType.startsWith('image/')) return 'IMAGE'
  if (mimeType.startsWith('video/')) return 'VIDEO'
  if (mimeType.startsWith('audio/')) return 'AUDIO'
  if (mimeType.includes('pdf') || mimeType.includes('document')) return 'DOCUMENT'
  return 'OTHER'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ incidentId: string }> }
) {
  try {
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { incidentId } = await params

    // Check if incident exists
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId }
    })

    if (!incident) {
      return NextResponse.json({ message: 'Incident not found' }, { status: 404 })
    }

    // Check if user can upload evidence (reporter or enforcer handling the case)
    const canUpload = incident.reportedById === user.id || 
                     incident.handledById === user.id || 
                     user.userType === 'ADMIN'

    if (!canUpload) {
      return NextResponse.json({ 
        message: 'You can only upload evidence for incidents you reported or are handling' 
      }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ message: 'No file provided' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ 
        message: 'File size too large. Maximum 10MB allowed.' 
      }, { status: 400 })
    }

    // Create unique filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()
    const fileName = `evidence_${incidentId}_${timestamp}.${extension}`
    
    // Create uploads directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'evidence')
    
    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filePath = join(uploadDir, fileName)
    
    try {
      await writeFile(filePath, buffer)
    } catch (error) {
      console.error('File write error:', error)
      return NextResponse.json({ 
        message: 'Failed to save file' 
      }, { status: 500 })
    }

    // Save evidence record to database
    const evidence = await prisma.evidence.create({
      data: {
        incidentId,
        fileName,
        fileUrl: `/uploads/evidence/${fileName}`,
        fileType: getFileType(file.type) as any,
        fileSize: file.size,
        uploadedBy: user.id,
        status: 'PENDING_REVIEW'
      },
      include: {
        uploader: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        }
      }
    })

    return NextResponse.json({
      evidence,
      message: 'Evidence uploaded successfully'
    })

  } catch (error) {
    console.error('POST /api/incidents/[incidentId]/evidence error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ incidentId: string }> }
) {
  try {
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { incidentId } = await params

    // Check if incident exists
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId }
    })

    if (!incident) {
      return NextResponse.json({ message: 'Incident not found' }, { status: 404 })
    }

    // Check if user can view evidence
    const canView = incident.reportedById === user.id || 
                   incident.handledById === user.id || 
                   ['ADMIN', 'ENFORCER'].includes(user.userType)

    if (!canView) {
      return NextResponse.json({ 
        message: 'You can only view evidence for incidents you are involved with' 
      }, { status: 403 })
    }

    // Get all evidence for this incident
    const evidence = await prisma.evidence.findMany({
      where: { incidentId },
      include: {
        uploader: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        },
        reviewer: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json({
      evidence,
      message: 'Evidence retrieved successfully'
    })

  } catch (error) {
    console.error('GET /api/incidents/[incidentId]/evidence error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}