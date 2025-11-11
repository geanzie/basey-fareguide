'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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
  const [userInfo, setUserInfo] = useState<any>(null)
  const router = useRouter()

  // Load email from session storage if available
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
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  const handleVerifyOtp = () => {
    verifyOtp(otp, email)
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
        // Clear session storage
        sessionStorage.removeItem('resetEmail')
        setTimeout(() => {
          router.push('/auth')
        }, 3000)
      } else {
        setError(data.message || 'Failed to reset password')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <span className="text-4xl">🔑</span>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Reset Your Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter the OTP code sent to your email
          </p>
        </div>
        
        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Password Reset Successful!
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Your password has been reset successfully. Redirecting to login...</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {otpValid && userInfo && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  ✅ OTP Verified! Resetting password for: <strong>{userInfo.firstName} {userInfo.lastName}</strong>
                </p>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                  OTP Code
                </label>
                <div className="mt-1 flex space-x-2">
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    required
                    maxLength={6}
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 focus:z-10 sm:text-sm"
                    placeholder="Enter 6-digit OTP code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={verifying || otp.length !== 6}
                    className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {verifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Enter the 6-digit code sent to your email
                </p>
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                  New Password
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  disabled={!otpValid}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 focus:z-10 sm:text-sm disabled:bg-gray-100"
                  placeholder="Enter new password (min 8 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  disabled={!otpValid}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 focus:z-10 sm:text-sm disabled:bg-gray-100"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="submit"
                disabled={loading || !otpValid}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Resetting...
                  </span>
                ) : (
                  'Reset Password'
                )}
              </button>

              <button
                type="button"
                onClick={() => router.push('/auth')}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
              >
                Back to Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default ResetPasswordForm
