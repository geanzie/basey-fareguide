import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const {
      username,
      password,
      firstName,
      lastName,
      phoneNumber,
      dateOfBirth,
      governmentId,
      idType,
      barangayResidence,
      userType
    } = await request.json()

    // Validate required fields
    if (!username || !password || !firstName || !lastName || !phoneNumber) {
      return NextResponse.json(
        { message: 'All required fields must be provided' },
        { status: 400 }
      )
    }

    // Validate idType is provided
    if (!idType || idType.trim() === '') {
      return NextResponse.json(
        { message: 'Government ID Type is required' },
        { status: 400 }
      )
    }

    // Validate governmentId is provided
    if (!governmentId || governmentId.trim() === '') {
      return NextResponse.json(
        { message: 'Government ID Number is required' },
        { status: 400 }
      )
    }

    // Validate barangayResidence is provided
    if (!barangayResidence || barangayResidence.trim() === '') {
      return NextResponse.json(
        { message: 'Barangay of Residence is required' },
        { status: 400 }
      )
    }

    // Validate phone number format (Philippine mobile)
    const phoneRegex = /^(09|\+639)\d{9}$/
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      return NextResponse.json(
        { message: 'Please enter a valid Philippine mobile number' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Validate user type
    const validUserTypes = ['PUBLIC', 'ENFORCER', 'DATA_ENCODER']
    if (!validUserTypes.includes(userType)) {
      return NextResponse.json(
        { message: 'Invalid user type' },
        { status: 400 }
      )
    }

    // Check for existing username in database
    const existingUser = await prisma.user.findUnique({
      where: { username }
    })
    
    if (existingUser) {
      return NextResponse.json(
        { message: 'Username already taken' },
        { status: 409 }
      )
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Set approval status based on user type
    // PUBLIC users are auto-approved, official roles need admin approval
    const isPublicUser = userType === 'PUBLIC'
    
    // Save user to database
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        firstName,
        lastName,
        phoneNumber,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        governmentId: governmentId.trim(),
        idType: idType.trim(),
        barangayResidence: barangayResidence.trim(),
        userType,
        isActive: isPublicUser, // Public users are immediately active
        isVerified: isPublicUser, // Public users are immediately verified
        verifiedAt: isPublicUser ? new Date() : null,
        verifiedBy: isPublicUser ? 'AUTO_APPROVED' : null
      }
    })

    const message = isPublicUser 
      ? 'Registration successful! You can now log in to your account.'
      : 'Registration successful! Your account will be activated after admin approval.'

    return NextResponse.json({
      message,
      userId: newUser.id,
      requiresApproval: !isPublicUser,
      canLoginImmediately: isPublicUser
    }, { status: 201 })
      } catch (error) {    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
