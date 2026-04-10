/**
 * Email Service using Resend
 * 
 * Handles sending transactional emails for the application.
 * Configure RESEND_API_KEY in your environment variables.
 */

import { Resend } from 'resend'

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export type EmailDeliveryMode = 'provider' | 'development_console'

export interface EmailCapability {
  available: boolean
  mode: EmailDeliveryMode
  from?: string
  reason?: string
}

export interface EmailSendResult {
  success: boolean
  mode: EmailDeliveryMode
  reason?: string
}

const DEFAULT_DEV_EMAIL_FROM = 'Basey Fare Check <onboarding@resend.dev>'

function isDevelopmentMode(): boolean {
  return process.env.NODE_ENV !== 'production'
}

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  return apiKey ? new Resend(apiKey) : null
}

function extractEmailAddress(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(/<([^>]+)>/)
  return (match?.[1] ?? trimmed).trim().toLowerCase()
}

function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function resolveEmailCapability(): EmailCapability {
  const resend = getResendClient()
  const configuredFrom = process.env.EMAIL_FROM?.trim()

  if (!resend) {
    if (isDevelopmentMode()) {
      return {
        available: true,
        mode: 'development_console',
        from: DEFAULT_DEV_EMAIL_FROM,
      }
    }

    return {
      available: false,
      mode: 'provider',
      reason: 'RESEND_API_KEY is not configured for production email delivery.',
    }
  }

  if (!configuredFrom) {
    if (isDevelopmentMode()) {
      return {
        available: true,
        mode: 'development_console',
        from: DEFAULT_DEV_EMAIL_FROM,
      }
    }

    return {
      available: false,
      mode: 'provider',
      reason: 'EMAIL_FROM is not configured for production email delivery.',
    }
  }

  const senderEmail = extractEmailAddress(configuredFrom)
  if (!isValidEmailAddress(senderEmail)) {
    return {
      available: false,
      mode: 'provider',
      reason: 'EMAIL_FROM is not a valid sender address.',
    }
  }

  if (senderEmail.endsWith('@resend.dev')) {
    if (isDevelopmentMode()) {
      return {
        available: true,
        mode: 'development_console',
        from: DEFAULT_DEV_EMAIL_FROM,
      }
    }

    return {
      available: false,
      mode: 'provider',
      reason: 'EMAIL_FROM is still using Resend onboarding sender. Configure a verified sender domain for production password reset emails.',
    }
  }

  return {
    available: true,
    mode: 'provider',
    from: configuredFrom,
  }
}

export function getPasswordResetEmailCapability(): EmailCapability {
  return resolveEmailCapability()
}

/**
 * Send an email using Resend
 */
export async function sendEmail(options: EmailOptions): Promise<EmailSendResult> {
  const capability = resolveEmailCapability()

  if (!capability.available) {
    console.warn('Email service unavailable:', capability.reason)
    return {
      success: false,
      mode: capability.mode,
      reason: capability.reason,
    }
  }

  if (capability.mode === 'development_console') {
    console.log(`Would have sent email to ${options.to} with subject: ${options.subject}`)
    return {
      success: true,
      mode: 'development_console',
    }
  }

  try {
    const resend = getResendClient()
    if (!resend || !capability.from) {
      return {
        success: false,
        mode: 'provider',
        reason: 'Resend client is unavailable.',
      }
    }

    const { data, error } = await resend.emails.send({
      from: capability.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })

    if (error) {
      console.error('Failed to send email:', error)
      return {
        success: false,
        mode: 'provider',
        reason: typeof error.message === 'string' ? error.message : 'Email provider rejected the message.',
      }
    }

    console.log('Email sent successfully:', data)
    return {
      success: true,
      mode: 'provider',
    }
  } catch (error) {
    console.error('Email service error:', error)
    return {
      success: false,
      mode: 'provider',
      reason: error instanceof Error ? error.message : 'Email service error.',
    }
  }
}

/**
 * Send OTP code via email for password reset
 */
export async function sendOTPEmail(
  email: string,
  username: string,
  otp: string
): Promise<EmailSendResult> {
  const capability = getPasswordResetEmailCapability()

  if (!capability.available) {
    return {
      success: false,
      mode: capability.mode,
      reason: capability.reason,
    }
  }

  if (capability.mode === 'development_console') {
    console.log('='.repeat(60))
    console.log('📧 EMAIL NOTIFICATION (Development Mode - No API Key)')
    console.log('='.repeat(60))
    console.log(`To: ${email}`)
    console.log(`User: ${username}`)
    console.log(`OTP Code: ${otp}`)
    console.log(`Valid for: 10 minutes`)
    console.log('='.repeat(60))
    return {
      success: true,
      mode: 'development_console',
    }
  }

  // Log in development for debugging (but still send email)
  if (process.env.NODE_ENV === 'development') {
    console.log('='.repeat(60))
    console.log('📧 SENDING EMAIL (Development Mode)')
    console.log('='.repeat(60))
    console.log(`To: ${email}`)
    console.log(`User: ${username}`)
    console.log(`OTP Code: ${otp}`)
    console.log('='.repeat(60))
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Password Reset OTP</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background-color: #f9f9f9;
          border: 1px solid #ddd;
          border-radius: 5px;
          padding: 30px;
        }
        .header {
          background-color: #10b981;
          color: white;
          padding: 20px;
          border-radius: 5px 5px 0 0;
          text-align: center;
        }
        .content {
          background-color: white;
          padding: 30px;
          border-radius: 0 0 5px 5px;
        }
        .otp-code {
          background-color: #f3f4f6;
          border: 2px dashed #10b981;
          padding: 20px;
          text-align: center;
          font-size: 32px;
          font-weight: bold;
          letter-spacing: 8px;
          margin: 20px 0;
          border-radius: 5px;
          color: #10b981;
        }
        .warning {
          background-color: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 12px;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          color: #666;
          font-size: 12px;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">🔐 Password Reset OTP</h1>
        </div>
        <div class="content">
          <p>Hello <strong>${username}</strong>,</p>
          
          <p>You requested to reset your password for your Basey Fare Check account. Use the following One-Time Password (OTP) to complete your password reset:</p>
          
          <div class="otp-code">
            ${otp}
          </div>
          
          <p style="text-align: center; color: #666;">
            <strong>This code is valid for 10 minutes.</strong>
          </p>
          
          <div class="warning">
            <strong>⚠️ Security Notice:</strong>
            <ul style="margin: 5px 0;">
              <li>Never share this code with anyone</li>
              <li>Basey Fare Check staff will never ask for this code</li>
              <li>If you didn't request this, please ignore this email</li>
            </ul>
          </div>
          
          <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
          
          <p>Need help? Contact our support team.</p>
        </div>
        <div class="footer">
          <p>This is an automated message from Basey Fare Check</p>
          <p>Please do not reply to this email</p>
        </div>
      </div>
    </body>
    </html>
  `

  const text = `
Password Reset OTP

Hello ${username},

You requested to reset your password for your Basey Fare Check account.

Your OTP Code: ${otp}

This code is valid for 10 minutes.

SECURITY NOTICE:
- Never share this code with anyone
- Basey Fare Check staff will never ask for this code
- If you didn't request this, please ignore this email

If you didn't request a password reset, you can safely ignore this email.

---
Basey Fare Check
  `

  return sendEmail({
    to: email,
    subject: 'Password Reset OTP - Basey Fare Check',
    html,
    text,
  })
}
