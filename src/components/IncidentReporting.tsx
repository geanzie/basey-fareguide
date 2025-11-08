'use client'

import { useState, useEffect } from 'react'

interface IncidentForm {
  incidentType: string
  description: string
  location: string
  vehicleId: string
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

interface Vehicle {
  id: string
  plateNumber: string
  vehicleType: string
  make: string
  model: string
  color: string
  ownerName: string
  driverName: string | null
  driverLicense: string | null
  isActive: boolean
  permit: {
    id: string
    permitPlateNumber: string
    status: string
    issuedDate: string
    expiryDate: string
  } | null
}

const IncidentReporting = () => {
  const [formData, setFormData] = useState<IncidentForm>({
    incidentType: '',
    description: '',
    location: '',
    vehicleId: '',
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
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vehiclesLoading, setVehiclesLoading] = useState(true)
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([])

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
    // Fetch available vehicles
    fetchVehicles()
  }, [])

  useEffect(() => {
    // Filter vehicles based on search term
    if (vehicleSearch.trim() === '') {
      setFilteredVehicles(vehicles)
    } else {
      const searchTerm = vehicleSearch.toLowerCase()
      const filtered = vehicles.filter(vehicle => 
        vehicle.plateNumber.toLowerCase().includes(searchTerm) ||
        vehicle.vehicleType.toLowerCase().includes(searchTerm) ||
        vehicle.make.toLowerCase().includes(searchTerm) ||
        vehicle.model.toLowerCase().includes(searchTerm) ||
        vehicle.color.toLowerCase().includes(searchTerm) ||
        vehicle.ownerName.toLowerCase().includes(searchTerm) ||
        (vehicle.driverName && vehicle.driverName.toLowerCase().includes(searchTerm)) ||
        (vehicle.permit?.permitPlateNumber && vehicle.permit.permitPlateNumber.toLowerCase().includes(searchTerm))
      )
      setFilteredVehicles(filtered)
    }
  }, [vehicles, vehicleSearch])

  const fetchVehicles = async () => {
    try {
      setVehiclesLoading(true)
      const token = localStorage.getItem('token')
      
      const response = await fetch('/api/vehicles?isActive=true&limit=200', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        // Filter vehicles to only include those with active permits
        const vehiclesWithPermits = (data.vehicles || []).filter((vehicle: Vehicle) => {
          return vehicle.permit && 
                 vehicle.permit.status === 'ACTIVE' && 
                 new Date(vehicle.permit.expiryDate) > new Date()
        })
        setVehicles(vehiclesWithPermits)
      } else {      }
    } catch (err) {} finally {
      setVehiclesLoading(false)
    }
  }

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
      (error) => {        setLocationLoading(false)
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

  const handleVehicleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vehicleId = e.target.value
    const selectedVehicle = vehicles.find(v => v.id === vehicleId)
    
    setFormData(prev => ({
      ...prev,
      vehicleId,
      plateNumber: selectedVehicle?.plateNumber || '',
      vehicleType: selectedVehicle?.vehicleType || '',
      driverLicense: selectedVehicle?.driverLicense || ''
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

      const token = localStorage.getItem('token')
      
      const response = await fetch('/api/incidents/report', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: submitData
      })

      if (response.ok) {
        setSuccess('Incident report submitted successfully! Reference ID will be provided via email.')
        // Reset form
        setFormData({
          incidentType: '',
          description: '',
          location: '',
          vehicleId: '',
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
          Help maintain fair transportation by reporting violations. Select the vehicle involved from our registered database.
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

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center mb-2">
          <span className="text-lg mr-2">💡</span>
          <h3 className="font-semibold text-blue-800">How to Report</h3>
        </div>
        <div className="space-y-1 text-sm text-blue-700">
          <p>1. Select the vehicle from the dropdown list (only vehicles with active permits are shown)</p>
          <p>2. Choose the type of incident you witnessed</p>
          <p>3. Provide detailed description and exact location</p>
          <p>4. Upload photos or videos as evidence (if available)</p>
          <p>5. Submit the report - you'll receive a reference number via email</p>
        </div>
      </div>

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

        {/* Vehicle Selection */}
        <div>
          <label htmlFor="vehicleId" className="block text-sm font-medium text-gray-700 mb-2">
            Select Vehicle to Report *
          </label>
          <div className="mb-2 text-xs text-green-600 bg-green-50 border border-green-200 rounded px-2 py-1">
            ℹ️ Only vehicles with active permits are shown in this list
          </div>
          
          {/* Search Input */}
          <div className="mb-3">
            <input
              type="text"
              placeholder="Search by plate/permit number, vehicle type, make, model, color, owner, or driver name..."
              value={vehicleSearch}
              onChange={(e) => setVehicleSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              disabled={vehiclesLoading}
            />
            {vehicleSearch && (
              <p className="text-xs text-gray-600 mt-1">
                Found {filteredVehicles.length} vehicle(s) matching "{vehicleSearch}"
              </p>
            )}
          </div>

          <select
            id="vehicleId"
            name="vehicleId"
            value={formData.vehicleId}
            onChange={handleVehicleChange}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            disabled={vehiclesLoading}
          >
            <option value="">
              {vehiclesLoading ? 'Loading vehicles...' : 'Choose a vehicle to report'}
            </option>
            {filteredVehicles.map(vehicle => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.permit?.permitPlateNumber || vehicle.plateNumber} - {vehicle.vehicleType.replace('_', ' ')} 
                ({vehicle.make} {vehicle.model}, {vehicle.color})
                {vehicle.driverName && ` - Driver: ${vehicle.driverName}`}
                {vehicle.permit && ` - Permit: ${vehicle.permit.permitPlateNumber}`}
              </option>
            ))}
          </select>
          
          {filteredVehicles.length === 0 && vehicleSearch && !vehiclesLoading && (
            <p className="text-sm text-red-600 mt-1">
              No vehicles found matching your search. Try different keywords.
            </p>
          )}
          
          {formData.vehicleId && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-1">Selected Vehicle Details:</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p><strong>Plate Number:</strong> {formData.plateNumber}</p>
                <p><strong>Type:</strong> {formData.vehicleType.replace('_', ' ')}</p>
                {vehicles.find(v => v.id === formData.vehicleId)?.ownerName && (
                  <p><strong>Owner:</strong> {vehicles.find(v => v.id === formData.vehicleId)?.ownerName}</p>
                )}
                {formData.driverLicense && (
                  <p><strong>Driver License:</strong> {formData.driverLicense}</p>
                )}
                {vehicles.find(v => v.id === formData.vehicleId)?.permit && (
                  <p><strong>Permit:</strong> {vehicles.find(v => v.id === formData.vehicleId)?.permit?.permitPlateNumber} 
                    <span className="text-green-600 ml-1">✓ Active</span>
                  </p>
                )}
              </div>
            </div>
          )}
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