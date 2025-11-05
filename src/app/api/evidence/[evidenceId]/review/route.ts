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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ evidenceId: string }> }
) {
  try {
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Only enforcers and admins can review evidence
    if (!['ENFORCER', 'ADMIN'].includes(user.userType)) {
      return NextResponse.json({ 
        message: 'Only enforcers and administrators can review evidence' 
      }, { status: 403 })
    }

    const { evidenceId } = await params
    const { status, remarks } = await request.json()

    // Validate status
    const validStatuses = ['VERIFIED', 'REJECTED', 'REQUIRES_ADDITIONAL']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ 
        message: 'Invalid status. Must be VERIFIED, REJECTED, or REQUIRES_ADDITIONAL' 
      }, { status: 400 })
    }

    // Check if evidence exists
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        incident: true,
        uploader: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        }
      }
    })

    if (!evidence) {
      return NextResponse.json({ message: 'Evidence not found' }, { status: 404 })
    }

    // Update evidence status
    const updatedEvidence = await prisma.evidence.update({
      where: { id: evidenceId },
      data: {
        status: status as any,
        remarks,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        updatedAt: new Date()
      },
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
      }
    })

    return NextResponse.json({
      evidence: updatedEvidence,
      message: `Evidence ${status.toLowerCase()} successfully`
    })

  } catch (error) {
    console.error('PATCH /api/evidence/[evidenceId]/review error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}