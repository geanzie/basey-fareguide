import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { PermitStatus } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const permit = await prisma.permit.findUnique({
      where: { id: params.id },
      include: {
        renewalHistory: {
          orderBy: { renewedAt: 'desc' }
        }
      }
    })

    if (!permit) {
      return NextResponse.json(
        { error: 'Permit not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(permit)
  } catch (error) {
    console.error('Error fetching permit:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { driverFullName, status, remarks, updatedBy } = body

    const existingPermit = await prisma.permit.findUnique({
      where: { id: params.id }
    })

    if (!existingPermit) {
      return NextResponse.json(
        { error: 'Permit not found' },
        { status: 404 }
      )
    }

    const permit = await prisma.permit.update({
      where: { id: params.id },
      data: {
        ...(driverFullName && { driverFullName }),
        ...(status && { status }),
        ...(remarks && { remarks }),
        lastUpdatedBy: updatedBy,
        lastUpdatedAt: new Date()
      },
      include: {
        renewalHistory: {
          orderBy: { renewedAt: 'desc' }
        }
      }
    })

    return NextResponse.json(permit)
  } catch (error) {
    console.error('Error updating permit:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existingPermit = await prisma.permit.findUnique({
      where: { id: params.id }
    })

    if (!existingPermit) {
      return NextResponse.json(
        { error: 'Permit not found' },
        { status: 404 }
      )
    }

    await prisma.permit.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Permit deleted successfully' })
  } catch (error) {
    console.error('Error deleting permit:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}