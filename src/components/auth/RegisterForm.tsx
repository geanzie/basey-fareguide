'use client'

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import Button from '@/ui/Button'
import { Field, Input, Select } from '@/ui/Field'
import PasswordInput from '@/ui/PasswordInput'
import { authFetchFailureMessage, authPost, formatRetryCountdown } from '@/lib/authFetch'
import { CURRENT_PRIVACY_NOTICE_VERSION } from '@/lib/privacyNotice'
import { BARANGAYS, ID_TYPES } from '@/lib/registrationOptions'
import SocialSignInButtons, { type SocialProviderOption } from './SocialSignInButtons'
import { useRetryCountdown } from './useRetryCountdown'
import AuthShell from './AuthShell'

interface RegisterFormProps {
  socialProviders?: SocialProviderOption[]
  onSwitchToLogin: () => void
}

type UserType = 'PUBLIC' | 'ENFORCER' | 'DATA_ENCODER'

// Registration runs as three steps so it fits one screen like the sign-in
// view. Every panel stays mounted (only hidden), so values survive Back.
const STEPS = [
  { key: 'personal', label: 'Personal' },
  { key: 'identity', label: 'Identity' },
  { key: 'account', label: 'Account' },
] as const
type StepIndex = 0 | 1 | 2
const LAST_STEP: StepIndex = 2

const stepId = (i: number) => `register-step-${STEPS[i].key}`
const panelId = (i: number) => `register-panel-${STEPS[i].key}`

