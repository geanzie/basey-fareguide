import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { validateIDImage } from '@/lib/idValidation'

/**
 * GET /api/discount-cards/my-application
 * Retrieve the authenticated user's discount card application status
 * 
 * Authorization: Bearer token (PUBLIC users only)
 * 
 * Returns:
 * - hasApplication: boolean
 * - application: DiscountCard object or null
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
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

    // Get user's discount card application
    const discountCard = await prisma.discountCard.findUnique({
      where: { userId },
      select: {
        id: true,
        discountType: true,
        fullName: true,
        dateOfBirth: true,
        photoUrl: true,
        idNumber: true,
        idType: true,
        issuingAuthority: true,
        schoolName: true,
        schoolAddress: true,
        gradeLevel: true,
        schoolIdExpiry: true,
        disabilityType: true,
        pwdIdExpiry: true,
        verificationStatus: true,
        verifiedBy: true,
        verifiedAt: true,
        verificationNotes: true,
        rejectionReason: true,
        isAdminOverride: true,
        overrideReason: true,
        isActive: true,
        validFrom: true,
        validUntil: true,
        lastUsedAt: true,
        usageCount: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    if (!discountCard) {
      return NextResponse.json({
        hasApplication: false,
        application: null
      })
    }

    return NextResponse.json({
      hasApplication: true,
      application: discountCard
    })
      } catch (error: any) {    return NextResponse.json(
      { 
        error: 'Failed to fetch application status',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/discount-cards/my-application
 * Update/resubmit a rejected discount card application
 * 
 * Authorization: Bearer token (PUBLIC users only)
 * 
 * Body (multipart/form-data):
 * - Same fields as POST /api/discount-cards/apply
 * 
 * Only allowed for REJECTED applications
 */
export async function PATCH(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
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

    // Check existing application
    const existingCard = await prisma.discountCard.findUnique({
      where: { userId },
      select: {
        id: true,
        verificationStatus: true,
        photoUrl: true,
      }
    })

    if (!existingCard) {
      return NextResponse.json(
        { error: 'No existing application found' },
        { status: 404 }
      )
    }

    // Only allow updates for REJECTED applications
    if (existingCard.verificationStatus !== 'REJECTED') {
      return NextResponse.json(
        { 
          error: 'Can only update rejected applications',
          currentStatus: existingCard.verificationStatus
        },
        { status: 400 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    
    const discountType = formData.get('discountType') as string
    const fullName = formData.get('fullName') as string
    const dateOfBirth = formData.get('dateOfBirth') as string
    const photo = formData.get('photo') as File | null
    
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

    // Validation (same as POST)
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
      
      if (age < 60) {
        return NextResponse.json(
          { error: 'You must be 60 years or older to apply for Senior Citizen discount' },
          { status: 400 }
        )
      }
    }

    // Handle photo upload if new photo provided
    let photoUrl = existingCard.photoUrl

    if (photo) {
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

      // Validate ID image before saving
      try {
        const bytes = await photo.arrayBuffer()
        const buffer = Buffer.from(bytes)

        const idValidation = await validateIDImage(buffer, {
          userName: fullName,
          idNumber: idNumber || undefined,
          dateOfBirth,
          idType: idType || undefined,
          discountType: discountType as 'SENIOR_CITIZEN' | 'PWD' | 'STUDENT',
        })

        // Log validation result for admin review
          userId,
          isValid: idValidation.isValid,
          confidence: idValidation.confidence,
          reasons: idValidation.reasons
        })

        // Reject if validation fails (below 60% confidence)
        if (!idValidation.isValid || idValidation.confidence < 60) {
          return NextResponse.json(
            { 
              error: 'ID validation failed',
              details: 'The uploaded image does not appear to be a valid ID. ' + 
                      idValidation.reasons.join('. '),
              validationResult: idValidation
            },
            { status: 400 }
          )
        }

        // Save new photo
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'discount-cards')
        await mkdir(uploadDir, { recursive: true })

        const fileExtension = photo.name.split('.').pop()
        const fileName = `${userId}_${randomUUID()}.${fileExtension}`
        const filePath = join(uploadDir, fileName)

        await writeFile(filePath, buffer)
        photoUrl = `/uploads/discount-cards/${fileName}`

        // Store validation result for admin review
        // (You can optionally add a field to the database to store this)
      } catch (fileError: any) {        return NextResponse.json(
          { 
            error: 'Failed to save or validate photo file',
            details: fileError.message 
          },
          { status: 500 }
        )
      }
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

    // Calculate new validity dates
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

    // Update the discount card application
    const updatedCard = await prisma.discountCard.update({
      where: { id: existingCard.id },
      data: {
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
        
        // Reset status to PENDING
        verificationStatus: 'PENDING',
        rejectionReason: null,
        verifiedBy: null,
        verifiedAt: null,
        verificationNotes: null,
        isActive: false,
        validFrom,
        validUntil,
      },
      select: {
        id: true,
        discountType: true,
        verificationStatus: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Application updated and resubmitted successfully',
      application: updatedCard
    })
      } catch (error: any) {    return NextResponse.json(
      { 
        error: 'Failed to update application',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
