'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/components/AuthProvider'
import BrandMark from '@/components/BrandMark'
import Button from '@/ui/Button'
import { Field, Input } from '@/ui/Field'
import PasswordInput from '@/ui/PasswordInput'
import { getAuthenticatedHomeRoute } from '@/lib/authRoutes'
import SocialSignInButtons, { type SocialProviderOption } from './SocialSignInButtons'

interface LoginFormProps {
  initialError?: string
  initialUsername?: string
  socialProviders?: SocialProviderOption[]
  onSwitchToRegister: () => void
}

const LoginForm = ({
  initialError = '',
  initialUsername = '',
  socialProviders = [],
  onSwitchToRegister,
}: LoginFormProps) => {
  const router = useRouter()
  const { login } = useAuth()
  const [formData, setFormData] = useState({
    username: initialUsername,
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError)

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
    <div className="flex min-h-dvh items-center justify-center bg-ink-strong px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark />
          <h1 className="mt-4 text-2xl font-extrabold text-white">Basey FareCheck</h1>
          <p className="mt-1 text-xs text-ink-muted">Municipal Ordinance 105, Series of 2023</p>
        </div>

        <div className="rounded-3xl bg-surface p-6 shadow-raised sm:p-8">
          <h2 className="mb-5 text-xl font-bold text-ink-strong">Sign In</h2>

          <SocialSignInButtons providers={socialProviders} />

          <form className="space-y-4" onSubmit={handleSubmit} suppressHydrationWarning>
            {error ? (
              <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                {error}
              </div>
            ) : null}

            <Field label="Username" htmlFor="username">
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                placeholder="Enter username"
                value={formData.username}
                onChange={handleInputChange}
                suppressHydrationWarning
              />
            </Field>

            <Field label="Password" htmlFor="password">
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                required
                placeholder="Enter password"
                value={formData.password}
                onChange={handleInputChange}
                suppressHydrationWarning
              />
            </Field>

            <Button type="submit" loading={loading} className="mt-2 w-full">
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => router.push('/auth/request-reset')}
                className="text-sm font-semibold text-primary hover:text-primary-dark"
              >
                Forgot password?
              </button>
            </div>

            <div className="border-t border-surface-border pt-4 text-center">
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="text-sm text-ink-muted"
              >
                Don&apos;t have an account?{' '}
                <span className="font-bold text-primary">Register</span>
              </button>
            </div>
          </form>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          Basey Municipality, Samar · Philippines
        </p>
      </div>
    </div>
  )
}

export default LoginForm