const RegisterForm = ({ socialProviders = [], onSwitchToLogin }: RegisterFormProps) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    dateOfBirth: '',
    governmentId: '',
    idType: '',
    barangayResidence: '',
    username: '',
    password: '',
    confirmPassword: '',
    userType: 'PUBLIC' as UserType,
    privacyNoticeAcknowledged: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const retry = useRetryCountdown()
  const [step, setStep] = useState<StepIndex>(0)
  // Furthest step reached; steps past it stay locked until Next gets there.
  const [reached, setReached] = useState<StepIndex>(0)
  const panelRefs = useRef<(HTMLDivElement | null)[]>([])
  // Field to focus once its (previously hidden) panel has rendered visible.
  const [focusTarget, setFocusTarget] = useState<{ id: string; report: boolean } | null>(null)

  useEffect(() => {
    if (!focusTarget) return
    const el = document.getElementById(focusTarget.id) as HTMLInputElement | null
    el?.focus()
    if (focusTarget.report) el?.reportValidity()
    setFocusTarget(null)
  }, [focusTarget])

  /** Jumps to the panel holding `fieldId` and focuses that field. */
  const showField = (fieldId: string, report = false) => {
    const index = panelRefs.current.findIndex((panel) => panel?.querySelector(`#${fieldId}`))
    if (index >= 0) setStep(index as StepIndex)
    setFocusTarget({ id: fieldId, report })
  }

  /** First field the browser considers invalid in a panel, if any. */
  const firstInvalidIn = (index: number) =>
    panelRefs.current[index]?.querySelector<HTMLInputElement>('input:invalid, select:invalid') ?? null

  const goNext = () => {
    const invalid = firstInvalidIn(step)
    if (invalid) {
      invalid.reportValidity()
      return
    }
    const next = (step + 1) as StepIndex
    setStep(next)
    setReached((prev) => (next > prev ? next : prev))
  }

  const goBack = () => {
    setError('')
    setStep((step - 1) as StepIndex)
  }

  // Shows an error and takes the user to the field it is about.
  const fail = (message: string, fieldId: string) => {
    setError(message)
    showField(fieldId)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Guard against re-entry: the button is disabled while loading, but an
    // Enter-key submit can still fire before React re-renders, and a duplicate
    // request would spend a second rate-limit attempt.
    if (loading || retry.isCountingDown) return

    if (step < LAST_STEP) {
      goNext()
      return
    }

    setError('')
    setSuccess('')

    // The form is noValidate because the browser cannot focus a required
    // field inside a hidden step; check each panel here instead.
    for (let i = 0; i < STEPS.length; i++) {
      const invalid = firstInvalidIn(i)
      if (invalid) {
        showField(invalid.id, true)
        return
      }
    }

    // Client-side validation runs before the loading state is set, so a
    // correctable mistake never reaches the server and never costs an attempt.
    if (formData.password !== formData.confirmPassword) {
      fail('Passwords do not match', 'confirmPassword')
      return
    }

    if (formData.password.length < 8) {
      fail('Password must be at least 8 characters long', 'password')
      return
    }

    const phoneRegex = /^(09|\+639)\d{9}$/
    if (formData.phoneNumber && !phoneRegex.test(formData.phoneNumber.replace(/\s/g, ''))) {
      fail('Please enter a valid Philippine mobile number (09XXXXXXXXX)', 'phoneNumber')
      return
    }

    if (formData.governmentId && formData.governmentId.length < 8) {
      fail('Government ID number must be at least 8 characters', 'governmentId')
      return
    }

    if (!formData.idType || formData.idType.trim() === '') {
      fail('Please select a Government ID Type', 'idType')
      return
    }

    if (!formData.privacyNoticeAcknowledged) {
      fail('You must acknowledge the Privacy Notice before creating an account.', 'privacyNoticeAcknowledged')
      return
    }

    setLoading(true)

    try {
      const { confirmPassword, ...registrationData } = formData
      void confirmPassword

      const result = await authPost<{ message?: string; canLoginImmediately?: boolean }>(
        '/api/auth/register',
        {
          body: {
            ...registrationData,
            privacyNoticeVersion: CURRENT_PRIVACY_NOTICE_VERSION,
          },
        },
      )

      if (!result.ok) {
        if (result.failure === 'rate-limited') {
          retry.start(result.retryAfter)
          return
        }

        setError(
          result.failure === 'rejected'
            ? result.data?.message || 'Registration failed'
            : authFetchFailureMessage(result.failure),
        )
        return
      }

      setSuccess(result.data.message ?? 'Registration successful!')
      setTimeout(() => {
        onSwitchToLogin()
      }, result.data.canLoginImmediately ? 1500 : 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement
    const value = target.type === 'checkbox' ? target.checked : e.target.value
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: value,
    }))
  }

  const panelProps = (i: number) => ({
    ref: (el: HTMLDivElement | null) => {
      panelRefs.current[i] = el
    },
    role: 'group',
    id: panelId(i),
    'aria-labelledby': stepId(i),
    hidden: i !== step,
    className: 'space-y-3',
  })

  return (
    <AuthShell title="Create your account">
      <form className="space-y-4" onSubmit={handleSubmit} noValidate suppressHydrationWarning>
        {retry.isCountingDown && (
          <div className="rounded-xl bg-warning/10 px-4 py-3 text-sm font-medium text-warning-dark">
            Too many attempts for this email address. You can try again in{' '}
            <span className="tabular-nums">{formatRetryCountdown(retry.secondsLeft)}</span>. Your
            details are saved — leave this page open.
          </div>
        )}

        {error && !retry.isCountingDown && (
          <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl bg-surface-tint px-4 py-3 text-sm font-medium text-primary-dark">
            {success}
          </div>
        )}

        <ol aria-label="Registration steps" className="flex items-center gap-2">
          {STEPS.map((st, i) => {
            const current = i === step
            const locked = i > reached
            const done = !current && !locked
            return (
              <li key={st.key} className="flex flex-1 items-center gap-2 last:flex-none">
                <button
                  type="button"
                  disabled={locked}
                  aria-current={current ? 'step' : undefined}
                  onClick={() => setStep(i as StepIndex)}
                  className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                      current
                        ? 'bg-primary text-white'
                        : done
                          ? 'bg-surface-tint text-primary-dark'
                          : 'border border-surface-border text-ink-faint'
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
                  </span>
                  <span
                    id={stepId(i)}
                    className={`text-sm font-semibold ${
                      current ? 'text-ink-strong' : done ? 'text-primary-dark' : 'text-ink-faint'
                    }`}
                  >
                    {st.label}
                  </span>
                </button>
                {i < LAST_STEP ? (
                  <span
                    aria-hidden="true"
                    className={`h-px flex-1 ${i < reached ? 'bg-primary' : 'bg-surface-border'}`}
                  />
                ) : null}
              </li>
            )
          })}
        </ol>

        {/* Tall enough for the longest step (Account), so on lg — where the form
            is vertically centred — the heading does not jump between steps. */}
        <div className="lg:min-h-80">
          {/* ── Personal info ── (social sign-up is the shortcut past all three) */}
          <div {...panelProps(0)}>
            <SocialSignInButtons providers={socialProviders} action="signup" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name" htmlFor="firstName" required>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  required
                  value={formData.firstName}
                  onChange={handleInputChange}
                  suppressHydrationWarning
                />
              </Field>
              <Field label="Last Name" htmlFor="lastName" required>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  required
                  value={formData.lastName}
                  onChange={handleInputChange}
                  suppressHydrationWarning
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone Number" htmlFor="phoneNumber" required>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  autoComplete="tel"
                  required
                  placeholder="09XXXXXXXXX"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  suppressHydrationWarning
                />
              </Field>
              <Field label="Email Address" htmlFor="email" required>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  suppressHydrationWarning
                />
              </Field>
            </div>
          </div>

          {/* ── Identity verification ── */}
          <div {...panelProps(1)}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of Birth" htmlFor="dateOfBirth">
                <Input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  autoComplete="bday"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                  max={new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  suppressHydrationWarning
                />
              </Field>
              <Field label="ID Type" htmlFor="idType" required>
                <Select
                  id="idType"
                  name="idType"
                  autoComplete="off"
                  required
                  value={formData.idType}
                  onChange={handleInputChange}
                >
                  <option value="">Select ID Type</option>
                  {ID_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field
              label="Government ID Number"
              htmlFor="governmentId"
              required
              hint="False information is punishable by law."
            >
              <Input
                id="governmentId"
                name="governmentId"
                type="text"
                autoComplete="off"
                required
                value={formData.governmentId}
                onChange={handleInputChange}
                placeholder="Enter your government ID number"
              />
            </Field>

            <Field label="Barangay of Residence" htmlFor="barangayResidence" required>
              <Select
                id="barangayResidence"
                name="barangayResidence"
                autoComplete="off"
                required
                value={formData.barangayResidence}
                onChange={handleInputChange}
              >
                <option value="">Select your barangay</option>
                {BARANGAYS.map((barangay) => (
                  <option key={barangay} value={barangay}>
                    {barangay}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* ── Account credentials ── */}
          <div {...panelProps(2)}>
            <Field label="Username" htmlFor="username" required>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={formData.username}
                onChange={handleInputChange}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Password" htmlFor="password" required>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                />
              </Field>
              <Field label="Confirm Password" htmlFor="confirmPassword" required>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                />
              </Field>
            </div>
            <p className="text-xs text-ink-muted">Minimum 8 characters.</p>

            {/* ── Privacy notice acknowledgment ── */}
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  id="privacyNoticeAcknowledged"
                  name="privacyNoticeAcknowledged"
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-warning text-primary focus:ring-primary"
                  checked={formData.privacyNoticeAcknowledged}
                  onChange={handleInputChange}
                />
                <span className="text-sm text-warning-dark">
                  I have read and acknowledge the{' '}
                  <a
                    href="/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    Privacy Notice
                  </a>{' '}
                  and understand that my personal data will be processed for account registration
                  and related service use.
                </span>
              </label>
              <p className="mt-2 pl-7 text-xs text-warning-dark/80">
                Version {CURRENT_PRIVACY_NOTICE_VERSION}
              </p>
            </div>
          </div>
        </div>

        <div className={step > 0 ? 'grid grid-cols-[auto_1fr] gap-2' : undefined}>
          {step > 0 ? (
            <Button type="button" variant="secondary" onClick={goBack}>
              Back
            </Button>
          ) : null}
          {step < LAST_STEP ? (
            // A submit button so Enter in a field moves on too; handleSubmit
            // turns it into goNext until the last step. Soft, not solid: only
            // Create account on the last step should look like the final action.
            <Button key="next" type="submit" variant="soft" className="w-full">
              Next: {STEPS[step + 1].label}
            </Button>
          ) : (
            <Button
              key="create"
              type="submit"
              loading={loading}
              disabled={retry.isCountingDown}
              className="w-full"
            >
              {loading
                ? 'Creating account...'
                : retry.isCountingDown
                  ? `Try again in ${formatRetryCountdown(retry.secondsLeft)}`
                  : 'Create account'}
            </Button>
          )}
        </div>

        <div className="border-t border-surface-border pt-4 text-center">
          <button type="button" onClick={onSwitchToLogin} className="text-sm text-ink-muted">
            Already have an account? <span className="font-bold text-primary">Sign in</span>
          </button>
        </div>
      </form>
    </AuthShell>
  )
}

export default RegisterForm
