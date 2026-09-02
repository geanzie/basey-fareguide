import { NextRequest, NextResponse } from 'next/server'

import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import {
  FEEDBACK_REVIEW_NOTES_MAX_LENGTH,
  isFeedbackStatus,
} from '@/lib/feedback/categories'
import { prisma } from '@/lib/prisma'
import { serializeAdminUserFeedback } from '@/lib/serializers'

/**
 * Triage one submission. The message itself is never edited — only the review
 * status and the admin's internal notes change.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const adminUser = await requireRequestRole(request, [...ADMIN_ONLY])
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))

    if (!isFeedbackStatus(body.status)) {
      return NextResponse.json(
        { message: 'Choose a valid review status.' },
        { status: 400 },
      )
    }

    const rawNotes = typeof body.reviewNotes === 'string' ? body.reviewNotes.trim() : ''

    if (rawNotes.length > FEEDBACK_REVIEW_NOTES_MAX_LENGTH) {
      return NextResponse.json(
        {
          message: `Keep review notes under ${FEEDBACK_REVIEW_NOTES_MAX_LENGTH} characters.`,
        },
        { status: 400 },
      )
    }

    const existing = await prisma.userFeedback.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json({ message: 'Feedback not found.' }, { status: 404 })
    }

    const feedback = await prisma.userFeedback.update({
      where: { id },
      data: {
        status: body.status,
        reviewNotes: rawNotes || null,
        reviewedById: adminUser.id,
        reviewedAt: new Date(),
      },
      select: {
        id: true,
        userId: true,
        category: true,
        rating: true,
        message: true,
        status: true,
        reviewedById: true,
        reviewedAt: true,
        reviewNotes: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { firstName: true, lastName: true, username: true, userType: true },
        },
        reviewedBy: {
          select: { firstName: true, lastName: true, username: true },
        },
      },
    })

    return NextResponse.json({ feedback: serializeAdminUserFeedback(feedback) })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
