'use client'

import { useState, useEffect } from 'react'

interface DriverProfileData {
  id?: string
  licenseNumber: string
  licenseType: string
  licenseExpiry: string
  emergencyContact: string
  bloodType: string
  medicalRemarks: string
  isActive: boolean
}

interface Vehicle {
  id: string
  plateNumber: string
  vehicleType: string
  make: string
  model: string
  year: number
  color: string
  capacity: number
}

const DriverProfile = () => {
  const [profileData, setProfileData] = useState<DriverProfileData>({
    licenseNumber: '',
    licenseType: '',
    licenseExpiry: '',
    emergencyContact: '',
    bloodType: '',
    medicalRemarks: '',
    isActive: true
  })
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const licenseTypes = [
    { value: 'NON-PROFESSIONAL', label: 'Non-Professional' },
    { value: 'PROFESSIONAL', label: 'Professional' },
    { value: 'STUDENT-PERMIT', label: 'Student Permit' },
    { value: 'CONDUCTOR', label: 'Conductor License' }
  ]

  const bloodTypes = [
    'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
  ]

  useEffect(() => {
    loadDriverProfile()
    loadVehicles()
  }, [])

  const loadDriverProfile = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/driver/profile')
      if (response.ok) {
        const data = await response.json()
        if (data.profile) {
          setProfileData(data.profile)
        } else {
          // No profile exists, allow creation
          setIsEditing(true)
        }
      } else {
        setError('Failed to load profile')
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const loadVehicles = async () => {
    try {
      const response = await fetch('/api/driver/vehicles')
      if (response.ok) {
        const data = await response.json()
        setVehicles(data.vehicles || [])
      }
    } catch (err) {
      console.error('Error loading vehicles:', err)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setProfileData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/driver/profile', {
        method: profileData.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData)
      })

      if (response.ok) {
        const data = await response.json()
        setProfileData(data.profile)
        setSuccess('Profile saved successfully!')
        setIsEditing(false)
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to save profile')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    loadDriverProfile() // Reload original data
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-emerald-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-600 mt-2">Loading profile...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mr-4">
              <span className="text-2xl">🚗</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Driver Profile</h1>
              <p className="text-gray-600">Manage your driver information and license details</p>
            </div>
          </div>
          {!isEditing && profileData.licenseNumber && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Edit Profile
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        {/* License Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="licenseNumber" className="block text-sm font-medium text-gray-700 mb-2">
              License Number *
            </label>
            <input
              type="text"
              id="licenseNumber"
              name="licenseNumber"
              value={profileData.licenseNumber}
              onChange={handleInputChange}
              disabled={!isEditing}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-50"
              placeholder="N01-12-123456"
            />
          </div>
          <div>
            <label htmlFor="licenseType" className="block text-sm font-medium text-gray-700 mb-2">
              License Type *
            </label>
            <select
              id="licenseType"
              name="licenseType"
              value={profileData.licenseType}
              onChange={handleInputChange}
              disabled={!isEditing}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-50"
            >
              <option value="">Select license type</option>
              {licenseTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="licenseExpiry" className="block text-sm font-medium text-gray-700 mb-2">
              License Expiry Date *
            </label>
            <input
              type="date"
              id="licenseExpiry"
              name="licenseExpiry"
              value={profileData.licenseExpiry}
              onChange={handleInputChange}
              disabled={!isEditing}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label htmlFor="bloodType" className="block text-sm font-medium text-gray-700 mb-2">
              Blood Type
            </label>
            <select
              id="bloodType"
              name="bloodType"
              value={profileData.bloodType}
              onChange={handleInputChange}
              disabled={!isEditing}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-50"
            >
              <option value="">Select blood type</option>
              {bloodTypes.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="emergencyContact" className="block text-sm font-medium text-gray-700 mb-2">
              Emergency Contact *
            </label>
            <input
              type="tel"
              id="emergencyContact"
              name="emergencyContact"
              value={profileData.emergencyContact}
              onChange={handleInputChange}
              disabled={!isEditing}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-50"
              placeholder="09XXXXXXXXX"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="medicalRemarks" className="block text-sm font-medium text-gray-700 mb-2">
              Medical Remarks
            </label>
            <textarea
              id="medicalRemarks"
              name="medicalRemarks"
              value={profileData.medicalRemarks}
              onChange={handleInputChange}
              disabled={!isEditing}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-50"
              placeholder="Any medical conditions, medications, or special notes..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex justify-end space-x-4 mt-6 pt-6 border-t">
            <button
              onClick={handleCancel}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center"
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Profile'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Associated Vehicles */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Associated Vehicles</h2>
        
        {vehicles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((vehicle) => (
              <div key={vehicle.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-semibold text-gray-900">{vehicle.plateNumber}</span>
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-full">
                    {vehicle.vehicleType}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><strong>Make/Model:</strong> {vehicle.make} {vehicle.model}</p>
                  <p><strong>Year:</strong> {vehicle.year}</p>
                  <p><strong>Color:</strong> {vehicle.color}</p>
                  <p><strong>Capacity:</strong> {vehicle.capacity} passengers</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <span className="text-4xl mb-4 block">🚗</span>
            <p className="text-gray-500 mb-4">No vehicles associated with your driver profile</p>
            <p className="text-sm text-gray-400">Contact admin to register vehicles to your driver license</p>
          </div>
        )}
      </div>

      {/* License Status */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">License Status</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <span className="w-3 h-3 bg-emerald-500 rounded-full mr-2"></span>
              <span className="font-medium text-emerald-700">Active Status</span>
            </div>
            <p className="text-sm text-emerald-600">
              {profileData.isActive ? 'License is active' : 'License suspended'}
            </p>
          </div>
          
          <div className={`border rounded-lg p-4 ${
            profileData.licenseExpiry && new Date(profileData.licenseExpiry) > new Date() 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center mb-2">
              <span className={`w-3 h-3 rounded-full mr-2 ${
                profileData.licenseExpiry && new Date(profileData.licenseExpiry) > new Date()
                  ? 'bg-green-500' 
                  : 'bg-red-500'
              }`}></span>
              <span className={`font-medium ${
                profileData.licenseExpiry && new Date(profileData.licenseExpiry) > new Date()
                  ? 'text-green-700' 
                  : 'text-red-700'
              }`}>Expiry Status</span>
            </div>
            <p className={`text-sm ${
              profileData.licenseExpiry && new Date(profileData.licenseExpiry) > new Date()
                ? 'text-green-600' 
                : 'text-red-600'
            }`}>
              {profileData.licenseExpiry 
                ? new Date(profileData.licenseExpiry) > new Date()
                  ? 'Valid until ' + new Date(profileData.licenseExpiry).toLocaleDateString()
                  : 'Expired on ' + new Date(profileData.licenseExpiry).toLocaleDateString()
                : 'No expiry date set'
              }
            </p>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
              <span className="font-medium text-blue-700">Vehicles Count</span>
            </div>
            <p className="text-sm text-blue-600">
              {vehicles.length} vehicle(s) registered
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DriverProfile