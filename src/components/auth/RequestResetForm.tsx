'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Info, KeyRound } from 'lucide-react'

import Button from '@/ui/Button'
import { Field, Input } from '@/ui/Field'

interface RequestResetFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

type DeliveryMode = 'provider' | 'development_console' | null

const RequestResetForm = ({ onSuccess, onCancel }: RequestResetFormProps) => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [maskedEmail, setMaskedEmail] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const response = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setMaskedEmail(data.email || '')
        setSuccessMessage(data.message || '')
        setDeliveryMode(data.deliveryMode || null)
        sessionStorage.setItem('resetEmail', email)

        if (onSuccess) {
          onSuccess()
        }
      } else {
        setError(data.message || 'Failed to request password reset')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const successTitle =
    deliveryMode === 'development_console' ? 'OTP Ready For Development' : 'OTP Code Sent'

  const nextStepLine =
    deliveryMode === 'development_console'
      ? '1. Check the server console for the OTP code'
      : '1. Check your email inbox (and spam folder)'

  const resolvedSuccessMessage =
    successMessage ||
    `A 6-digit verification code has been sent to ${maskedEmail || 'your email'}.`

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-strong px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-4 text-[26px] font-extrabold text-white">Reset Password</h1>
          <p className="mt-1 text-xs text-ink-muted">
            Enter your email address to receive an OTP code
          </p>
        </div>

        <div className="rounded-3xl bg-surface p-6 shadow-raised sm:p-8">
          {success ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-surface-tint p-4">
                <div className="flex gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <h3 className="text-sm font-bold text-primary-dark">{successTitle}</h3>
                    <p className="mt-1 text-sm text-ink-body">{resolvedSuccessMessage}</p>
                    <p className="mt-1 text-sm text-ink-muted">The code is valid for 10 minutes.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-info/10 p-4">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 shrink-0 text-info" />
                  <div className="text-xs text-ink-body">
                    <h3 className="text-sm font-bold text-ink-strong">Next Steps</h3>
                    <p className="mt-2">{nextStepLine}</p>
                    <p>2. Enter the 6-digit code on the next page</p>
                    <p>3. Set your new password</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Button className="w-full" onClick={() => router.push('/auth/reset-password')}>
                  Continue to Password Reset
                </Button>
                <Button variant="secondary" className="w-full" onClick={() => router.push('/auth')}>
                  Back to Login
                </Button>
              </div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {error ? (
                <div className="rounded-xl bg-danger-soft px-4 py-3 text-[13px] font-medium text-danger">
                  {error}
                </div>
              ) : null}

              <Field
                label="Email Address"
                htmlFor="email"
                hint="Enter the email address you registered with"
              >
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

              <div className="space-y-2 pt-2">
                <Button type="submit" loading={loading} className="w-full">
                  {loading ? 'Sending OTP...' : 'Send OTP Code'}
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => (onCancel ? onCancel() : router.push('/auth'))}
                >
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

export default RequestResetForm
