import { Prisma, type PermitQrAuditAction, type VehicleType } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { fingerprintQrToken, generateQrToken } from '@/lib/permits/qrToken'

export interface CreatePermitWithQrInput {
  vehicleId: string
  permitPlateNumber: string
  driverFullName: string
  vehicleType: VehicleType
  encodedBy: string
  remarks?: string | null
}

export interface IssuePermitQrTokenInput {
  permitId: string
  issuedBy: string
}

function isQrTokenUniqueConstraint(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    error.meta?.target.includes('qrToken')
  )
}

function createPermitQrAudit(
  tx: Prisma.TransactionClient,
  input: {
    permitId: string
    permitPlateNumber: string
    action: PermitQrAuditAction
    actedBy: string
    previousToken?: string | null
    currentToken: string
  },
) {
  return tx.permitQrAudit.create({
    data: {
      permitId: input.permitId,
      permitPlateNumber: input.permitPlateNumber,
      action: input.action,
      actedBy: input.actedBy,
      previousTokenFingerprint: input.previousToken ? fingerprintQrToken(input.previousToken) : null,
      currentTokenFingerprint: fingerprintQrToken(input.currentToken),
    },
  })
}

export async function createPermitWithQr(input: CreatePermitWithQrInput) {
  const expiryDate = new Date()
  expiryDate.setFullYear(expiryDate.getFullYear() + 1)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const qrToken = generateQrToken()
      const issuedAt = new Date()

      return await prisma.$transaction(async (tx) => {
        const permit = await tx.permit.create({
          data: {
            vehicleId: input.vehicleId,
            permitPlateNumber: input.permitPlateNumber.toUpperCase(),
            qrToken,
            qrIssuedAt: issuedAt,
            qrIssuedBy: input.encodedBy,
            driverFullName: input.driverFullName,
            vehicleType: input.vehicleType,
            expiryDate,
            encodedBy: input.encodedBy,
            remarks: input.remarks,
            status: 'ACTIVE',
          },
          include: {
            renewalHistory: true,
            vehicle: {
              select: {
                id: true,
                plateNumber: true,
                make: true,
                model: true,
                ownerName: true,
                vehicleType: true,
              },
            },
          },
        })

        await createPermitQrAudit(tx, {
          permitId: permit.id,
          permitPlateNumber: permit.permitPlateNumber,
          action: 'ISSUE_QR',
          actedBy: input.encodedBy,
          currentToken: qrToken,
        })

        return permit
      })
    } catch (error) {
      if (isQrTokenUniqueConstraint(error) && attempt < 4) {
        continue
      }

      throw error
    }
  }

  throw new Error('Unable to generate a unique QR token for permit creation')
}

export async function issuePermitQrToken(input: IssuePermitQrTokenInput) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const qrToken = generateQrToken()
      const issuedAt = new Date()

      return await prisma.$transaction(async (tx) => {
        const existingPermit = await tx.permit.findUnique({
          where: {
            id: input.permitId,
          },
          select: {
            id: true,
            permitPlateNumber: true,
            qrToken: true,
          },
        })

        if (!existingPermit) {
          throw new Error('Permit not found')
        }

        const permit = await tx.permit.update({
          where: {
            id: input.permitId,
          },
          data: {
            qrToken,
            qrIssuedAt: issuedAt,
            qrIssuedBy: input.issuedBy,
          },
          include: {
            renewalHistory: {
              orderBy: { renewedAt: 'desc' },
            },
            vehicle: {
              select: {
                id: true,
                plateNumber: true,
                make: true,
                model: true,
                ownerName: true,
                vehicleType: true,
              },
            },
          },
        })

        await createPermitQrAudit(tx, {
          permitId: existingPermit.id,
          permitPlateNumber: existingPermit.permitPlateNumber,
          action: existingPermit.qrToken ? 'ROTATE_QR' : 'ISSUE_QR',
          actedBy: input.issuedBy,
          previousToken: existingPermit.qrToken,
          currentToken: qrToken,
        })

        return permit
      })
    } catch (error) {
      if (isQrTokenUniqueConstraint(error) && attempt < 4) {
        continue
      }

      throw error
    }
  }

  throw new Error('Unable to generate a unique QR token for this permit')
}