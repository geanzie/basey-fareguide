'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, KeyRound } from 'lucide-react'

import Button from '@/ui/Button'
import { Field, Input } from '@/ui/Field'
import PasswordInput from '@/ui/PasswordInput'

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
    <div className="flex min-h-dvh items-center justify-center bg-ink-strong px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-4 text-[26px] font-extrabold text-white">Reset Your Password</h1>
          <p className="mt-1 text-xs text-ink-muted">Enter the OTP code sent to your email</p>
        </div>

        <div className="rounded-3xl bg-surface p-6 shadow-raised sm:p-8">
          {success ? (
            <div className="rounded-xl bg-surface-tint p-6">
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h3 className="text-sm font-bold text-primary-dark">Password Reset Successful!</h3>
                  <p className="mt-1 text-sm text-ink-body">
                    Your password has been reset successfully. Redirecting to login...
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {error ? (
                <div className="rounded-xl bg-danger-soft px-4 py-3 text-[13px] font-medium text-danger">
                  {error}
                </div>
              ) : null}

              {otpValid && userInfo ? (
                <div className="rounded-xl bg-info/10 p-4">
                  <p className="inline-flex items-center gap-2 text-sm text-ink-body">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-info" />
                    <span>
                      OTP Verified! Resetting password for:{' '}
                      <strong>
                        {userInfo.firstName} {userInfo.lastName}
                      </strong>
                    </span>
                  </p>
                </div>
              ) : null}

              <Field label="Email Address" htmlFor="email">
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

              <Field label="OTP Code" htmlFor="otp" hint="Enter the 6-digit code sent to your email">
                <div className="flex gap-2">
                  <Input
                    id="otp"
                    name="otp"
                    type="text"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    required
                    maxLength={6}
                    placeholder="Enter 6-digit OTP code"
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

              <Field label="New Password" htmlFor="newPassword">
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

              <Field label="Confirm Password" htmlFor="confirmPassword">
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
                  {loading ? 'Resetting...' : 'Reset Password'}
                </Button>
                <Button variant="secondary" className="w-full" onClick={() => router.push('/auth')}>
                  Back to Login
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordForm
