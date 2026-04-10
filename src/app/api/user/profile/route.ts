import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuthErrorResponse, requireRequestUser, verifyAuthWithSelect } from '@/lib/auth'
import { serializeUserProfile } from '@/lib/serializers'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await verifyAuthWithSelect(request, {
      email: true,
      phoneNumber: true,
      dateOfBirth: true,
      governmentId: true,
      idType: true,
      barangayResidence: true,
      createdAt: true,
    })

    if (!currentUser) {
      throw new Error('Unauthorized')
    }

    return NextResponse.json({ user: serializeUserProfile(currentUser) })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireRequestUser(request)

    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      dateOfBirth,
      governmentId,
      idType,
      barangayResidence
    } = await request.json()

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { message: 'Please enter a valid email address' },
          { status: 400 }
        )
      }

      // Check if email is already taken by another user
      const existingEmail = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase(),
          NOT: { id: user.id }
        }
      })

      if (existingEmail) {
        return NextResponse.json(
          { message: 'Email address already in use' },
          { status: 409 }
        )
      }
    }

    // Validate phone number format (Philippine mobile)
    if (phoneNumber) {
      const phoneRegex = /^(09|\+639)\d{9}$/
      if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
        return NextResponse.json(
          { message: 'Please enter a valid Philippine mobile number' },
          { status: 400 }
        )
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName,
        lastName,
        email: email ? email.toLowerCase() : null,
        phoneNumber,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        governmentId: governmentId || null,
        idType: idType || null,
        barangayResidence: barangayResidence || null
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        dateOfBirth: true,
        governmentId: true,
        idType: true,
        barangayResidence: true,
        userType: true,
        isActive: true,
        isVerified: true,
        createdAt: true
      }
    })

    return NextResponse.json({ 
      message: 'Profile updated successfully',
      user: serializeUserProfile(updatedUser) 
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
