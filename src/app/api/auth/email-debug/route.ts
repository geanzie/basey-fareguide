import { NextResponse } from 'next/server'
import { resolveProvider, getPasswordResetEmailCapability } from '@/lib/email'

/**
 * TEMPORARY diagnostic for the password-reset email setup.
 * Reports which provider resolves and why — WITHOUT exposing secret keys.
 * Delete this route once forgot-password is confirmed working.
 */
export async function GET() {
  const r = resolveProvider()
  const cap = getPasswordResetEmailCapability()
  const from = process.env.EMAIL_FROM?.trim() ?? null

  return NextResponse.json({
    provider: r.provider,
    available: cap.available,
    reason: r.reason ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    hasBrevoKey: Boolean(process.env.BREVO_API_KEY?.trim()),
    hasResendKey: Boolean(process.env.RESEND_API_KEY?.trim()),
    emailFrom: from,
  })
}
