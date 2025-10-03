'use client'

import { useState, useEffect } from 'react'

interface IncidentForm {
  incidentType: string
  description: string
  location: string
  plateNumber: string
  driverLicense: string
  vehicleType: string
  incidentDate: string
  incidentTime: string
  evidenceFiles: File[]
}

interface GPSPosition {
  latitude: number
  longitude: number
}

const IncidentReporting = () => {
  const [formData, setFormData] = useState<IncidentForm>({
    incidentType: '',
    description: '',
    location: '',
    plateNumber: '',
    driverLicense: '',
    vehicleType: '',
    incidentDate: new Date().toISOString().split('T')[0],
    incidentTime: new Date().toTimeString().slice(0, 5),
    evidenceFiles: []
  })
  const [currentLocation, setCurrentLocation] = useState<GPSPosition | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [locationLoading, setLocationLoading] = useState(false)

  const incidentTypes = [
    { value: 'FARE_OVERCHARGE', label: 'Fare Overcharging' },
    { value: 'FARE_UNDERCHARGE', label: 'Fare Undercharging' },
    { value: 'RECKLESS_DRIVING', label: 'Reckless Driving' },
    { value: 'VEHICLE_VIOLATION', label: 'Vehicle Violation' },
    { value: 'ROUTE_VIOLATION', label: 'Route Violation' },
    { value: 'OTHER', label: 'Other Violation' }
  ]

  const vehicleTypes = [
    { value: 'JEEPNEY', label: 'Jeepney' },
    { value: 'TRICYCLE', label: 'Tricycle' },
    { value: 'HABAL_HABAL', label: 'Habal-habal' },
    { value: 'MULTICAB', label: 'Multicab' },
    { value: 'BUS', label: 'Bus' },
    { value: 'VAN', label: 'Van' }
  ]

  const barangays = [
    'Amandayehan', 'Anglit', 'Bacubac', 'Baloog', 'Basiao', 'Buenavista', 'Burgos',
    'Cambayan', 'Can-abay', 'Cancaiyas', 'Canmanila', 'Catadman', 'Cogon', 'Dolongan',
    'Guintigui-an', 'Guirang', 'Balante', 'Iba', 'Inuntan', 'Loog', 'Mabini',
    'Magallanes', 'Manlilinab', 'Del Pilar', 'May-it', 'Mongabong', 'New San Agustin',
    'Nouvelas Occidental', 'Old San Agustin', 'Panugmonon', 'Pelit',
    'Baybay (Poblacion)', 'Buscada (Poblacion)', 'Lawa-an (Poblacion)', 'Loyo (Poblacion)',
    'Mercado (Poblacion)', 'Palaypay (Poblacion)', 'Sulod (Poblacion)',
    'Roxas', 'Salvacion', 'San Antonio', 'San Fernando', 'Sawa', 'Serum', 'Sugca',
    'Sugponon', 'Tinaogan', 'Tingib', 'Villa Aurora', 'Binongtu-an', 'Bulao'
  ]

  useEffect(() => {
    // Get current location on component mount
    getCurrentLocation()
  }, [])

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }

    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
        setLocationLoading(false)
      },
      (error) => {
        console.error('Error getting location:', error)
        setLocationLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    )
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setFormData(prev => ({
      ...prev,
      evidenceFiles: files
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Create form data for file upload
      const submitData = new FormData()
      
      // Add text fields
      Object.keys(formData).forEach(key => {
        if (key !== 'evidenceFiles') {
          submitData.append(key, formData[key as keyof IncidentForm] as string)
        }
      })

      // Add location coordinates if available
      if (currentLocation) {
        submitData.append('coordinates', JSON.stringify(currentLocation))
      }

      // Add files
      formData.evidenceFiles.forEach((file, index) => {
        submitData.append(`evidence_${index}`, file)
      })

      const response = await fetch('/api/incidents/report', {
        method: 'POST',
        body: submitData
      })

      if (response.ok) {
        setSuccess('Incident report submitted successfully! Reference ID will be provided via email.')
        // Reset form
        setFormData({
          incidentType: '',
          description: '',
          location: '',
          plateNumber: '',
          driverLicense: '',
          vehicleType: '',
          incidentDate: new Date().toISOString().split('T')[0],
          incidentTime: new Date().toTimeString().slice(0, 5),
          evidenceFiles: []
        })
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to submit report')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Report an Incident</h2>
        <p className="text-gray-600">
          Help maintain fair transportation by reporting violations
        </p>
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Incident Type */}
        <div>
          <label htmlFor="incidentType" className="block text-sm font-medium text-gray-700 mb-2">
            Incident Type *
          </label>
          <select
            id="incidentType"
            name="incidentType"
            value={formData.incidentType}
            onChange={handleInputChange}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="">Select incident type</option>
            {incidentTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Incident Description *
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            required
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            placeholder="Please provide detailed description of the incident..."
          />
        </div>

        {/* Date and Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="incidentDate" className="block text-sm font-medium text-gray-700 mb-2">
              Incident Date *
            </label>
            <input
              type="date"
              id="incidentDate"
              name="incidentDate"
              value={formData.incidentDate}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
          <div>
            <label htmlFor="incidentTime" className="block text-sm font-medium text-gray-700 mb-2">
              Incident Time *
            </label>
            <input
              type="time"
              id="incidentTime"
              name="incidentTime"
              value={formData.incidentTime}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
        </div>

        {/* Location */}
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
            Location *
          </label>
          <div className="flex space-x-2">
            <select
              id="location"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              required
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">Select barangay</option>
              {barangays.map(barangay => (
                <option key={barangay} value={barangay}>
                  {barangay}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={getCurrentLocation}
              disabled={locationLoading}
              className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              title="Get current location"
            >
              {locationLoading ? '📡' : '📍'}
            </button>
          </div>
          {currentLocation && (
            <p className="text-xs text-green-600 mt-1">
              📍 GPS coordinates captured ({currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)})
            </p>
          )}
        </div>

        {/* Vehicle Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="plateNumber" className="block text-sm font-medium text-gray-700 mb-2">
              Plate Number
            </label>
            <input
              type="text"
              id="plateNumber"
              name="plateNumber"
              value={formData.plateNumber}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="ABC 1234"
            />
          </div>
          <div>
            <label htmlFor="vehicleType" className="block text-sm font-medium text-gray-700 mb-2">
              Vehicle Type
            </label>
            <select
              id="vehicleType"
              name="vehicleType"
              value={formData.vehicleType}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">Select vehicle type</option>
              {vehicleTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Driver License */}
        <div>
          <label htmlFor="driverLicense" className="block text-sm font-medium text-gray-700 mb-2">
            Driver's License Number
          </label>
          <input
            type="text"
            id="driverLicense"
            name="driverLicense"
            value={formData.driverLicense}
            onChange={handleInputChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            placeholder="N01-12-123456"
          />
        </div>

        {/* Evidence Upload */}
        <div>
          <label htmlFor="evidence" className="block text-sm font-medium text-gray-700 mb-2">
            Evidence (Photos/Videos)
          </label>
          <input
            type="file"
            id="evidence"
            name="evidence"
            onChange={handleFileChange}
            multiple
            accept="image/*,video/*"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Upload photos or videos as evidence (max 5 files, 10MB each)
          </p>
          {formData.evidenceFiles.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-green-600">
                {formData.evidenceFiles.length} file(s) selected
              </p>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </>
            ) : (
              'Submit Report'
            )}
          </button>
        </div>
      </form>

      {/* Emergency Contact */}
      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center mb-2">
          <span className="text-lg mr-2">📞</span>
          <h3 className="font-semibold text-yellow-800">Emergency Hotlines</h3>
        </div>
        <div className="space-y-1 text-sm text-yellow-700">
          <p>Traffic Enforcement: 09985986570</p>
          <p>Municipal Office: 09177140798</p>
          <p>Emergency: 911</p>
        </div>
      </div>
    </div>
  )
}

export default IncidentReporting