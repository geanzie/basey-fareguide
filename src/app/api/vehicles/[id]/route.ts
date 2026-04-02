import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ADMIN_OR_ENCODER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { serializeVehicle } from '@/lib/serializers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        permit: {
          select: {
            id: true,
            permitPlateNumber: true,
            status: true,
            issuedDate: true,
            expiryDate: true
          }
        }
      }
    })

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(vehicle)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch vehicle' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRequestRole(request, [...ADMIN_OR_ENCODER])
    const { id } = await params
    const body = await request.json()
    const { isActive, ...updateData } = body

    // Check if vehicle exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id }
    })

    if (!existingVehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      )
    }

    // Update the vehicle
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        isActive,
        ...updateData,
        updatedAt: new Date()
      },
      include: {
        permit: {
          select: {
            id: true,
            permitPlateNumber: true,
            status: true,
            issuedDate: true,
            expiryDate: true
          }
        }
      }
    })

    return NextResponse.json(serializeVehicle(vehicle))
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRequestRole(request, [...ADMIN_OR_ENCODER])
    const { id } = await params
    // Check if vehicle exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id }
    })

    if (!existingVehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      )
    }

    // Instead of hard delete, we'll mark as inactive
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({ message: 'Vehicle deactivated successfully' })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
