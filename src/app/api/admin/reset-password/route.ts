import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { ADMIN_ONLY, requireRequestRole } from '@/lib/auth'
import crypto from 'crypto'
import {
  buildAdminUserFullName,
  type AdminPasswordResetData,
} from '@/lib/admin/user-management-contract'
import {
  createAdminRouteAuthError,
  createAdminRouteError,
  createAdminRouteSuccess,
} from '@/lib/admin/user-management-route'

export async function POST(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_ONLY])

    const { userId, action, newPassword } = await request.json()

    if (!userId || !action) {
      return createAdminRouteError('User ID and action are required', 400)
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        userType: true,
        isActive: true,
      },
    })

    if (!targetUser) {
      return createAdminRouteError('User not found', 404)
    }

    const user = {
      id: targetUser.id,
      username: targetUser.username,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      fullName: buildAdminUserFullName(targetUser.firstName, targetUser.lastName),
      userType: targetUser.userType,
      isActive: targetUser.isActive,
    }

    if (action === 'generate-token') {
      const resetToken = crypto.randomBytes(32).toString('hex')

      const resetExpiry = new Date()
      resetExpiry.setHours(resetExpiry.getHours() + 24)

      await prisma.user.update({
        where: { id: userId },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpiry: resetExpiry,
        },
      })

      const data: AdminPasswordResetData = {
        action: 'generate-token',
        token: resetToken,
        expiresAt: resetExpiry.toISOString(),
        user,
      }

      return createAdminRouteSuccess(data, {
        message: 'Password reset token generated successfully',
      })
    }

    if (action === 'set-password') {
      if (!newPassword) {
        return createAdminRouteError('New password is required', 400)
      }

      if (newPassword.length < 8) {
        return createAdminRouteError('Password must be at least 8 characters long', 400)
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12)

      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpiry: null,
          loginAttempts: 0,
          lockedUntil: null,
        },
      })

      const data: AdminPasswordResetData = {
        action: 'set-password',
        token: null,
        expiresAt: null,
        user,
      }

      return createAdminRouteSuccess(data, {
        message: 'Password successfully reset',
      })
    }

    return createAdminRouteError('Invalid action. Use "generate-token" or "set-password"', 400)
  } catch (error) {
    return createAdminRouteAuthError(error)
  }
}
