'use client'

import { useState, useEffect } from 'react'
import { validateCoordinateFormat, generateMapsUrl } from '@/utils/locationValidation'

interface Location {
  id: string
  name: string
  type: string
  coordinates: string
  barangay?: string
  description?: string
  isActive: boolean
  validationStatus?: string
  googleFormattedAddress?: string
  createdAt: string
  updatedAt: string
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  withinMunicipality: boolean
  withinBarangay: boolean
  detectedBarangay: string | null
  googleMapsValid: boolean
  googleAddress: string | null
  googleConfidence: 'high' | 'medium' | 'low'
  recommendations: string[]
}

export default function AdminLocationManager() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [barangayFilter, setBarangayFilter] = useState('')
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'BARANGAY',
    coordinates: '',
    barangay: '',
    description: ''
  })

  useEffect(() => {
    fetchLocations()
  }, [searchTerm, typeFilter, barangayFilter])

  const fetchLocations = async () => {
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams({
        ...(searchTerm && { search: searchTerm }),
        ...(typeFilter && { type: typeFilter }),
        ...(barangayFilter && { barangay: barangayFilter })
      })

      const response = await fetch(`/api/admin/locations?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setLocations(data.locations || [])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleValidate = async () => {
    if (!formData.coordinates) {
      alert('Please enter coordinates first')
      return
    }

    setValidating(true)
    setValidationResult(null)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/locations/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      setValidationResult(data.validation)
    } catch (error) {
      console.error('Error validating location:', error)
      alert('Failed to validate location')
    } finally {
      setValidating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // REQUIRE validation before submit for data accuracy
    if (!validationResult) {
      alert('Please click "Validate Location" before saving to ensure data accuracy.')
      return
    }

    // Check validation results
    if (!validationResult.isValid) {
      const hasGoogleMapsError = validationResult.errors.some(err => 
        err.includes('Google Maps')
      )
      
      if (hasGoogleMapsError) {
        alert('Google Maps validation failed. Please verify the coordinates are correct. This ensures location accuracy.')
        return
      }
      
      // For other errors, allow admin to override with confirmation
      const errorList = validationResult.errors.join('\n• ')
      if (!confirm(`Location has validation errors:\n\n• ${errorList}\n\nContinue anyway? Only do this if you are certain the coordinates are correct.`)) {
        return
      }
    } else if (validationResult.warnings.length > 0) {
      // Show warnings but allow to continue
      const warningList = validationResult.warnings.slice(0, 3).join('\n• ')
      const moreWarnings = validationResult.warnings.length > 3 ? `\n• ... and ${validationResult.warnings.length - 3} more warnings` : ''
      if (!confirm(`Location has warnings:\n\n• ${warningList}${moreWarnings}\n\nContinue with saving?`)) {
        return
      }
    }

    try {
      const token = localStorage.getItem('token')
      const url = editingLocation
        ? `/api/admin/locations/${editingLocation.id}`
        : '/api/admin/locations'

      const response = await fetch(url, {
        method: editingLocation ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          validationResult
        })
      })

      if (response.ok) {
        alert(`Location ${editingLocation ? 'updated' : 'created'} successfully`)
        setShowForm(false)
        setEditingLocation(null)
        setFormData({
          name: '',
          type: 'BARANGAY',
          coordinates: '',
          barangay: '',
          description: ''
        })
        setValidationResult(null)
        fetchLocations()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to save location')
      }
    } catch (error) {
      console.error('Error saving location:', error)
      alert('Failed to save location')
    }
  }

  const handleEdit = (location: Location) => {
    setEditingLocation(location)
    setFormData({
      name: location.name,
      type: location.type,
      coordinates: location.coordinates,
      barangay: location.barangay || '',
      description: location.description || ''
    })
    setValidationResult(null)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this location?')) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/admin/locations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        alert('Location deleted successfully')
        fetchLocations()
      }
    } catch (error) {
      console.error('Error deleting location:', error)
      alert('Failed to delete location')
    }
  }

  const coordinateCheck = validateCoordinateFormat(formData.coordinates)

  if (loading) {
    return <div className="p-6">Loading locations...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Location Management</h2>
        <button
          onClick={() => {
            setShowForm(!showForm)
            if (showForm) {
              setEditingLocation(null)
              setFormData({
                name: '',
                type: 'BARANGAY',
                coordinates: '',
                barangay: '',
                description: ''
              })
              setValidationResult(null)
            }
          }}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg"
        >
          {showForm ? 'Cancel' : '+ Add Location'}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-semibold mb-4">
            {editingLocation ? 'Edit Location' : 'Add New Location'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="BARANGAY">Barangay</option>
                  <option value="LANDMARK">Landmark</option>
                  <option value="URBAN">Urban</option>
                  <option value="RURAL">Rural</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coordinates * (latitude,longitude)
                </label>
                <input
                  type="text"
                  value={formData.coordinates}
                  onChange={(e) => setFormData({ ...formData, coordinates: e.target.value })}
                  placeholder="11.2727,125.0627"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 ${
                    formData.coordinates && !coordinateCheck.valid ? 'border-red-500' : ''
                  }`}
                  required
                />
                {formData.coordinates && !coordinateCheck.valid && (
                  <p className="text-red-500 text-sm mt-1">{coordinateCheck.error}</p>
                )}
                {formData.coordinates && coordinateCheck.valid && (
                  <p className="text-green-600 text-sm mt-1">
                    ✓ Valid format: {coordinateCheck.lat}, {coordinateCheck.lng}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Barangay
                </label>
                <input
                  type="text"
                  value={formData.barangay}
                  onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                rows={3}
              />
            </div>

            {/* Validation Button and Results */}
            <div className="border-t pt-4">
              <div className="flex gap-4 mb-4">
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={validating || !coordinateCheck.valid}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg"
                >
                  {validating ? 'Validating...' : 'Validate Location'}
                </button>

                {formData.coordinates && coordinateCheck.valid && (
                  <a
                    href={generateMapsUrl(formData.coordinates, formData.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg text-gray-700"
                  >
                    View on Google Maps
                  </a>
                )}
              </div>

              {validationResult && (
                <div className={`p-4 rounded-lg ${validationResult.isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <h4 className="font-semibold mb-2">
                    {validationResult.isValid ? '✓ Validation Passed' : '✗ Validation Issues'}
                  </h4>

                  {validationResult.errors.length > 0 && (
                    <div className="mb-2">
                      <p className="font-medium text-red-700">Errors:</p>
                      <ul className="list-disc list-inside text-red-600 text-sm">
                        {validationResult.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationResult.warnings.length > 0 && (
                    <div className="mb-2">
                      <p className="font-medium text-yellow-700">Warnings:</p>
                      <ul className="list-disc list-inside text-yellow-600 text-sm">
                        {validationResult.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                    <div>Within Municipality: {validationResult.withinMunicipality ? '✓ Yes' : '✗ No'}</div>
                    <div>Within Barangay: {validationResult.withinBarangay ? '✓ Yes' : '✗ No'}</div>
                    <div>Google Maps: {validationResult.googleMapsValid ? '✓ Valid' : '✗ Invalid'}</div>
                    <div>Confidence: {validationResult.googleConfidence}</div>
                  </div>

                  {validationResult.detectedBarangay && (
                    <p className="mt-2 text-sm">Detected Barangay: <strong>{validationResult.detectedBarangay}</strong></p>
                  )}

                  {validationResult.recommendations.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium text-gray-700">Recommendations:</p>
                      <ul className="list-disc list-inside text-gray-600 text-sm">
                        {validationResult.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-4 border-t">
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg"
              >
                {editingLocation ? 'Update' : 'Create'} Location
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingLocation(null)
                  setValidationResult(null)
                }}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Search locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Types</option>
            <option value="BARANGAY">Barangay</option>
            <option value="LANDMARK">Landmark</option>
            <option value="URBAN">Urban</option>
            <option value="RURAL">Rural</option>
          </select>
          <input
            type="text"
            placeholder="Filter by barangay..."
            value={barangayFilter}
            onChange={(e) => setBarangayFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Locations Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Barangay</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coordinates</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {locations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  No locations found
                </td>
              </tr>
            ) : (
              locations.map((location) => (
                <tr key={location.id} className={!location.isActive ? 'bg-gray-50 opacity-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{location.name}</div>
                    {location.description && (
                      <div className="text-sm text-gray-500">{location.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {location.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {location.barangay || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <a
                      href={generateMapsUrl(location.coordinates, location.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {location.coordinates}
                    </a>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      location.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {location.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleEdit(location)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(location.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
