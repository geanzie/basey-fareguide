'use client'

import { useState } from 'react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { CURRENT_PRIVACY_NOTICE_VERSION } from '@/lib/privacyNotice'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
} from '@/components/dashboardIcons'

interface RegisterFormProps {
  onSwitchToLogin: () => void
}

type UserType = 'PUBLIC' | 'ENFORCER' | 'DATA_ENCODER'

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
    <div className="app-page-bg min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-lg">
        <div className="app-surface-card-strong space-y-6 rounded-3xl p-8 sm:p-10">
          {/* Header */}
          <div className="text-center">
            <div className="flex justify-center">
              <div className={getDashboardIconChipClasses('emerald')}>
                <DashboardIconSlot icon={DASHBOARD_ICONS.user} size={DASHBOARD_ICON_POLICY.sizes.hero} />
              </div>
            </div>
            <h2 className="mt-4 text-2xl font-extrabold text-gray-900">
              Create your account
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Basey Fare Check &mdash; Transportation Fare Reference System
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit} suppressHydrationWarning>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                {success}
              </div>
            )}

            {/* ── Personal info ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Personal Information</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    autoComplete="given-name"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    suppressHydrationWarning
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    autoComplete="family-name"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    suppressHydrationWarning
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="phoneNumber"
                    name="phoneNumber"
                    type="tel"
                    autoComplete="tel"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="09XXXXXXXXX"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    suppressHydrationWarning
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    suppressHydrationWarning
                  />
                </div>
              </div>
            </div>

            {/* ── Identity verification ── */}
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Identity Verification</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    id="dateOfBirth"
                    name="dateOfBirth"
                    type="date"
                    autoComplete="bday"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    max={new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    suppressHydrationWarning
                  />
                </div>
                <div>
                  <label htmlFor="idType" className="block text-sm font-medium text-gray-700 mb-1">
                    ID Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="idType"
                    name="idType"
                    autoComplete="off"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                    value={formData.idType}
                    onChange={handleInputChange}
                  >
                    <option value="">Select ID Type</option>
                    <option value="NATIONAL_ID">National ID (PhilID)</option>
                    <option value="DRIVERS_LICENSE">Driver&apos;s License</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="VOTERS_ID">Voter&apos;s ID</option>
                    <option value="SSS_ID">SSS ID</option>
                    <option value="PHILHEALTH_ID">PhilHealth ID</option>
                    <option value="TIN_ID">TIN ID</option>
                    <option value="POSTAL_ID">Postal ID</option>
                    <option value="STUDENT_ID">Student ID</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="governmentId" className="block text-sm font-medium text-gray-700 mb-1">
                  Government ID Number <span className="text-red-500">*</span>
                </label>
                <input
                  id="governmentId"
                  name="governmentId"
                  type="text"
                  autoComplete="off"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                  value={formData.governmentId}
                  onChange={handleInputChange}
                  placeholder="Enter your government ID number"
                />
                <p className="text-xs text-gray-500 mt-1">
                  False information is punishable by law.
                </p>
              </div>

              <div>
                <label htmlFor="barangayResidence" className="block text-sm font-medium text-gray-700 mb-1">
                  Barangay of Residence <span className="text-red-500">*</span>
                </label>
                <select
                  id="barangayResidence"
                  name="barangayResidence"
                  autoComplete="off"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                  value={formData.barangayResidence}
                  onChange={handleInputChange}
                >
                  <option value="">Select your barangay</option>
                  <option value="Amandayehan">Amandayehan</option>
                  <option value="Anglit">Anglit</option>
                  <option value="Bacubac">Bacubac</option>
                  <option value="Baloog">Baloog</option>
                  <option value="Basiao">Basiao</option>
                  <option value="Buenavista">Buenavista</option>
                  <option value="Burgos">Burgos</option>
                  <option value="Cambayan">Cambayan</option>
                  <option value="Can-abay">Can-abay</option>
                  <option value="Cancaiyas">Cancaiyas</option>
                  <option value="Canmanila">Canmanila</option>
                  <option value="Catadman">Catadman</option>
                  <option value="Cogon">Cogon</option>
                  <option value="Dolongan">Dolongan</option>
                  <option value="Guintigui-an">Guintigui-an</option>
                  <option value="Guirang">Guirang</option>
                  <option value="Balante">Balante</option>
                  <option value="Iba">Iba</option>
                  <option value="Inuntan">Inuntan</option>
                  <option value="Loog">Loog</option>
                  <option value="Mabini">Mabini</option>
                  <option value="Magallanes">Magallanes</option>
                  <option value="Manlilinab">Manlilinab</option>
                  <option value="Del Pilar">Del Pilar</option>
                  <option value="May-it">May-it</option>
                  <option value="Mongabong">Mongabong</option>
                  <option value="New San Agustin">New San Agustin</option>
                  <option value="Nouvelas Occidental">Nouvelas Occidental</option>
                  <option value="Old San Agustin">Old San Agustin</option>
                  <option value="Panugmonon">Panugmonon</option>
                  <option value="Pelit">Pelit</option>
                  <option value="Baybay (Poblacion)">Baybay (Poblacion)</option>
                  <option value="Buscada (Poblacion)">Buscada (Poblacion)</option>
                  <option value="Lawa-an (Poblacion)">Lawa-an (Poblacion)</option>
                  <option value="Loyo (Poblacion)">Loyo (Poblacion)</option>
                  <option value="Mercado (Poblacion)">Mercado (Poblacion)</option>
                  <option value="Palaypay (Poblacion)">Palaypay (Poblacion)</option>
                  <option value="Sulod (Poblacion)">Sulod (Poblacion)</option>
                  <option value="Roxas">Roxas</option>
                  <option value="Salvacion">Salvacion</option>
                  <option value="San Antonio">San Antonio</option>
                  <option value="San Fernando">San Fernando</option>
                  <option value="Sawa">Sawa</option>
                  <option value="Serum">Serum</option>
                  <option value="Sugca">Sugca</option>
                  <option value="Sugponon">Sugponon</option>
                  <option value="Tinaogan">Tinaogan</option>
                  <option value="Tingib">Tingib</option>
                  <option value="Villa Aurora">Villa Aurora</option>
                  <option value="Binongtu-an">Binongtu-an</option>
                  <option value="Bulao">Bulao</option>
                </select>
              </div>
            </div>

            {/* ── Account credentials ── */}
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Account Credentials</p>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                  value={formData.username}
                  onChange={handleInputChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                    value={formData.password}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">Minimum 8 characters.</p>
            </div>

            {/* ── Privacy notice acknowledgment ── */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  id="privacyNoticeAcknowledged"
                  name="privacyNoticeAcknowledged"
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-400 text-emerald-600 focus:ring-emerald-500"
                  checked={formData.privacyNoticeAcknowledged}
                  onChange={handleInputChange}
                />
                <span className="text-sm text-amber-900">
                  I have read and acknowledge the{' '}
                  <a
                    href="/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline hover:text-amber-800"
                  >
                    Privacy Notice
                  </a>{' '}
                  and understand that my personal data will be processed for account registration
                  and related service use.
                </span>
              </label>
              <p className="mt-2 pl-7 text-xs text-amber-600">
                Version {CURRENT_PRIVACY_NOTICE_VERSION}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <span className="flex items-center">
                  <LoadingSpinner size={20} className="mr-3" />
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>

            <p className="text-center text-sm text-gray-500">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="font-medium text-emerald-600 hover:text-emerald-500"
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
