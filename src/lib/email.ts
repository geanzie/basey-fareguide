/**
 * Email Service using Resend
 * 
 * Handles sending transactional emails for the application.
 * Configure RESEND_API_KEY in your environment variables.
 */

import { Resend } from 'resend'

// Initialize Resend with API key from environment
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

/**
 * Send an email using Resend
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // Check if email service is configured
  if (!resend) {
    console.warn('Email service not configured. Set RESEND_API_KEY environment variable.')
    console.log(`Would have sent email to ${options.to} with subject: ${options.subject}`)
    return false
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Basey Fare Guide <noreply@baseyfareguide.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })

    if (error) {
      console.error('Failed to send email:', error)
      return false
    }

    console.log('Email sent successfully:', data)
    return true
  } catch (error) {
    console.error('Email service error:', error)
    return false
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  username: string,
  resetToken: string
): Promise<boolean> {
  const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Password Reset Request</title>
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
          background-color: #2563eb;
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
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #2563eb;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
        .token {
          background-color: #f0f0f0;
          padding: 15px;
          border-radius: 5px;
          font-family: monospace;
          word-break: break-all;
          margin: 15px 0;
        }
        .warning {
          color: #dc2626;
          font-weight: bold;
          margin-top: 20px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hello <strong>${username}</strong>,</p>
          
          <p>We received a request to reset your password for your Basey Fare Guide account. If you didn't make this request, please ignore this email.</p>
          
          <p>To reset your password, click the button below:</p>
          
          <center>
            <a href="${resetUrl}" class="button">Reset Password</a>
          </center>
          
          <p>Or copy and paste this link into your browser:</p>
          <div class="token">${resetUrl}</div>
          
          <p class="warning">⚠️ This link will expire in 1 hour.</p>
          
          <p>If you're having trouble with the link, you can also use this reset token directly:</p>
          <div class="token">${resetToken}</div>
          
          <div class="footer">
            <p>This is an automated email from Basey Fare Guide. Please do not reply to this email.</p>
            <p>If you did not request a password reset, please contact support immediately.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `

  const text = `
Password Reset Request

Hello ${username},

We received a request to reset your password for your Basey Fare Guide account.

To reset your password, visit this link:
${resetUrl}

Or use this reset token:
${resetToken}

This link will expire in 1 hour.

If you didn't make this request, please ignore this email.

---
Basey Fare Guide
  `

  return sendEmail({
    to: email,
    subject: 'Password Reset Request - Basey Fare Guide',
    html,
    text,
  })
}

/**
 * Send account verification email
 */
export async function sendAccountVerificationEmail(
  email: string,
  username: string,
  firstName: string
): Promise<boolean> {
  const loginUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Account Approved</title>
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
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #10b981;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Account Approved!</h1>
        </div>
        <div class="content">
          <p>Hello <strong>${firstName}</strong>,</p>
          
          <p>Good news! Your Basey Fare Guide account has been approved by an administrator.</p>
          
          <p><strong>Username:</strong> ${username}</p>
          
          <p>You can now log in and access the system:</p>
          
          <center>
            <a href="${loginUrl}" class="button">Log In Now</a>
          </center>
          
          <p>Thank you for registering with Basey Fare Guide!</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({
    to: email,
    subject: 'Account Approved - Basey Fare Guide',
    html,
  })
}

/**
 * Send incident notification email to enforcer
 */
export async function sendIncidentNotificationEmail(
  email: string,
  incidentId: number,
  incidentType: string,
  location: string
): Promise<boolean> {
  const incidentUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard?incident=${incidentId}`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Incident Report</title>
    </head>
    <body style="font-family: Arial, sans-serif;">
      <h2>New Incident Report</h2>
      <p>A new incident has been reported:</p>
      <ul>
        <li><strong>Incident ID:</strong> ${incidentId}</li>
        <li><strong>Type:</strong> ${incidentType}</li>
        <li><strong>Location:</strong> ${location}</li>
      </ul>
      <p><a href="${incidentUrl}">View Incident Details</a></p>
    </body>
    </html>
  `

  return sendEmail({
    to: email,
    subject: `New Incident Report #${incidentId} - ${incidentType}`,
    html,
  })
}
