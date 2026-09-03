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

export interface MarkPermitQrPrintedInput {
  permitIds: string[]
  printedBy: string
}

export interface MarkPermitQrPrintedResult {
  markedIds: string[]
  skippedIds: string[]
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
            // A new token kills the sticker already pasted on the vehicle, so the
            // permit goes back to the print queue.
            qrPrintedAt: null,
            qrPrintedBy: null,
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

export async function markPermitQrPrinted(
  input: MarkPermitQrPrintedInput,
): Promise<MarkPermitQrPrintedResult> {
  const uniqueIds = Array.from(new Set(input.permitIds))

  if (uniqueIds.length === 0) {
    return { markedIds: [], skippedIds: [] }
  }

  const permits = await prisma.permit.findMany({
    where: {
      id: { in: uniqueIds },
    },
    select: {
      id: true,
      permitPlateNumber: true,
      qrToken: true,
    },
  })

  const printable = permits.filter(
    (permit): permit is typeof permit & { qrToken: string } => Boolean(permit.qrToken),
  )
  const printableIds = new Set(printable.map((permit) => permit.id))
  const skippedIds = uniqueIds.filter((id) => !printableIds.has(id))

  if (printable.length === 0) {
    return { markedIds: [], skippedIds }
  }

  const printedAt = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.permit.updateMany({
      where: {
        id: { in: printable.map((permit) => permit.id) },
      },
      data: {
        qrPrintedAt: printedAt,
        qrPrintedBy: input.printedBy,
      },
    })

    for (const permit of printable) {
      await createPermitQrAudit(tx, {
        permitId: permit.id,
        permitPlateNumber: permit.permitPlateNumber,
        action: 'PRINT_QR',
        actedBy: input.printedBy,
        currentToken: permit.qrToken,
      })
    }
  })

  return { markedIds: printable.map((permit) => permit.id), skippedIds }
}
