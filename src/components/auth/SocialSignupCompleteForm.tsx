'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/components/AuthProvider'
import BrandMark from '@/components/BrandMark'
import Button from '@/ui/Button'
import { Field, Input, Select } from '@/ui/Field'
import { getAuthenticatedHomeRoute } from '@/lib/authRoutes'
import { CURRENT_PRIVACY_NOTICE_VERSION } from '@/lib/privacyNotice'
import { BARANGAYS, ID_TYPES } from '@/lib/registrationOptions'

interface Props {
  providerLabel: string
  firstName: string
  lastName: string
  email: string
}

/**
 * Second half of social sign-up: the provider gave us name and email, so we
 * only collect what it cannot supply, plus the Privacy Notice acknowledgment
 * that has to be recorded when the account is created.
 */
const SocialSignupCompleteForm = ({ providerLabel, firstName, lastName, email }: Props) => {
  const router = useRouter()
  const { login } = useAuth()
  const [formData, setFormData] = useState({
    phoneNumber: '',
    dateOfBirth: '',
    barangayResidence: '',
    idType: '',
    governmentId: '',
    privacyNoticeAcknowledged: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const target = e.target as HTMLInputElement
    const value = target.type === 'checkbox' ? target.checked : e.target.value
    setError('')
    setFormData((prev) => ({ ...prev, [e.target.name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const phoneRegex = /^(09|\+639)\d{9}$/
    if (!phoneRegex.test(formData.phoneNumber.replace(/\s/g, ''))) {
      setError('Please enter a valid Philippine mobile number (09XXXXXXXXX)')
      return
    }

    if (formData.governmentId && formData.governmentId.length < 8) {
      setError('Government ID number must be at least 8 characters')
      return
    }

    if (!formData.privacyNoticeAcknowledged) {
      setError('You must acknowledge the Privacy Notice before creating an account.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/oauth/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          privacyNoticeVersion: CURRENT_PRIVACY_NOTICE_VERSION,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Could not finish creating your account')
        return
      }

      login(data.user)
      router.replace(getAuthenticatedHomeRoute(data.user.userType))
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-ink-strong px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark />
          <h1 className="mt-4 text-2xl font-extrabold text-white">Finish your account</h1>
          <p className="mt-1 text-xs text-ink-muted">
            Signed in with {providerLabel} — just a few more details.
          </p>
        </div>

        <div className="rounded-3xl bg-surface p-6 shadow-raised sm:p-8">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error ? (
              <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                {error}
              </div>
            ) : null}

            <div className="rounded-xl bg-surface-alt px-4 py-3 text-sm">
              <p className="font-bold text-ink-strong">
                {firstName} {lastName}
              </p>
              <p className="text-ink-muted">{email}</p>
            </div>

            <Field label="Mobile Number" htmlFor="phoneNumber" hint="09XXXXXXXXX" required>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                autoComplete="tel"
                required
                placeholder="09171234567"
                value={formData.phoneNumber}
                onChange={handleInputChange}
              />
            </Field>

            <Field label="Date of Birth" htmlFor="dateOfBirth">
              <Input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                autoComplete="bday"
                value={formData.dateOfBirth}
                onChange={handleInputChange}
              />
            </Field>

            <Field label="Barangay of Residence" htmlFor="barangayResidence">
              <Select
                id="barangayResidence"
                name="barangayResidence"
                value={formData.barangayResidence}
                onChange={handleInputChange}
              >
                <option value="">Select barangay (optional)</option>
                {BARANGAYS.map((barangay) => (
                  <option key={barangay} value={barangay}>
                    {barangay}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Government ID Type" htmlFor="idType">
                <Select id="idType" name="idType" value={formData.idType} onChange={handleInputChange}>
                  <option value="">Optional</option>
                  {ID_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="ID Number" htmlFor="governmentId">
                <Input
                  id="governmentId"
                  name="governmentId"
                  type="text"
                  value={formData.governmentId}
                  onChange={handleInputChange}
                />
              </Field>
            </div>

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

            <Button type="submit" loading={loading} className="w-full">
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default SocialSignupCompleteForm
