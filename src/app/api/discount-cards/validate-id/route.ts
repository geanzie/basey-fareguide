import { NextRequest, NextResponse } from 'next/server'
import { validateIDImage } from '@/lib/idValidation'
import { verifyAuth } from '@/lib/auth'

/**
 * POST /api/discount-cards/validate-id
 * Validates if uploaded image is a legitimate ID card
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get form data
    const formData = await request.formData()
    const photo = formData.get('photo') as File | null
    const userName = formData.get('userName') as string
    const idNumber = formData.get('idNumber') as string | undefined
    const dateOfBirth = formData.get('dateOfBirth') as string | undefined
    const idType = formData.get('idType') as string | undefined
    const discountType = formData.get('discountType') as 'SENIOR_CITIZEN' | 'PWD' | 'STUDENT'

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo file is required' },
        { status: 400 }
      )
    }

    if (!userName || !discountType) {
      return NextResponse.json(
        { error: 'User name and discount type are required' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const bytes = await photo.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Validate the ID image
    const validationResult = await validateIDImage(buffer, {
      userName,
      idNumber,
      dateOfBirth,
      idType,
      discountType,
    })

    // Return validation result
    return NextResponse.json({
      isValid: validationResult.isValid,
      confidence: validationResult.confidence,
      reasons: validationResult.reasons,
      detectedInfo: validationResult.detectedInfo,
      message: validationResult.isValid
        ? 'ID appears to be valid'
        : 'ID validation failed. Please ensure the image is clear and contains your information.',
    })
      } catch (error) {    return NextResponse.json(
      { 
        error: 'Failed to validate ID',
        details: (error as Error).message 
      },
      { status: 500 }
    )
  }
}
