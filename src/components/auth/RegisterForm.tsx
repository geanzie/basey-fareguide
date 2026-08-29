'use client'

import { useState } from 'react'
import Button from '@/ui/Button'
import { Field, Input, Select } from '@/ui/Field'
import PasswordInput from '@/ui/PasswordInput'
import { CURRENT_PRIVACY_NOTICE_VERSION } from '@/lib/privacyNotice'

interface RegisterFormProps {
  onSwitchToLogin: () => void
}

type UserType = 'PUBLIC' | 'ENFORCER' | 'DATA_ENCODER'

const BARANGAYS = [
  'Amandayehan', 'Anglit', 'Bacubac', 'Baloog', 'Basiao', 'Buenavista', 'Burgos',
  'Cambayan', 'Can-abay', 'Cancaiyas', 'Canmanila', 'Catadman', 'Cogon', 'Dolongan',
  'Guintigui-an', 'Guirang', 'Balante', 'Iba', 'Inuntan', 'Loog', 'Mabini',
  'Magallanes', 'Manlilinab', 'Del Pilar', 'May-it', 'Mongabong', 'New San Agustin',
  'Nouvelas Occidental', 'Old San Agustin', 'Panugmonon', 'Pelit',
  'Baybay (Poblacion)', 'Buscada (Poblacion)', 'Lawa-an (Poblacion)',
  'Loyo (Poblacion)', 'Mercado (Poblacion)', 'Palaypay (Poblacion)',
  'Sulod (Poblacion)', 'Roxas', 'Salvacion', 'San Antonio', 'San Fernando', 'Sawa',
  'Serum', 'Sugca', 'Sugponon', 'Tinaogan', 'Tingib', 'Villa Aurora', 'Binongtu-an',
  'Bulao',
]

const ID_TYPES: Array<[string, string]> = [
  ['NATIONAL_ID', 'National ID (PhilID)'],
  ['DRIVERS_LICENSE', "Driver's License"],
  ['PASSPORT', 'Passport'],
  ['VOTERS_ID', "Voter's ID"],
  ['SSS_ID', 'SSS ID'],
  ['PHILHEALTH_ID', 'PhilHealth ID'],
  ['TIN_ID', 'TIN ID'],
  ['POSTAL_ID', 'Postal ID'],
  ['STUDENT_ID', 'Student ID'],
]

const RegisterForm = ({ onSwitchToLogin }: RegisterFormProps) => {
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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      setLoading(false)
      return
    }

    const birthDate = new Date(formData.dateOfBirth)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    if (age < 18) {
      setError('You must be at least 18 years old to register')
      setLoading(false)
      return
    }

    const phoneRegex = /^(09|\+639)\d{9}$/
    if (formData.phoneNumber && !phoneRegex.test(formData.phoneNumber.replace(/\s/g, ''))) {
      setError('Please enter a valid Philippine mobile number (09XXXXXXXXX)')
      setLoading(false)
      return
    }

    if (formData.governmentId && formData.governmentId.length < 8) {
      setError('Government ID number must be at least 8 characters')
      setLoading(false)
      return
    }

    if (!formData.idType || formData.idType.trim() === '') {
      setError('Please select a Government ID Type')
      setLoading(false)
      return
    }

    if (!formData.privacyNoticeAcknowledged) {
      setError('You must acknowledge the Privacy Notice before creating an account.')
      setLoading(false)
      return
    }

    try {
      const { confirmPassword, ...registrationData } = formData
      void confirmPassword

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...registrationData,
          privacyNoticeVersion: CURRENT_PRIVACY_NOTICE_VERSION,
        }),
      })

      if (response.ok) {
        const responseData = await response.json()
        setSuccess(responseData.message)
        setTimeout(() => {
          onSwitchToLogin()
        }, responseData.canLoginImmediately ? 1500 : 3000)
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Registration failed')
      }
    } catch {
      setError('Network error. Please try again.')
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

  return (
    <div className="min-h-dvh bg-ink-strong px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-[26px] font-extrabold text-white">Create your account</h1>
          <p className="mt-1 text-xs text-ink-muted">
            Basey FareCheck — Municipal Ordinance 105, Series of 2023
          </p>
        </div>

        <div className="rounded-3xl bg-surface p-6 shadow-raised sm:p-8">
          <form className="space-y-4" onSubmit={handleSubmit} suppressHydrationWarning>
            {error && (
              <div className="rounded-xl bg-danger-soft px-4 py-3 text-[13px] font-medium text-danger">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl bg-surface-tint px-4 py-3 text-[13px] font-medium text-primary-dark">
                {success}
              </div>
            )}

            {/* ── Personal info ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Personal Information</p>

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
            <div className="space-y-3 border-t border-surface-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Identity Verification</p>

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
            <div className="space-y-3 border-t border-surface-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Account Credentials</p>

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
            </div>

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

            <Button type="submit" loading={loading} className="w-full">
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>

            <p className="text-center text-sm text-ink-muted">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="font-bold text-primary"
              >
                Sign in
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default RegisterForm
