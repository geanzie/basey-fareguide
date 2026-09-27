'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/components/AuthProvider'
import Button from '@/ui/Button'
import { Field, Input } from '@/ui/Field'
import PasswordInput from '@/ui/PasswordInput'
import { getAuthenticatedHomeRoute } from '@/lib/authRoutes'
import AuthShell from './AuthShell'
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
    <AuthShell title="Sign in">
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

        <div>
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
          <div className="mt-2 text-right">
            <button
              type="button"
              onClick={() => router.push('/auth/request-reset')}
              className="text-sm font-semibold text-primary hover:text-primary-dark"
            >
              Forgot password?
            </button>
          </div>
        </div>

        <Button type="submit" loading={loading} className="w-full">
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>

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
    </AuthShell>
  )
}

export default LoginForm
