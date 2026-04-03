'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import LoadingSpinner from '@/components/LoadingSpinner'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
} from '@/components/dashboardIcons'

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
    <div className="app-page-bg min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center">
        <div className="w-full max-w-md">
          <div className="app-surface-card-strong space-y-8 rounded-3xl p-8 sm:p-10">
            <div>
              <div className="flex justify-center">
                <div className={`${getDashboardIconChipClasses('blue')} h-16 w-16 rounded-2xl`}>
                  <DashboardIconSlot icon={DASHBOARD_ICONS.key} size={DASHBOARD_ICON_POLICY.sizes.hero} />
                </div>
              </div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Reset Password
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                Enter your email address to receive an OTP code
              </p>
            </div>

            {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <DashboardIconSlot icon={DASHBOARD_ICONS.check} size={DASHBOARD_ICON_POLICY.sizes.card} className="text-green-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">{successTitle}</h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>{resolvedSuccessMessage}</p>
                    <p className="mt-1">The code is valid for 10 minutes.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <DashboardIconSlot icon={DASHBOARD_ICONS.info} size={DASHBOARD_ICON_POLICY.sizes.card} className="text-blue-500" />
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-blue-800">Next Steps</h3>
                  <div className="mt-2 text-xs text-blue-700">
                    <p>{nextStepLine}</p>
                    <p>2. Enter the 6-digit code on the next page</p>
                    <p>3. Set your new password</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => router.push('/auth/reset-password')}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
              >
                Continue to Password Reset
              </button>
              <button
                onClick={() => router.push('/auth')}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
              >
                Back to Login
              </button>
            </div>
          </div>
            ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            ) : null}

            <div>
              <label htmlFor="email" className="sr-only">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 focus:z-10 sm:text-sm"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter the email address you registered with
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center">
                    <LoadingSpinner size={20} className="mr-3 text-white" />
                    Sending OTP...
                  </span>
                ) : (
                  'Send OTP Code'
                )}
              </button>

              <button
                type="button"
                onClick={() => (onCancel ? onCancel() : router.push('/auth'))}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
              >
                Back to Login
              </button>
            </div>
          </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RequestResetForm
