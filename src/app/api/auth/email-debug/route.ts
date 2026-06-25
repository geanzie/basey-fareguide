import { NextRequest, NextResponse } from 'next/server'
import { resolveProvider, getPasswordResetEmailCapability } from '@/lib/email'

/**
 * TEMPORARY diagnostic for the password-reset email setup.
 * Reports which provider resolves and why — WITHOUT exposing secret keys.
 *
 *   GET /api/auth/email-debug          → config snapshot (no send)
 *   GET /api/auth/email-debug?test=1   → live test send to the sender's OWN
 *                                        address, returns Brevo's raw verdict
 *
 * The test send only targets EMAIL_FROM's own address (no abuse vector).
 * Delete this route once forgot-password is confirmed working.
 */

function extractEmailAddress(value: string): string {
  const match = value.trim().match(/<([^>]+)>/)
  return (match?.[1] ?? value).trim().toLowerCase()
}

export async function GET(request: NextRequest) {
  const r = resolveProvider()
  const cap = getPasswordResetEmailCapability()
  const from = process.env.EMAIL_FROM?.trim() ?? null

  const base = {
    provider: r.provider,
    available: cap.available,
    reason: r.reason ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    hasBrevoKey: Boolean(process.env.BREVO_API_KEY?.trim()),
    hasResendKey: Boolean(process.env.RESEND_API_KEY?.trim()),
    emailFrom: from,
  }

  const wantsTest = request.nextUrl.searchParams.get('test') === '1'
  if (!wantsTest) {
    return NextResponse.json(base)
  }

  const apiKey = process.env.BREVO_API_KEY?.trim()
  if (!apiKey || !from) {
    return NextResponse.json({ ...base, test: 'skipped: BREVO_API_KEY or EMAIL_FROM missing' })
  }

  const senderEmail = extractEmailAddress(from)
  const nameMatch = from.match(/^(.*)<[^>]+>/)
  const senderName = nameMatch?.[1]?.trim() || 'Basey FareCheck'

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: senderEmail }],
        subject: 'Basey FareCheck — email delivery test',
        htmlContent: '<p>Brevo test send from the email-debug endpoint.</p>',
        textContent: 'Brevo test send from the email-debug endpoint.',
      }),
    })
    const body = await res.text().catch(() => '')
    return NextResponse.json({
      ...base,
      test: { ok: res.ok, brevoStatus: res.status, brevoBody: body },
    })
  } catch (error) {
    return NextResponse.json({
      ...base,
      test: { ok: false, error: error instanceof Error ? error.message : 'fetch failed' },
    })
  }
}
