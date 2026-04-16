import { NextRequest } from 'next/server'

import { ADMIN_ONLY, requireRequestRole } from '@/lib/auth'
import { type AdminDriverOptionsData } from '@/lib/admin/user-management-contract'
import { createAdminRouteAuthError, createAdminRouteSuccess } from '@/lib/admin/user-management-route'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_ONLY])

    const vehicles = await prisma.vehicle.findMany({
      where: {
        isActive: true,
        assignedDriver: null,
        OR: [
          {
            driverName: {
              not: null,
            },
          },
          {
            permit: {
              is: {
                driverFullName: {
                  not: '',
                },
              },
            },
          },
        ],
      },
      orderBy: [{ plateNumber: 'asc' }],
      select: {
        id: true,
        plateNumber: true,
        vehicleType: true,
        driverName: true,
        driverLicense: true,
        permit: {
          select: {
            permitPlateNumber: true,
            driverFullName: true,
          },
        },
      },
    })

    const data: AdminDriverOptionsData = {
      drivers: vehicles
        .map((vehicle) => {
          const driverName = vehicle.permit?.driverFullName?.trim() || vehicle.driverName?.trim() || ''

          if (!driverName) {
            return null
          }

          return {
            vehicleId: vehicle.id,
            driverName,
            driverLicense: vehicle.driverLicense ?? null,
            username: vehicle.plateNumber,
            plateNumber: vehicle.plateNumber,
            vehicleType: vehicle.vehicleType,
            permitPlateNumber: vehicle.permit?.permitPlateNumber ?? null,
          }
        })
        .filter((driverOption): driverOption is NonNullable<typeof driverOption> => driverOption !== null),
    }

    return createAdminRouteSuccess(data)
  } catch (error) {
    return createAdminRouteAuthError(error)
  }
}