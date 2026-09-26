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
    <div className="flex flex-1 flex-col bg-surface lg:flex-row">
      <BrandPanel />
      <WeaveSeam />

      <div className="flex flex-1 justify-center px-6 pb-10 pt-7 lg:items-center lg:px-12 lg:py-8">
        <div className="w-full max-w-md lg:max-w-sm">
          <h2 className="mb-5 text-xl font-bold text-ink-strong lg:text-2xl">Sign in</h2>

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
        </div>
      </div>
    </div>
  )
}

/**
 * Brand half: a compact header on phones, the whole left side on desktop.
 * The line at the bottom stands in for the site footer, which auth screens hide.
 */
const BrandPanel = () => (
  <aside className="flex bg-[#14532D] px-6 pb-7 pt-6 text-white lg:w-[54%] lg:px-14 lg:py-10">
    {/* Below lg this column lines up with the centered form underneath it. */}
    <div className="mx-auto flex w-full max-w-md flex-col lg:mx-0 lg:max-w-none lg:justify-between">
      <div className="flex items-center gap-3">
        <BrandMark size="md" tone="dark" />
        <h1 className="font-brand text-xl font-extrabold">Basey FareCheck</h1>
      </div>

      <div className="mt-7 max-w-xl lg:mt-0">
        <p className="font-brand text-3xl font-extrabold leading-[1.05] text-balance text-[#F3E6C4] sm:text-4xl lg:text-5xl xl:text-6xl">
          Know the fare before you ride.
        </p>
        <p className="mt-3 hidden max-w-md text-sm leading-relaxed text-white/75 sm:block lg:mt-6 lg:text-base">
          Official fares for every tricycle, and habal-habal in
          Basey, set by Municipal Ordinance 105, Series of 2023.
        </p>
      </div>

      <p className="hidden text-sm text-white/60 lg:block">
        &copy; 2025 Municipality of Basey, Samar, Philippines
      </p>
    </div>
  </aside>
)

// The logo's banig: stepped chevron bands of indigo, marigold, coral and
// turquoise, with a row of natural tikog between each repeat.
const BANIG_BANDS = ['#4B2E83', '#F39A2B', '#EE6A55', '#37B7C3', '#E6D3A8']
const WEAVE_CELL = 2

// One 6×5 cell repeat; its 6 cells across fill the 12px strip. Chevrons
// point along the strip: along x when horizontal, along y when vertical.
const weaveCells = (vertical: boolean) =>
  Array.from({ length: 30 }, (_, i) => {
    const across = i % 6
    const along = Math.floor(i / 6)
    const band = BANIG_BANDS[(along + Math.floor(Math.abs(across - 2.5))) % 5]
    const [x, y] = vertical ? [across, along] : [along, across]
    return (
      <rect
        key={i}
        x={x * WEAVE_CELL}
        y={y * WEAVE_CELL}
        width={WEAVE_CELL}
        height={WEAVE_CELL}
        fill={band}
      />
    )
  })

const WeaveStrip = ({ vertical, className }: { vertical: boolean; className: string }) => {
  const id = vertical ? 'login-weave-v' : 'login-weave-h'
  return (
    <svg aria-hidden="true" className={className}>
      <defs>
        <pattern
          id={id}
          width={(vertical ? 6 : 5) * WEAVE_CELL}
          height={(vertical ? 5 : 6) * WEAVE_CELL}
          patternUnits="userSpaceOnUse"
        >
          {weaveCells(vertical)}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/**
 * The banig weave from the logo's ticket, used as the seam between the brand
 * and the form: a horizontal strip on phones, a vertical one on desktop.
 */
const WeaveSeam = () => (
  <>
    <WeaveStrip vertical={false} className="block h-3 w-full shrink-0 lg:hidden" />
    <WeaveStrip vertical className="hidden w-3 shrink-0 self-stretch lg:block" />
  </>
)

export default LoginForm
