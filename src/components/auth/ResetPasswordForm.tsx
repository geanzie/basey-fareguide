'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'

import Button from '@/ui/Button'
import { Field, Input } from '@/ui/Field'
import PasswordInput from '@/ui/PasswordInput'
import AuthShell from './AuthShell'

const ResetPasswordForm = () => {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [otpValid, setOtpValid] = useState(false)
  const [userInfo, setUserInfo] = useState<{ firstName?: string; lastName?: string } | null>(null)
  const router = useRouter()

  useEffect(() => {
    const savedEmail = sessionStorage.getItem('resetEmail')
    if (savedEmail) {
      setEmail(savedEmail)
    }
  }, [])

  const verifyOtp = async (otpToVerify: string, emailAddress: string) => {
    if (!otpToVerify || !emailAddress) return

    setVerifying(true)
    setError('')

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailAddress, otp: otpToVerify }),
      })

      const data = await response.json()

      if (response.ok) {
        setOtpValid(true)
        setUserInfo(data.user)
      } else {
        setOtpValid(false)
        setError(data.message || 'Invalid or expired OTP code')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp, newPassword }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        sessionStorage.removeItem('resetEmail')
        setTimeout(() => {
          router.push('/auth')
        }, 3000)
      } else {
        setError(data.message || 'Failed to reset password')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Set a new password" subtitle="Enter the 6-digit code sent to your email.">
      {success ? (
        <div className="rounded-xl bg-surface-tint p-6">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="text-sm font-bold text-primary-dark">Password changed</h3>
              <p className="mt-1 text-sm text-ink-body">
                Sign in with your new password. Taking you to sign in...
              </p>
            </div>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error ? (
            <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
              {error}
            </div>
          ) : null}

          {otpValid && userInfo ? (
            <div className="rounded-xl bg-info/10 p-4">
              <p className="inline-flex items-center gap-2 text-sm text-ink-body">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-info" />
                <span>
                  Code verified. Setting a new password for{' '}
                  <strong>
                    {userInfo.firstName} {userInfo.lastName}
                  </strong>
                </span>
              </p>
            </div>
          ) : null}

          <Field label="Email address" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="Code" htmlFor="otp">
            <div className="flex gap-2">
              <Input
                id="otp"
                name="otp"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                required
                maxLength={6}
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              />
              <Button
                variant="secondary"
                loading={verifying}
                disabled={otp.length !== 6}
                onClick={() => verifyOtp(otp, email)}
                className="shrink-0"
              >
                {verifying ? 'Verifying...' : 'Verify'}
              </Button>
            </div>
          </Field>

          <Field label="New password" htmlFor="newPassword">
            <PasswordInput
              id="newPassword"
              name="newPassword"
              autoComplete="new-password"
              required
              disabled={!otpValid}
              placeholder="Enter new password (min 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Field>

          <Field label="Confirm password" htmlFor="confirmPassword">
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              required
              disabled={!otpValid}
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </Field>

          <div className="space-y-2 pt-2">
            <Button type="submit" loading={loading} disabled={!otpValid} className="w-full">
              {loading ? 'Saving...' : 'Save new password'}
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => router.push('/auth')}>
              Back to sign in
            </Button>
          </div>
        </form>
      )}
    </AuthShell>
  )
}

export default ResetPasswordForm
