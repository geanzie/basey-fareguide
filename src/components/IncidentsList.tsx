'use client'

import { useState, useEffect } from 'react'

interface Incident {
  id: string
  incidentType: string
  description: string
  location: string
  plateNumber: string
  driverLicense: string
  status: string
  incidentDate: string
  createdAt: string
  reportedBy: {
    firstName: string
    lastName: string
  }
  handledBy?: {
    firstName: string
    lastName: string
  }
  penaltyAmount?: number
  remarks?: string
}

const IncidentsList = () => {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    status: 'ALL',
    incidentType: 'ALL',
    dateRange: 'ALL'
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [showModal, setShowModal] = useState(false)

  const statusOptions = [
    { value: 'ALL', label: 'All Status' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'INVESTIGATING', label: 'Investigating' },
    { value: 'RESOLVED', label: 'Resolved' },
    { value: 'DISMISSED', label: 'Dismissed' }
  ]

  const incidentTypeOptions = [
    { value: 'ALL', label: 'All Types' },
    { value: 'FARE_OVERCHARGE', label: 'Fare Overcharging' },
    { value: 'FARE_UNDERCHARGE', label: 'Fare Undercharging' },
    { value: 'RECKLESS_DRIVING', label: 'Reckless Driving' },
    { value: 'VEHICLE_VIOLATION', label: 'Vehicle Violation' },
    { value: 'ROUTE_VIOLATION', label: 'Route Violation' },
    { value: 'OTHER', label: 'Other Violation' }
  ]

  useEffect(() => {
    loadIncidents()
  }, [filter])

  const loadIncidents = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter.status !== 'ALL') params.append('status', filter.status)
      if (filter.incidentType !== 'ALL') params.append('type', filter.incidentType)
      if (filter.dateRange !== 'ALL') params.append('dateRange', filter.dateRange)

      const token = localStorage.getItem('token')
      const response = await fetch(`/api/incidents?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setIncidents(data.incidents || [])
      } else {      }
    } catch (err) {} finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target
    setFilter(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      INVESTIGATING: 'bg-blue-100 text-blue-800',
      RESOLVED: 'bg-green-100 text-green-800',
      DISMISSED: 'bg-gray-100 text-gray-800'
    }
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800'
  }

  const getIncidentTypeLabel = (type: string) => {
    const labels = {
      FARE_OVERCHARGE: 'Fare Overcharge',
      FARE_UNDERCHARGE: 'Fare Undercharge',
      RECKLESS_DRIVING: 'Reckless Driving',
      VEHICLE_VIOLATION: 'Vehicle Violation',
      ROUTE_VIOLATION: 'Route Violation',
      OTHER: 'Other'
    }
    return labels[type as keyof typeof labels] || type
  }

  const handleViewDetails = (incident: Incident) => {
    setSelectedIncident(incident)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedIncident(null)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Incident Reports</h1>
            <p className="text-gray-600 mt-1">Monitor and manage transportation violations</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-2xl">📋</span>
            <div className="text-right">
              <div className="text-sm text-gray-500">Total Incidents</div>
              <div className="text-2xl font-bold text-gray-900">{incidents.length}</div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
            Search Incidents
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              id="search"
              placeholder="Search by plate number, location, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={filter.status}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="incidentType" className="block text-sm font-medium text-gray-700 mb-2">
              Incident Type
            </label>
            <select
              id="incidentType"
              name="incidentType"
              value={filter.incidentType}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {incidentTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dateRange" className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <select
              id="dateRange"
              name="dateRange"
              value={filter.dateRange}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="WEEK">This Week</option>
              <option value="MONTH">This Month</option>
              <option value="YEAR">This Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Incidents List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-emerald-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-600 mt-2">Loading incidents...</p>
            </div>
          </div>
        ) : (() => {
          // Apply search filter
          const filteredIncidents = incidents.filter(incident => {
            if (!searchQuery.trim()) return true
            
            const query = searchQuery.toLowerCase()
            return (
              incident.plateNumber?.toLowerCase().includes(query) ||
              incident.location?.toLowerCase().includes(query) ||
              incident.description?.toLowerCase().includes(query) ||
              incident.incidentType?.toLowerCase().includes(query) ||
              `${incident.reportedBy?.firstName} ${incident.reportedBy?.lastName}`.toLowerCase().includes(query)
            )
          })
          
          return filteredIncidents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Incident
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vehicle
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredIncidents.map((incident) => (
                  <tr key={incident.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {getIncidentTypeLabel(incident.incidentType)}
                        </div>
                        <div className="text-sm text-gray-500">
                          Reported by: {incident.reportedBy.firstName} {incident.reportedBy.lastName}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {incident.plateNumber || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {incident.driverLicense || 'No license'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {incident.location}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(incident.status)}`}>
                        {incident.status.toLowerCase().replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatDate(incident.incidentDate)}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleViewDetails(incident)}
                        className="text-emerald-600 hover:text-emerald-900 text-sm font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <span className="text-4xl mb-4 block">�</span>
              <p className="text-gray-500 text-lg">No incidents found</p>
              <p className="text-gray-400 text-sm mt-2">
                {searchQuery ? 'Try adjusting your search terms' : 'Try adjusting your filters or check back later'}
              </p>
            </div>
          )
        })()}
      </div>

      {/* Incident Details Modal */}
      {showModal && selectedIncident && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Incident Details
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Incident Type</label>
                    <p className="mt-1 text-sm text-gray-900">{getIncidentTypeLabel(selectedIncident.incidentType)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <span className={`mt-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(selectedIncident.status)}`}>
                      {selectedIncident.status.toLowerCase().replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                    {selectedIncident.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Location</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedIncident.location}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Incident Date</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDate(selectedIncident.incidentDate)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Plate Number</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedIncident.plateNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Driver License</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedIncident.driverLicense || 'N/A'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Reported By</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedIncident.reportedBy.firstName} {selectedIncident.reportedBy.lastName}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Handled By</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedIncident.handledBy 
                        ? `${selectedIncident.handledBy.firstName} ${selectedIncident.handledBy.lastName}`
                        : 'Not assigned'
                      }
                    </p>
                  </div>
                </div>

                {selectedIncident.penaltyAmount && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Penalty Amount</label>
                    <p className="mt-1 text-sm text-gray-900 font-semibold text-red-600">
                      ₱{selectedIncident.penaltyAmount.toLocaleString()}
                    </p>
                  </div>
                )}

                {selectedIncident.remarks && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Remarks</label>
                    <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                      {selectedIncident.remarks}
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end mt-6 pt-4 border-t">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default IncidentsList