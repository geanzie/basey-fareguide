import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { PermitStatus } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const permit = await prisma.permit.findUnique({
      where: { id },
      include: {
        renewalHistory: {
          orderBy: { renewedAt: 'desc' }
        },
        vehicle: {
          select: {
            id: true,
            plateNumber: true,
            make: true,
            model: true,
            ownerName: true,
            vehicleType: true
          }
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { permitPlateNumber, driverFullName, status, remarks, updatedBy } = body

    const existingPermit = await prisma.permit.findUnique({
      where: { id }
    })

    if (!existingPermit) {
      return NextResponse.json(
        { error: 'Permit not found' },
        { status: 404 }
      )
    }

    // If permitPlateNumber is being updated, check if it already exists
    if (permitPlateNumber && permitPlateNumber !== existingPermit.permitPlateNumber) {
      const existingPlatePermit = await prisma.permit.findUnique({
        where: { permitPlateNumber: permitPlateNumber.toUpperCase() }
      })
      
      if (existingPlatePermit && existingPlatePermit.id !== id) {
        return NextResponse.json(
          { error: 'Permit plate number already exists' },
          { status: 409 }
        )
      }
    }

    const permit = await prisma.permit.update({
      where: { id },
      data: {
        ...(permitPlateNumber && { permitPlateNumber: permitPlateNumber.toUpperCase() }),
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existingPermit = await prisma.permit.findUnique({
      where: { id }
    })

    if (!existingPermit) {
      return NextResponse.json(
        { error: 'Permit not found' },
        { status: 404 }
      )
    }

    await prisma.permit.delete({
      where: { id }
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