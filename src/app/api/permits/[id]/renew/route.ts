import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { PermitStatus } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { renewedBy, notes } = body

    if (!renewedBy) {
      return NextResponse.json(
        { error: 'renewedBy is required' },
        { status: 400 }
      )
    }

    const existingPermit = await prisma.permit.findUnique({
      where: { id: params.id }
    })

    if (!existingPermit) {
      return NextResponse.json(
        { error: 'Permit not found' },
        { status: 404 }
      )
    }

    // Calculate new expiry date (1 year from current expiry or today, whichever is later)
    const today = new Date()
    const currentExpiry = new Date(existingPermit.expiryDate)
    const baseDate = currentExpiry > today ? currentExpiry : today
    const newExpiry = new Date(baseDate)
    newExpiry.setFullYear(newExpiry.getFullYear() + 1)

    // Use transaction to update permit and create renewal record
    const result = await prisma.$transaction(async (tx) => {
      // Create renewal history record
      await tx.permitRenewal.create({
        data: {
          permitId: params.id,
          previousExpiry: existingPermit.expiryDate,
          newExpiry,
          renewedBy,
          notes
        }
      })

      // Update permit
      const updatedPermit = await tx.permit.update({
        where: { id: params.id },
        data: {
          expiryDate: newExpiry,
          status: PermitStatus.ACTIVE,
          lastUpdatedBy: renewedBy,
          lastUpdatedAt: new Date()
        },
        include: {
          renewalHistory: {
            orderBy: { renewedAt: 'desc' }
          }
        }
      })

      return updatedPermit
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error renewing permit:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}