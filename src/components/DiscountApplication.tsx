'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { validateDiscountApplication, validatePhoto } from '@/lib/discountValidation'

interface User {
  id: string
  username: string
  firstName: string
  lastName: string
  dateOfBirth?: string
  phoneNumber?: string
  governmentId?: string
  idType?: string
  userType: string
}

interface DiscountApplicationProps {
  user: User
}

type DiscountType = 'SENIOR_CITIZEN' | 'PWD' | 'STUDENT'

interface ApplicationStatus {
  hasApplication: boolean
  application: {
    id: string
    discountType: DiscountType
    verificationStatus: string
    isActive: boolean
    validFrom: string
    validUntil: string
    rejectionReason?: string
    createdAt: string
    photoUrl?: string
  } | null
}

export default function DiscountApplication({ user }: DiscountApplicationProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus | null>(null)

  // Form state
  const [discountType, setDiscountType] = useState<DiscountType>('SENIOR_CITIZEN')
  const [fullName, setFullName] = useState(`${user.firstName} ${user.lastName}`)
  const [dateOfBirth, setDateOfBirth] = useState(user.dateOfBirth || '')
  const [idNumber, setIdNumber] = useState(user.governmentId || '')
  const [idType, setIdType] = useState(user.idType || '')
  const [issuingAuthority, setIssuingAuthority] = useState('')
  
  // Photo upload
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  
  // Student-specific fields
  const [schoolName, setSchoolName] = useState('')
  const [schoolAddress, setSchoolAddress] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [schoolIdExpiry, setSchoolIdExpiry] = useState('')
  
  // PWD-specific fields
  const [disabilityType, setDisabilityType] = useState('')
  const [pwdIdExpiry, setPwdIdExpiry] = useState('')

  useEffect(() => {
    checkExistingApplication()
  }, [])

  const checkExistingApplication = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      const response = await fetch('/api/discount-cards/my-application', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setApplicationStatus(data)
      }
    } catch (err) {
      console.error('Error checking application:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate photo using utility
      const validation = validatePhoto(file)
      if (!validation.valid) {
        setError(validation.errors[0])
        return
      }

      setPhotoFile(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      setError(null)
    }
  }

  const validateForm = (): boolean => {
    // Use comprehensive validation utility
    const validation = validateDiscountApplication(
      {
        discountType,
        fullName,
        dateOfBirth,
        idNumber: idNumber || undefined,
        idType: idType || undefined,
        issuingAuthority: issuingAuthority || undefined,
        schoolName: schoolName || undefined,
        schoolAddress: schoolAddress || undefined,
        gradeLevel: gradeLevel || undefined,
        schoolIdExpiry: schoolIdExpiry || undefined,
        disabilityType: disabilityType || undefined,
        pwdIdExpiry: pwdIdExpiry || undefined,
      },
      photoFile || undefined
    )

    if (!validation.valid) {
      setError(validation.errors[0]) // Show first error
      return false
    }

    // Check photo requirement for new applications
    if (!photoFile && !applicationStatus?.application) {
      setError('Please upload a photo for your ID')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!validateForm()) {
      return
    }

    try {
      setSubmitting(true)
      const token = localStorage.getItem('token')

      // Prepare form data
      const formData = new FormData()
      formData.append('discountType', discountType)
      formData.append('fullName', fullName)
      formData.append('dateOfBirth', dateOfBirth)
      
      if (photoFile) {
        formData.append('photo', photoFile)
      }

      if (idNumber) formData.append('idNumber', idNumber)
      if (idType) formData.append('idType', idType)
      if (issuingAuthority) formData.append('issuingAuthority', issuingAuthority)

      // Student fields
      if (discountType === 'STUDENT') {
        formData.append('schoolName', schoolName)
        formData.append('schoolAddress', schoolAddress)
        formData.append('gradeLevel', gradeLevel)
        formData.append('schoolIdExpiry', schoolIdExpiry)
      }

      // PWD fields
      if (discountType === 'PWD') {
        formData.append('disabilityType', disabilityType)
        formData.append('pwdIdExpiry', pwdIdExpiry)
      }

      const endpoint = applicationStatus?.application 
        ? '/api/discount-cards/my-application'
        : '/api/discount-cards/apply'

      const method = applicationStatus?.application ? 'PATCH' : 'POST'

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit application')
      }

      setSuccess('Application submitted successfully! Please wait for admin approval.')
      setTimeout(() => {
        checkExistingApplication()
      }, 2000)

    } catch (err: any) {
      setError(err.message || 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Show existing application status
  if (applicationStatus?.hasApplication && applicationStatus.application) {
    const app = applicationStatus.application
    
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Your Discount Application
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Status:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                app.verificationStatus === 'APPROVED' ? 'bg-green-100 text-green-800' :
                app.verificationStatus === 'REJECTED' ? 'bg-red-100 text-red-800' :
                app.verificationStatus === 'UNDER_REVIEW' ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {app.verificationStatus.replace('_', ' ')}
              </span>
            </div>

            <div>
              <span className="text-sm font-medium text-gray-700">Discount Type:</span>
              <p className="text-gray-900 mt-1">
                {app.discountType.replace('_', ' ')}
              </p>
            </div>

            <div>
              <span className="text-sm font-medium text-gray-700">Applied On:</span>
              <p className="text-gray-900 mt-1">
                {new Date(app.createdAt).toLocaleDateString()}
              </p>
            </div>

            {app.verificationStatus === 'APPROVED' && (
              <>
                <div>
                  <span className="text-sm font-medium text-gray-700">Valid Period:</span>
                  <p className="text-gray-900 mt-1">
                    {new Date(app.validFrom).toLocaleDateString()} - {new Date(app.validUntil).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 font-medium">✓ Your discount card is active!</p>
                  <p className="text-green-700 text-sm mt-1">
                    You can now enjoy 20% discount on fare calculations.
                  </p>
                </div>
              </>
            )}

            {app.verificationStatus === 'REJECTED' && app.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">Rejection Reason:</p>
                <p className="text-red-700 text-sm mt-1">
                  {app.rejectionReason}
                </p>
                <button
                  onClick={() => {
                    setApplicationStatus(null)
                    setError(null)
                    setSuccess(null)
                  }}
                  className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                >
                  Resubmit Application
                </button>
              </div>
            )}

            {app.verificationStatus === 'PENDING' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 font-medium">⏳ Application Pending</p>
                <p className="text-yellow-700 text-sm mt-1">
                  Your application is waiting for admin review. You will be notified once it's processed.
                </p>
              </div>
            )}

            {app.verificationStatus === 'UNDER_REVIEW' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 font-medium">👁️ Under Review</p>
                <p className="text-blue-700 text-sm mt-1">
                  An admin is currently reviewing your application.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t">
            <button
              onClick={() => router.push('/calculator')}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go to Fare Calculator
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show application form
  return (
    <div className="max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {/* Discount Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Discount Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setDiscountType('SENIOR_CITIZEN')}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                discountType === 'SENIOR_CITIZEN'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-2">👴</div>
              <div className="font-medium text-gray-900">Senior Citizen</div>
              <div className="text-xs text-gray-500 mt-1">60 years and above</div>
            </button>

            <button
              type="button"
              onClick={() => setDiscountType('PWD')}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                discountType === 'PWD'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-2">♿</div>
              <div className="font-medium text-gray-900">PWD</div>
              <div className="text-xs text-gray-500 mt-1">Person with Disability</div>
            </button>

            <button
              type="button"
              onClick={() => setDiscountType('STUDENT')}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                discountType === 'STUDENT'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-2">🎓</div>
              <div className="font-medium text-gray-900">Student</div>
              <div className="text-xs text-gray-500 mt-1">With valid school ID</div>
            </button>
          </div>
        </div>

        {/* Basic Information */}
        <div className="mb-6 pb-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
          <p className="text-sm text-gray-600 mb-4">
            ℹ️ These details are from your account profile
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                readOnly
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                title="This information is from your profile and cannot be changed here"
              />
              <p className="text-xs text-gray-500 mt-1">
                Update in your <a href="/profile" className="text-blue-600 hover:underline">profile settings</a> if incorrect
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dateOfBirth}
                readOnly
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                title="This information is from your profile and cannot be changed here"
              />
              <p className="text-xs text-gray-500 mt-1">
                Update in your <a href="/profile" className="text-blue-600 hover:underline">profile settings</a> if incorrect
              </p>
            </div>
          </div>
        </div>

        {/* ID Information */}
        <div className="mb-6 pb-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Identification Details</h3>
          {user.governmentId && (
            <p className="text-sm text-gray-600 mb-4">
              ℹ️ ID information from your account profile
            </p>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID Number {discountType === 'PWD' && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="e.g., 1234-5678-9012"
                readOnly={!!user.governmentId}
                disabled={!!user.governmentId}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                  user.governmentId 
                    ? 'bg-gray-100 text-gray-700 cursor-not-allowed' 
                    : 'focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                }`}
                title={user.governmentId ? "This information is from your profile and cannot be changed here" : ""}
                required={discountType === 'PWD'}
              />
              {user.governmentId && (
                <p className="text-xs text-gray-500 mt-1">
                  Update in your <a href="/profile" className="text-blue-600 hover:underline">profile settings</a> if incorrect
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID Type
              </label>
              <input
                type="text"
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                placeholder="e.g., OSCA ID, PWD ID, School ID"
                readOnly={!!user.idType}
                disabled={!!user.idType}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                  user.idType 
                    ? 'bg-gray-100 text-gray-700 cursor-not-allowed' 
                    : 'focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                }`}
                title={user.idType ? "This information is from your profile and cannot be changed here" : ""}
              />
              {user.idType && (
                <p className="text-xs text-gray-500 mt-1">
                  Update in your <a href="/profile" className="text-blue-600 hover:underline">profile settings</a> if incorrect
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Issuing Authority
            </label>
            <input
              type="text"
              value={issuingAuthority}
              onChange={(e) => setIssuingAuthority(e.target.value)}
              placeholder="e.g., DSWD, School Name, Municipal Office"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Photo Upload */}
        <div className="mb-6 pb-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Photo Upload <span className="text-red-500">*</span>
          </h3>
          
          <div className="flex flex-col items-center">
            {photoPreview && (
              <div className="mb-4">
                <img
                  src={photoPreview}
                  alt="ID Preview"
                  className="w-48 h-48 object-cover rounded-lg border-2 border-gray-300"
                />
              </div>
            )}
            
            <label className="cursor-pointer">
              <div className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Choose Photo
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </label>
            
            <p className="text-sm text-gray-500 mt-2 text-center">
              Upload a clear photo for your discount ID card<br />
              (Max 5MB, JPG or PNG format)
            </p>
          </div>
        </div>

        {/* Student-specific fields */}
        {discountType === 'STUDENT' && (
          <div className="mb-6 pb-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Information</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  School Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Enter your school name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  School Address
                </label>
                <input
                  type="text"
                  value={schoolAddress}
                  onChange={(e) => setSchoolAddress(e.target.value)}
                  placeholder="School address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grade/Year Level <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    placeholder="e.g., Grade 12, 3rd Year College"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    School ID Expiry <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={schoolIdExpiry}
                    onChange={(e) => setSchoolIdExpiry(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PWD-specific fields */}
        {discountType === 'PWD' && (
          <div className="mb-6 pb-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">PWD Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Disability Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={disabilityType}
                  onChange={(e) => setDisabilityType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select type</option>
                  <option value="Visual">Visual Disability</option>
                  <option value="Hearing">Hearing Disability</option>
                  <option value="Physical">Physical Disability</option>
                  <option value="Mental">Mental/Psychosocial Disability</option>
                  <option value="Intellectual">Intellectual Disability</option>
                  <option value="Speech">Speech and Language Disability</option>
                  <option value="Multiple">Multiple Disabilities</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PWD ID Expiry <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={pwdIdExpiry}
                  onChange={(e) => setPwdIdExpiry(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>
        )}

        {/* Terms and Submit */}
        <div className="mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-blue-900 mb-2">Important Notes:</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Your application will be reviewed by an administrator</li>
              <li>You will receive 20% discount on transportation fares upon approval</li>
              <li>Please ensure all information is accurate and complete</li>
              <li>Submitting false information may result in application rejection</li>
            </ul>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
          
          <button
            type="button"
            onClick={() => router.push('/profile')}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
