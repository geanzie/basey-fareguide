'use client'

import { useState, useEffect } from 'react'
import useSWR, { useSWRConfig } from 'swr'

import type { UserProfileDto, UserProfileResponseDto } from '@/lib/contracts'
import { SWR_KEYS } from '@/lib/swrKeys'
import { fetchUserProfileResponse } from '@/lib/userProfile'

export default function UserProfile() {
  const { mutate: mutateCache } = useSWRConfig()
  const { data, isLoading } = useSWR<UserProfileResponseDto | null>(
    SWR_KEYS.userProfile,
    fetchUserProfileResponse,
  )
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    dateOfBirth: '',
    governmentId: '',
    idType: '',
    barangayResidence: ''
  })

  useEffect(() => {
    const user = data?.user

    if (!user) {
      return
    }

    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
      governmentId: user.governmentId || '',
      idType: user.idType || '',
      barangayResidence: user.barangayResidence || ''
    })
  }, [data])

  const user: UserProfileDto | null = data?.user ?? null

  const handleSaveProfile = async () => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        await mutateCache(
          SWR_KEYS.userProfile,
          { user: data.user },
          { populateCache: true, revalidate: false },
        )
        setIsEditing(false)
      } else {
        setError(data.message || 'Failed to update profile')
      }
    } catch (err) {
      setError('An error occurred while updating profile')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  if (isLoading && !user) {
    return (
      <div className="app-surface-card rounded-2xl p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app-surface-card rounded-2xl p-6">
        <p className="text-red-600">{error || 'User not found'}</p>
      </div>
    )
  }

  return (
    <div className="app-surface-card rounded-2xl">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <h2 className="text-xl font-semibold text-gray-900">My Profile</h2>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Edit Profile
          </button>
        ) : (
          <div className="space-x-2">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => {
                setIsEditing(false)
                setError('')
                // Reset form data
                setFormData({
                  firstName: user.firstName || '',
                  lastName: user.lastName || '',
                  email: user.email || '',
                  phoneNumber: user.phoneNumber || '',
                  dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
                  governmentId: user.governmentId || '',
                  idType: user.idType || '',
                  barangayResidence: user.barangayResidence || ''
                })
              }}
              className="app-surface-inner rounded-lg px-4 py-2 text-gray-700 transition-colors hover:bg-white/80"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="p-6">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Basic Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={user.username}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">Username cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                name="firstName"
                value={isEditing ? formData.firstName : user.firstName || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border rounded-lg ${
                  isEditing 
                    ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                    : 'border-gray-300 bg-gray-50'
                }`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                name="lastName"
                value={isEditing ? formData.lastName : user.lastName || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border rounded-lg ${
                  isEditing 
                    ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                    : 'border-gray-300 bg-gray-50'
                }`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                name="email"
                value={isEditing ? formData.email : user.email || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                placeholder="your@email.com"
                className={`w-full px-3 py-2 border rounded-lg ${
                  isEditing 
                    ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                    : 'border-gray-300 bg-gray-50'
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">Required for password reset</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                name="phoneNumber"
                value={isEditing ? formData.phoneNumber : user.phoneNumber || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                placeholder="09xxxxxxxxx"
                className={`w-full px-3 py-2 border rounded-lg ${
                  isEditing 
                    ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                    : 'border-gray-300 bg-gray-50'
                }`}
              />
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Additional Information</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input
                type="date"
                name="dateOfBirth"
                value={isEditing ? formData.dateOfBirth : user.dateOfBirth ? user.dateOfBirth.split('T')[0] : ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border rounded-lg ${
                  isEditing 
                    ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                    : 'border-gray-300 bg-gray-50'
                }`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Government ID Type</label>
              <select
                name="idType"
                value={isEditing ? formData.idType : user.idType || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border rounded-lg ${
                  isEditing 
                    ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                    : 'border-gray-300 bg-gray-50'
                }`}
              >
                <option value="">Select ID Type</option>
                <option value="National ID">National ID</option>
                <option value="Driver's License">Driver's License</option>
                <option value="Passport">Passport</option>
                <option value="Voter's ID">Voter's ID</option>
                <option value="PhilHealth ID">PhilHealth ID</option>
                <option value="SSS ID">SSS ID</option>
                <option value="TIN ID">TIN ID</option>
                <option value="Senior Citizen ID">Senior Citizen ID</option>
                <option value="PWD ID">PWD ID</option>
                <option value="Student ID">Student ID</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Government ID Number</label>
              <input
                type="text"
                name="governmentId"
                value={isEditing ? formData.governmentId : user.governmentId || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border rounded-lg ${
                  isEditing 
                    ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                    : 'border-gray-300 bg-gray-50'
                }`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Barangay Residence</label>
              <input
                type="text"
                name="barangayResidence"
                value={isEditing ? formData.barangayResidence : user.barangayResidence || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border rounded-lg ${
                  isEditing 
                    ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                    : 'border-gray-300 bg-gray-50'
                }`}
              />
            </div>

            {/* Account Status */}
            <div className="app-surface-inner mt-6 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Account Status</h4>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">
                  User Type: <span className="font-medium capitalize">{user.userType.toLowerCase()}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Status: <span className={`font-medium ${user.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </p>
                <p className="text-sm text-gray-600">
                  Verified: <span className={`font-medium ${user.isVerified ? 'text-green-600' : 'text-yellow-600'}`}>
                    {user.isVerified ? 'Yes' : 'Pending'}
                  </span>
                </p>
                <p className="text-sm text-gray-600">
                  Member Since: <span className="font-medium">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
