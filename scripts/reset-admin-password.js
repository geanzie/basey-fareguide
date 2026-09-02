/**
 * Operator recovery tool: set a new password for one account directly.
 *
 * Use when the account has no email on file, so the OTP reset flow at
 * /api/auth/request-reset cannot reach it.
 *
 *   ADMIN_NEW_PASSWORD='...' node scripts/reset-admin-password.js
 *   ADMIN_USERNAME=someone ADMIN_NEW_PASSWORD='...' node scripts/reset-admin-password.js
 *
 * Talks to Postgres through `pg` rather than Prisma Client, so it runs on a
 * machine whose generated client was built for another platform. Hash cost 12
 * matches the API routes (src/app/api/auth/reset-password/route.ts).
 */
require('dotenv').config()
const bcrypt = require('bcryptjs')
const { Client } = require('pg')

const MIN_PASSWORD_LENGTH = 8

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim() || 'admin'
  const password = process.env.ADMIN_NEW_PASSWORD

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_NEW_PASSWORD is not set, or is under ${MIN_PASSWORD_LENGTH} characters. ` +
        "Run with e.g. ADMIN_NEW_PASSWORD='...' node scripts/reset-admin-password.js",
    )
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.')
  }

  const hash = await bcrypt.hash(password, 12)
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  try {
    // Clearing the lockout counters matters: a forgotten password usually comes
    // with a handful of failed attempts behind it.
    const { rows } = await client.query(
      `UPDATE users
          SET "password" = $1,
              "hasUsablePassword" = true,
              "loginAttempts" = 0,
              "lockedUntil" = NULL,
              "passwordResetToken" = NULL,
              "passwordResetExpiry" = NULL,
              "passwordResetOtp" = NULL,
              "passwordResetOtpExpiry" = NULL,
              "updatedAt" = NOW()
        WHERE username = $2
        RETURNING username, "userType", "isActive"`,
      [hash, username],
    )

    if (rows.length === 0) {
      throw new Error(`No account found with username "${username}".`)
    }

    const user = rows[0]
    console.log(
      `Password reset for ${user.username} (${user.userType}, active: ${user.isActive}).`,
    )
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
