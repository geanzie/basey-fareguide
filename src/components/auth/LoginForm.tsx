'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { useAuth } from '@/components/AuthProvider'
import BrandMark from '@/components/BrandMark'
import LoadingSpinner from '@/components/LoadingSpinner'
import { getAuthenticatedHomeRoute } from '@/lib/authRoutes'

interface LoginFormProps {
  onSwitchToRegister: () => void
}

const LoginForm = ({ onSwitchToRegister }: LoginFormProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUsername = searchParams.get('username') ?? ''
  const redirectError = searchParams.get('error') ?? ''
  const { login } = useAuth()
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (redirectUsername) {
      setFormData((current) => ({
        ...current,
        username: redirectUsername,
      }))
    }

    setError(redirectError)
  }, [redirectError, redirectUsername])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const data = await response.json()

        login(data.user)
        router.replace(getAuthenticatedHomeRoute(data.user.userType))
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Login failed')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('')
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  return (
    <div className="app-page-bg min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center">
        <div className="w-full max-w-md">
          <div className="app-surface-card-strong space-y-8 rounded-3xl p-8 sm:p-10">
            <div>
              <div className="flex justify-center">
                <BrandMark />
              </div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Sign in to Basey Fare Check
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                Transportation fare reference system
              </p>
            </div>

            <form
              className="mt-8 space-y-6"
              action="/auth/login"
              method="post"
              onSubmit={handleSubmit}
              suppressHydrationWarning
            >
              {error ? (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              ) : null}

              <div className="rounded-md shadow-sm -space-y-px" suppressHydrationWarning>
                <div suppressHydrationWarning>
                  <label htmlFor="username" className="sr-only">Username</label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 bg-white placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 focus:z-10 sm:text-sm"
                    placeholder="Username"
                    value={formData.username}
                    onChange={handleInputChange}
                    suppressHydrationWarning
                  />
                </div>
                <div suppressHydrationWarning>
                  <label htmlFor="password" className="sr-only">Password</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 bg-white placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 focus:z-10 sm:text-sm"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleInputChange}
                    suppressHydrationWarning
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center">
                      <LoadingSpinner size={20} className="mr-3 text-white" />
                      Signing in...
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => router.push('/auth/request-reset')}
                  className="text-sm text-emerald-600 hover:text-emerald-500"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={onSwitchToRegister}
                  className="text-emerald-600 hover:text-emerald-500 text-sm"
                >
                  Register here
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginForm
