import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

import { verifyAuthWithSelect } from '@/lib/auth'
import { verifyPassword } from '@/lib/login'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuthWithSelect(request, { password: true })

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized. Please login.' }, { status: 401 })
    }

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { message: 'Current and new password are required' },
        { status: 400 },
      )
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters long' },
        { status: 400 },
      )
    }

    const validCurrent = await verifyPassword(currentPassword, user.password)
    if (!validCurrent) {
      return NextResponse.json({ message: 'Current password is incorrect' }, { status: 400 })
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { message: 'New password must be different from your current password' },
        { status: 400 },
      )
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        loginAttempts: 0,
        lockedUntil: null,
      },
    })

    return NextResponse.json({ message: 'Password changed successfully' })
  } catch {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
