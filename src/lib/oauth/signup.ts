import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { OAuthProvider, Prisma, UserType } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { CURRENT_PRIVACY_NOTICE_VERSION } from '@/lib/privacyNotice'

const MAX_USERNAME_ATTEMPTS = 5

/**
 * Derives a username from the provider email. Providers hand us an email and a
 * name but never a username, and `User.username` is required and unique.
 */
export function buildUsernameCandidate(email: string, firstName: string): string {
  const localPart = email.split('@')[0] ?? ''
  const slug = localPart
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[._-]+|[._-]+$/g, '')

  if (slug.length >= 3) {
    return slug.slice(0, 30)
  }

  const fromName = firstName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  if (fromName.length >= 3) {
    return fromName.slice(0, 30)
  }

  return 'user'
}

/** Appends a random 4-digit suffix, keeping the result within 30 characters. */
export function withRandomSuffix(base: string): string {
  const suffix = String(crypto.randomInt(1000, 10000))
  return `${base.slice(0, 30 - suffix.length - 1)}-${suffix}`
}

/**
 * OAuth-only users hold no password. Rather than making `User.password`
 * nullable (which every verifyPassword call site assumes is non-null), store a
 * hash of random bytes nobody knows and flag the account with
 * `hasUsablePassword: false`. They can set a real one via the OTP reset flow.
 */
export async function createUnusablePasswordHash(): Promise<string> {
  return bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12)
}

export interface OAuthSignupInput {
  provider: OAuthProvider
  providerAccountId: string
  email: string
  firstName: string
  lastName: string
  phoneNumber: string
  dateOfBirth: string | null
  barangayResidence: string | null
  idType: string | null
  governmentId: string | null
  registrationIp: string | null
}

/**
 * Creates the PUBLIC user and its provider link in one transaction, retrying
 * on username collisions.
 */
export async function createOAuthUser(input: OAuthSignupInput) {
  const passwordHash = await createUnusablePasswordHash()
  let candidate = buildUsernameCandidate(input.email, input.firstName)

  for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username: candidate,
            password: passwordHash,
            hasUsablePassword: false,
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            phoneNumber: input.phoneNumber,
            dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
            barangayResidence: input.barangayResidence,
            idType: input.idType,
            governmentId: input.governmentId,
            userType: UserType.PUBLIC,
            isActive: true,
            isVerified: true,
            verifiedAt: new Date(),
            verifiedBy: 'AUTO_APPROVED',
            registrationIp: input.registrationIp,
            privacyNoticeAcknowledgedAt: new Date(),
            privacyNoticeVersion: CURRENT_PRIVACY_NOTICE_VERSION,
          },
        })

        await tx.userOAuthAccount.create({
          data: {
            userId: user.id,
            provider: input.provider,
            providerAccountId: input.providerAccountId,
            email: input.email,
            lastLoginAt: new Date(),
          },
        })

        return user
      })
    } catch (error) {
      const isUsernameCollision =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        (Array.isArray(error.meta?.target) ? error.meta.target : []).includes('username')

      if (!isUsernameCollision || attempt === MAX_USERNAME_ATTEMPTS - 1) {
        throw error
      }

      candidate = withRandomSuffix(buildUsernameCandidate(input.email, input.firstName))
    }
  }

  throw new Error('Could not allocate a unique username')
}
