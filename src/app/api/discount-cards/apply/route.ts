import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

/**
 * POST /api/discount-cards/apply
 * Submit a new discount card application
 * 
 * Authorization: Bearer token (PUBLIC users only)
 * 
 * Body (multipart/form-data):
 * - discountType: SENIOR_CITIZEN | PWD | STUDENT
 * - fullName: string
 * - dateOfBirth: string (ISO date)
 * - photo: File (required)
 * - idNumber?: string
 * - idType?: string
 * - issuingAuthority?: string
 * 
 * Student fields:
 * - schoolName?: string
 * - schoolAddress?: string
 * - gradeLevel?: string
 * - schoolIdExpiry?: string (ISO date)
 * 
 * PWD fields:
 * - disabilityType?: string
 * - pwdIdExpiry?: string (ISO date)
 */

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    let decoded: any
    
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret')
    } catch (err) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    const userId = decoded.userId

    // Verify user exists and is PUBLIC type
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        userType: true,
        firstName: true,
        lastName: true,
        discountCard: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (user.userType !== 'PUBLIC') {
      return NextResponse.json(
        { error: 'Only PUBLIC users can apply for discount cards' },
        { status: 403 }
      )
    }

    // Check if user already has a discount card
    if (user.discountCard) {
      return NextResponse.json(
        { 
          error: 'You already have a discount card application',
          existingCard: {
            id: user.discountCard.id,
            status: user.discountCard.verificationStatus
          }
        },
        { status: 409 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    
    const discountType = formData.get('discountType') as string
    const fullName = formData.get('fullName') as string
    const dateOfBirth = formData.get('dateOfBirth') as string
    const photo = formData.get('photo') as File
    
    // Optional fields
    const idNumber = formData.get('idNumber') as string | null
    const idType = formData.get('idType') as string | null
    const issuingAuthority = formData.get('issuingAuthority') as string | null
    
    // Student fields
    const schoolName = formData.get('schoolName') as string | null
    const schoolAddress = formData.get('schoolAddress') as string | null
    const gradeLevel = formData.get('gradeLevel') as string | null
    const schoolIdExpiry = formData.get('schoolIdExpiry') as string | null
    
    // PWD fields
    const disabilityType = formData.get('disabilityType') as string | null
    const pwdIdExpiry = formData.get('pwdIdExpiry') as string | null

    // Validation
    if (!discountType || !['SENIOR_CITIZEN', 'PWD', 'STUDENT'].includes(discountType)) {
      return NextResponse.json(
        { error: 'Invalid discount type' },
        { status: 400 }
      )
    }

    if (!fullName || fullName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Full name is required' },
        { status: 400 }
      )
    }

    if (!dateOfBirth) {
      return NextResponse.json(
        { error: 'Date of birth is required' },
        { status: 400 }
      )
    }

    // Validate age for senior citizen
    if (discountType === 'SENIOR_CITIZEN') {
      const birthDate = new Date(dateOfBirth)
      const today = new Date()
      const age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        // Adjust age if birthday hasn't occurred this year
      }
      
      if (age < 60) {
        return NextResponse.json(
          { error: 'You must be 60 years or older to apply for Senior Citizen discount' },
          { status: 400 }
        )
      }
    }

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo is required' },
        { status: 400 }
      )
    }

    // Validate photo file
    if (!photo.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Photo must be an image file' },
        { status: 400 }
      )
    }

    if (photo.size > 5 * 1024 * 1024) { // 5MB limit
      return NextResponse.json(
        { error: 'Photo file size must be less than 5MB' },
        { status: 400 }
      )
    }

    // Student-specific validation
    if (discountType === 'STUDENT') {
      if (!schoolName || schoolName.trim().length === 0) {
        return NextResponse.json(
          { error: 'School name is required for student discount' },
          { status: 400 }
        )
      }
      if (!gradeLevel || gradeLevel.trim().length === 0) {
        return NextResponse.json(
          { error: 'Grade/Year level is required for student discount' },
          { status: 400 }
        )
      }
      if (!schoolIdExpiry) {
        return NextResponse.json(
          { error: 'School ID expiry date is required' },
          { status: 400 }
        )
      }
    }

    // PWD-specific validation
    if (discountType === 'PWD') {
      if (!disabilityType || disabilityType.trim().length === 0) {
        return NextResponse.json(
          { error: 'Disability type is required for PWD discount' },
          { status: 400 }
        )
      }
      if (!pwdIdExpiry) {
        return NextResponse.json(
          { error: 'PWD ID expiry date is required' },
          { status: 400 }
        )
      }
      if (!idNumber || idNumber.trim().length === 0) {
        return NextResponse.json(
          { error: 'PWD ID number is required' },
          { status: 400 }
        )
      }
    }

    // Save photo to filesystem
    let photoUrl: string
    try {
      const uploadDir = join(process.cwd(), 'public', 'uploads', 'discount-cards')
      await mkdir(uploadDir, { recursive: true })

      const fileExtension = photo.name.split('.').pop()
      const fileName = `${userId}_${randomUUID()}.${fileExtension}`
      const filePath = join(uploadDir, fileName)

      const bytes = await photo.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filePath, buffer)

      photoUrl = `/uploads/discount-cards/${fileName}`
    } catch (fileError: any) {
      console.error('File upload error:', fileError)
      return NextResponse.json(
        { 
          error: 'Failed to save photo file',
          details: fileError.message 
        },
        { status: 500 }
      )
    }

    // Calculate validity dates
    const validFrom = new Date()
    const validUntil = new Date()
    
    if (discountType === 'STUDENT' && schoolIdExpiry) {
      validUntil.setTime(new Date(schoolIdExpiry).getTime())
    } else if (discountType === 'PWD' && pwdIdExpiry) {
      validUntil.setTime(new Date(pwdIdExpiry).getTime())
    } else {
      // Default: 1 year validity
      validUntil.setFullYear(validUntil.getFullYear() + 1)
    }

    // Create discount card application
    const discountCard = await prisma.discountCard.create({
      data: {
        userId,
        discountType: discountType as any,
        fullName: fullName.trim(),
        dateOfBirth: new Date(dateOfBirth),
        photoUrl,
        idNumber: idNumber?.trim() || null,
        idType: idType?.trim() || null,
        issuingAuthority: issuingAuthority?.trim() || null,
        
        // Student fields
        schoolName: schoolName?.trim() || null,
        schoolAddress: schoolAddress?.trim() || null,
        gradeLevel: gradeLevel?.trim() || null,
        schoolIdExpiry: schoolIdExpiry ? new Date(schoolIdExpiry) : null,
        
        // PWD fields
        disabilityType: disabilityType?.trim() || null,
        pwdIdExpiry: pwdIdExpiry ? new Date(pwdIdExpiry) : null,
        
        // Initial status
        verificationStatus: 'PENDING',
        isActive: false,
        validFrom,
        validUntil,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            phoneNumber: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Discount card application submitted successfully',
      application: {
        id: discountCard.id,
        discountType: discountCard.discountType,
        verificationStatus: discountCard.verificationStatus,
        createdAt: discountCard.createdAt,
      }
    }, { status: 201 })

  } catch (error: any) {
    console.error('Error submitting discount application:', error)
    return NextResponse.json(
      { 
        error: 'Failed to submit application',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
