'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { VehicleType } from '@/generated/prisma'

export default function VehicleRegistrationForm() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    plateNumber: '',
    vehicleType: VehicleType.TRICYCLE as VehicleType,
    make: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    capacity: 4,
    ownerName: '',
    ownerContact: '',
    driverName: '',
    driverLicense: '',
    registrationExpiry: '',
    insuranceExpiry: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.plateNumber.trim()) {
      newErrors.plateNumber = 'Plate number is required'
    }
    if (!formData.make.trim()) {
      newErrors.make = 'Make is required'
    }
    if (!formData.model.trim()) {
      newErrors.model = 'Model is required'
    }
    if (!formData.year || formData.year < 1900 || formData.year > new Date().getFullYear() + 1) {
      newErrors.year = 'Please enter a valid year'
    }
    if (!formData.color.trim()) {
      newErrors.color = 'Color is required'
    }
    if (!formData.capacity || formData.capacity < 1) {
      newErrors.capacity = 'Capacity must be at least 1'
    }
    if (!formData.ownerName.trim()) {
      newErrors.ownerName = 'Owner name is required'
    }
    if (!formData.ownerContact.trim()) {
      newErrors.ownerContact = 'Owner contact is required'
    }
    if (!formData.registrationExpiry) {
      newErrors.registrationExpiry = 'Registration expiry date is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    try {
      setLoading(true)

      const submitData = {
        ...formData,
        capacity: parseInt(formData.capacity.toString()),
        year: parseInt(formData.year.toString()),
        driverName: formData.driverName || null,
        driverLicense: formData.driverLicense || null,
        insuranceExpiry: formData.insuranceExpiry || null
      }

      const response = await fetch('/api/vehicles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      })

      if (response.ok) {
        router.push('/encoder/vehicles')
      } else {
        const errorData = await response.json()
        if (errorData.error) {
          if (errorData.error.includes('plate number')) {
            setErrors({ plateNumber: 'Vehicle with this plate number already exists' })
          } else {
            setErrors({ submit: errorData.error })
          }
        }
      }
    } catch (error) {
      console.error('Error creating vehicle:', error)
      setErrors({ submit: 'Failed to register vehicle. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Vehicle Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Vehicle Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plate Number *
                </label>
                <input
                  type="text"
                  name="plateNumber"
                  value={formData.plateNumber}
                  onChange={handleInputChange}
                  placeholder="e.g., ABC-1234"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    errors.plateNumber ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.plateNumber && <p className="mt-1 text-sm text-red-600">{errors.plateNumber}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Type *
                </label>
                <select
                  name="vehicleType"
                  value={formData.vehicleType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value={VehicleType.TRICYCLE}>Tricycle</option>
                  <option value={VehicleType.JEEPNEY}>Jeepney</option>
                  <option value={VehicleType.HABAL_HABAL}>Habal-habal</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Make *
                </label>
                <input
                  type="text"
                  name="make"
                  value={formData.make}
                  onChange={handleInputChange}
                  placeholder="e.g., Honda, Suzuki, Toyota"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    errors.make ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.make && <p className="mt-1 text-sm text-red-600">{errors.make}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Model *
                </label>
                <input
                  type="text"
                  name="model"
                  value={formData.model}
                  onChange={handleInputChange}
                  placeholder="e.g., TMX 155, Multicab"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    errors.model ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.model && <p className="mt-1 text-sm text-red-600">{errors.model}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Year *
                </label>
                <select
                  name="year"
                  value={formData.year}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    errors.year ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                {errors.year && <p className="mt-1 text-sm text-red-600">{errors.year}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color *
                </label>
                <input
                  type="text"
                  name="color"
                  value={formData.color}
                  onChange={handleInputChange}
                  placeholder="e.g., Red, Blue, White"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    errors.color ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.color && <p className="mt-1 text-sm text-red-600">{errors.color}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacity (passengers) *
                </label>
                <input
                  type="number"
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleInputChange}
                  min="1"
                  max="50"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    errors.capacity ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.capacity && <p className="mt-1 text-sm text-red-600">{errors.capacity}</p>}
              </div>
            </div>
          </div>

          {/* Owner and Driver */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Owner & Driver Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Owner Name *
                </label>
                <input
                  type="text"
                  name="ownerName"
                  value={formData.ownerName}
                  onChange={handleInputChange}
                  placeholder="e.g., Juan Dela Cruz"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    errors.ownerName ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.ownerName && <p className="mt-1 text-sm text-red-600">{errors.ownerName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Owner Contact *
                </label>
                <input
                  type="text"
                  name="ownerContact"
                  value={formData.ownerContact}
                  onChange={handleInputChange}
                  placeholder="Phone number or email"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    errors.ownerContact ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.ownerContact && <p className="mt-1 text-sm text-red-600">{errors.ownerContact}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Driver Name (Optional)
                </label>
                <input
                  type="text"
                  name="driverName"
                  value={formData.driverName}
                  onChange={handleInputChange}
                  placeholder="e.g., Pedro Santos"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <p className="mt-1 text-sm text-gray-500">Leave empty if no driver assigned</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Driver License Number (Optional)
                </label>
                <input
                  type="text"
                  name="driverLicense"
                  value={formData.driverLicense}
                  onChange={handleInputChange}
                  placeholder="e.g., A01-12-345678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <p className="mt-1 text-sm text-gray-500">Driver's license number if available</p>
              </div>
            </div>
          </div>

          {/* Registration and Insurance */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Registration & Insurance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Registration Expiry Date *
                </label>
                <input
                  type="date"
                  name="registrationExpiry"
                  value={formData.registrationExpiry}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    errors.registrationExpiry ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.registrationExpiry && <p className="mt-1 text-sm text-red-600">{errors.registrationExpiry}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Insurance Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  name="insuranceExpiry"
                  value={formData.insuranceExpiry}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <p className="mt-1 text-sm text-gray-500">Leave empty if no insurance or unknown expiry</p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Registering...' : 'Register Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}