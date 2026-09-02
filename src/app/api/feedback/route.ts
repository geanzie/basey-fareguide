import { NextRequest, NextResponse } from 'next/server'

import { createAuthErrorResponse, requireRequestUser } from '@/lib/auth'
import {
  FEEDBACK_DAILY_LIMIT,
  FEEDBACK_MESSAGE_MAX_LENGTH,
  FEEDBACK_MESSAGE_MIN_LENGTH,
  isFeedbackCategory,
  isFeedbackRating,
} from '@/lib/feedback/categories'
import { prisma } from '@/lib/prisma'
import { serializeUserFeedback } from '@/lib/serializers'

const DAY_IN_MS = 24 * 60 * 60 * 1000

/** Any signed-in role may tell the municipality how the system is working for them. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRequestUser(request)
    const body = await request.json().catch(() => ({}))

    if (!isFeedbackCategory(body.category)) {
      return NextResponse.json(
        { message: 'Choose what your feedback is about.' },
        { status: 400 },
      )
    }

    if (!isFeedbackRating(body.rating)) {
      return NextResponse.json(
        { message: 'Give a rating from 1 to 5 stars.' },
        { status: 400 },
      )
    }

    const message = typeof body.message === 'string' ? body.message.trim() : ''

    if (message.length < FEEDBACK_MESSAGE_MIN_LENGTH) {
      return NextResponse.json(
        {
          message: `Tell us a little more — at least ${FEEDBACK_MESSAGE_MIN_LENGTH} characters.`,
        },
        { status: 400 },
      )
    }

    if (message.length > FEEDBACK_MESSAGE_MAX_LENGTH) {
      return NextResponse.json(
        {
          message: `Keep your feedback under ${FEEDBACK_MESSAGE_MAX_LENGTH} characters.`,
        },
        { status: 400 },
      )
    }

    // One account can only fill the queue so fast.
    const recentCount = await prisma.userFeedback.count({
      where: {
        userId: user.id,
        createdAt: { gte: new Date(Date.now() - DAY_IN_MS) },
      },
    })

    if (recentCount >= FEEDBACK_DAILY_LIMIT) {
      return NextResponse.json(
        {
          message:
            'You have already sent several messages today. Please try again tomorrow.',
        },
        { status: 429 },
      )
    }

    const feedback = await prisma.userFeedback.create({
      data: {
        userId: user.id,
        category: body.category,
        rating: body.rating,
        message,
      },
    })

    return NextResponse.json(
      { feedback: serializeUserFeedback(feedback) },
      { status: 201 },
    )
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
