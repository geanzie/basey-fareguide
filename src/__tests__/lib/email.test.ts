import { afterEach, describe, expect, it } from 'vitest'

import { getPasswordResetEmailCapability, resolveProvider } from '@/lib/email'

const mutableEnv = process.env as Record<string, string | undefined>
const originalNodeEnv = process.env.NODE_ENV
const originalResendApiKey = process.env.RESEND_API_KEY
const originalEmailFrom = process.env.EMAIL_FROM
const originalBrevoApiKey = process.env.BREVO_API_KEY

afterEach(() => {
  mutableEnv.NODE_ENV = originalNodeEnv
  mutableEnv.RESEND_API_KEY = originalResendApiKey
  mutableEnv.EMAIL_FROM = originalEmailFrom
  mutableEnv.BREVO_API_KEY = originalBrevoApiKey
})

describe('email capability', () => {
  it('blocks password reset delivery in production when using the Resend onboarding sender', () => {
    mutableEnv.NODE_ENV = 'production'
    mutableEnv.RESEND_API_KEY = 'test-key'
    mutableEnv.EMAIL_FROM = 'onboarding@resend.dev'

    const capability = getPasswordResetEmailCapability()

    expect(capability.available).toBe(false)
    expect(capability.reason).toMatch(/verified sender domain/i)
  })

  it('falls back to development console mode when Resend is not configured locally', () => {
    mutableEnv.NODE_ENV = 'development'
    mutableEnv.RESEND_API_KEY = ''
    mutableEnv.EMAIL_FROM = ''

    const capability = getPasswordResetEmailCapability()

    expect(capability.available).toBe(true)
    expect(capability.mode).toBe('development_console')
  })
})

describe('resolveProvider', () => {
  it('prefers Brevo when its key + a verified sender are set', () => {
    mutableEnv.NODE_ENV = 'production'
    mutableEnv.BREVO_API_KEY = 'xkeysib-test'
    mutableEnv.RESEND_API_KEY = 're_test'
    mutableEnv.EMAIL_FROM = 'Basey FareCheck <noreply@basey.gov.ph>'
    expect(resolveProvider().provider).toBe('brevo')
  })

  it('rejects a Brevo resend.dev sender in production', () => {
    mutableEnv.NODE_ENV = 'production'
    mutableEnv.BREVO_API_KEY = 'xkeysib-test'
    mutableEnv.RESEND_API_KEY = ''
    mutableEnv.EMAIL_FROM = 'onboarding@resend.dev'
    expect(resolveProvider().provider).toBe('none')
  })

  it('falls back to Resend when only Resend is configured', () => {
    mutableEnv.NODE_ENV = 'production'
    mutableEnv.BREVO_API_KEY = ''
    mutableEnv.RESEND_API_KEY = 're_test'
    mutableEnv.EMAIL_FROM = 'noreply@basey.gov.ph'
    expect(resolveProvider().provider).toBe('resend')
  })
})
