'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface RegisterFormProps {
  onSwitchToLogin: () => void
}

type UserType = 'PUBLIC' | 'ENFORCER' | 'DATA_ENCODER'

const RegisterForm = ({ onSwitchToLogin }: RegisterFormProps) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    dateOfBirth: '',
    governmentId: '',
    idType: '',
    barangayResidence: '',
    username: '',
    password: '',
    confirmPassword: '',
    userType: 'PUBLIC' as UserType
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    // Enhanced Validation
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

    // Age validation (18+ required)
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

    // Phone number validation (Philippine format)
    const phoneRegex = /^(09|\+639)\d{9}$/
    if (formData.phoneNumber && !phoneRegex.test(formData.phoneNumber.replace(/\s/g, ''))) {
      setError('Please enter a valid Philippine mobile number (09XXXXXXXXX)')
      setLoading(false)
      return
    }

    // Government ID validation (basic format check) - optional
    if (formData.governmentId && formData.governmentId.length < 8) {
      setError('Government ID number must be at least 8 characters')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          confirmPassword: undefined // Remove confirmPassword from request
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
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <span className="text-4xl">📝</span>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Register for Basey Fare Guide
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Join the official transportation management system
          </p>
        </div>
        
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              {success}
            </div>
          )}

          {/* User Type Selection */}
          <div>
            <label htmlFor="userType" className="block text-sm font-medium text-gray-700 mb-1">
              Registration Type
            </label>
            <select
              id="userType"
              name="userType"
              value={formData.userType}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
              disabled
            >
              <option value="PUBLIC">General Public</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              General Public accounts are automatically approved and can log in immediately. Official roles (Enforcer, Data Encoder) are created by administrators only.
            </p>
          </div>

          {/* Personal Information Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
            <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                value={formData.firstName}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                value={formData.lastName}
                onChange={handleInputChange}
              />
            </div>
          </div>





            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="09XXXXXXXXX"
                value={formData.phoneNumber}
                onChange={handleInputChange}
              />
            </div>
          </div>

          {/* Identity Verification Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h3 className="font-medium text-blue-800 mb-2">📋 Additional Information (Optional)</h3>
            <p className="text-sm text-blue-700">
              Provide additional information to enhance your profile. All fields in this section are optional.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth
              </label>
              <input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                max={new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} // 18+ only
              />
            </div>
            <div>
              <label htmlFor="idType" className="block text-sm font-medium text-gray-700 mb-1">
                Government ID Type *
              </label>
              <select
                id="idType"
                name="idType"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                value={formData.idType}
                onChange={handleInputChange}
              >
                <option value="">Select ID Type</option>
                <option value="NATIONAL_ID">National ID (PhilID)</option>
                <option value="DRIVERS_LICENSE">Driver's License</option>
                <option value="PASSPORT">Passport</option>
                <option value="VOTERS_ID">Voter's ID</option>
                <option value="SSS_ID">SSS ID</option>
                <option value="PHILHEALTH_ID">PhilHealth ID</option>
                <option value="TIN_ID">TIN ID</option>
                <option value="POSTAL_ID">Postal ID</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="governmentId" className="block text-sm font-medium text-gray-700 mb-1">
              Government ID Number *
            </label>
            <input
              id="governmentId"
              name="governmentId"
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
              value={formData.governmentId}
              onChange={handleInputChange}
              placeholder="Enter your government ID number"
            />
            <p className="text-xs text-gray-500 mt-1">
              This will be verified against government databases. False information is punishable by law.
            </p>
          </div>

          <div>
            <label htmlFor="barangayResidence" className="block text-sm font-medium text-gray-700 mb-1">
              Barangay of Residence *
            </label>
            <select
              id="barangayResidence"
              name="barangayResidence"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
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









          {/* Account Information Section */}
          <div className="border-t pt-6 mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
            
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                value={formData.username}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                value={formData.password}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
              value={formData.confirmPassword}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Registering...
                </span>
              ) : (
                'Register Account'
              )}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-emerald-600 hover:text-emerald-500 text-sm"
            >
              Already have an account? Sign in here
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RegisterForm