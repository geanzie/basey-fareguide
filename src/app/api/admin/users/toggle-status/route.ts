import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ADMIN_ONLY, requireRequestRole } from '@/lib/auth'
import { type AdminToggleUserStatusData } from '@/lib/admin/user-management-contract'
import {
  createAdminRouteAuthError,
  createAdminRouteError,
  createAdminRouteSuccess,
} from '@/lib/admin/user-management-route'

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireRequestRole(request, [...ADMIN_ONLY])
    const body = await request.json()
    const { userId, isActive } = body

    if (!userId) {
      return createAdminRouteError('Missing required fields', 400)
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          isActive: true,
        },
      })

      if (!user) {
        throw new Error('User not found')
      }

      const newStatus = typeof isActive === 'boolean' ? isActive : !user.isActive

      await tx.user.update({
        where: { id: userId },
        data: {
          isActive: newStatus,
        },
      })

      await tx.userVerificationLog.create({
        data: {
          userId,
          action: newStatus ? 'ACTIVATED' : 'DEACTIVATED',
          performedBy: adminUser.id,
          reason: `User ${newStatus ? 'activated' : 'deactivated'} by admin`,
        },
      })

      return {
        userId,
        isActive: newStatus,
      }
    })

    const data: AdminToggleUserStatusData = result

    return createAdminRouteSuccess(data, {
      message: result.isActive ? 'Account activated successfully' : 'Account deactivated successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      return createAdminRouteError(error.message, 404)
    }

    return createAdminRouteAuthError(error)
  }
}
