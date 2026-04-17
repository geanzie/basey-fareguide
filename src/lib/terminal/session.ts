import crypto from 'crypto'
import type { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import {
  TERMINAL_UNLOCK_COOKIE_NAME,
  TERMINAL_UNLOCK_IDLE_TIMEOUT_MS,
  TERMINAL_UNLOCK_MAX_AGE_SECONDS,
} from '@/lib/terminal/constants'

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function buildExpiryDate(): Date {
  return new Date(Date.now() + TERMINAL_UNLOCK_IDLE_TIMEOUT_MS)
}

function buildCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge,
    path: '/',
  }
}

export function getTerminalUnlockToken(request: NextRequest): string | null {
  return request.cookies.get(TERMINAL_UNLOCK_COOKIE_NAME)?.value ?? null
}

export async function createTerminalUnlockSession(userId: string) {
  const rawToken = crypto.randomBytes(24).toString('base64url')
  const now = new Date()
  const expiresAt = buildExpiryDate()

  await prisma.terminalUnlockSession.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt,
      lastActivityAt: now,
    },
  })

  return {
    token: rawToken,
    expiresAt,
    lastActivityAt: now,
  }
}

export function applyTerminalUnlockCookie(response: NextResponse, rawToken: string): void {
  response.cookies.set(
    TERMINAL_UNLOCK_COOKIE_NAME,
    rawToken,
    buildCookieOptions(TERMINAL_UNLOCK_MAX_AGE_SECONDS),
  )
}

export function clearTerminalUnlockCookie(response: NextResponse): void {
  response.cookies.set(TERMINAL_UNLOCK_COOKIE_NAME, '', buildCookieOptions(0))
}

export async function invalidateTerminalUnlockSessionByToken(rawToken: string | null): Promise<void> {
  if (!rawToken) {
    return
  }

  await prisma.terminalUnlockSession.deleteMany({
    where: {
      tokenHash: hashToken(rawToken),
    },
  })
}

export async function invalidateTerminalUnlockSession(request: NextRequest): Promise<void> {
  await invalidateTerminalUnlockSessionByToken(getTerminalUnlockToken(request))
}

export async function getTerminalUnlockSession(request: NextRequest, userId: string) {
  const rawToken = getTerminalUnlockToken(request)

  if (!rawToken) {
    return null
  }

  const session = await prisma.terminalUnlockSession.findUnique({
    where: {
      tokenHash: hashToken(rawToken),
    },
  })

  if (!session || session.userId !== userId) {
    return null
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.terminalUnlockSession.delete({
      where: { id: session.id },
    }).catch(() => {})

    return null
  }

  return session
}

export async function touchTerminalUnlockSession(sessionId: string) {
  const now = new Date()
  const expiresAt = buildExpiryDate()

  return prisma.terminalUnlockSession.update({
    where: { id: sessionId },
    data: {
      lastActivityAt: now,
      expiresAt,
    },
  })
}

/**
 * Delete all TerminalUnlockSession rows whose expiresAt is in the past.
 * Safe to call from an admin sweep endpoint or a background job.
 * Returns the number of deleted sessions.
 */
export async function expireAllStaleTerminalUnlockSessions(now?: Date): Promise<number> {
  const cutoff = now ?? new Date()
  const result = await prisma.terminalUnlockSession.deleteMany({
    where: {
      expiresAt: { lte: cutoff },
    },
  })
  return result.count
}
