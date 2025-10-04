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
  ticketNumber: string | null
  resolvedAt: string | null
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
  evidenceUrls?: string[]
}

const EnforcerIncidentsList = () => {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [ticketNumber, setTicketNumber] = useState('')
  const [resolving, setResolving] = useState(false)
  const [filter, setFilter] = useState('all') // 'all', 'pending', 'investigating', 'resolved'

  useEffect(() => {
    fetchIncidents()
  }, [])

  const fetchIncidents = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      const response = await fetch('/api/incidents/enforcer', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch incidents')
      }

      const data = await response.json()
      // Sort by createdAt (FIFO - First In, First Out)
      const sortedIncidents = data.incidents.sort((a: Incident, b: Incident) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      setIncidents(sortedIncidents)
    } catch (err) {
      setError('Failed to load incidents')
      console.error('Fetch incidents error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleResolveIncident = async () => {
    if (!selectedIncident || !ticketNumber.trim()) {
      setError('Ticket number is required')
      return
    }

    try {
      setResolving(true)
      const token = localStorage.getItem('token')
      
      const response = await fetch(`/api/incidents/${selectedIncident.id}/resolve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ticketNumber: ticketNumber.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to resolve incident')
      }

      // Refresh incidents list
      await fetchIncidents()
      setShowResolveModal(false)
      setTicketNumber('')
      setSelectedIncident(null)
      setShowModal(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setResolving(false)
    }
  }

  const handleTakeIncident = async (incidentId: string) => {
    try {
      const token = localStorage.getItem('token')
      
      const response = await fetch(`/api/incidents/${incidentId}/take`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to take incident')
      }

      // Refresh incidents list
      await fetchIncidents()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleViewDetails = (incident: Incident) => {
    setSelectedIncident(incident)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedIncident(null)
    setError('')
  }

  const openResolveModal = () => {
    setShowResolveModal(true)
    setTicketNumber('')
    setError('')
  }

  const closeResolveModal = () => {
    setShowResolveModal(false)
    setTicketNumber('')
    setError('')
  }

  const getIncidentTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      'FARE_OVERCHARGE': 'Fare Overcharge',
      'FARE_UNDERCHARGE': 'Fare Undercharge',
      'RECKLESS_DRIVING': 'Reckless Driving',
      'VEHICLE_VIOLATION': 'Vehicle Violation',
      'ROUTE_VIOLATION': 'Route Violation',
      'OTHER': 'Other'
    }
    return labels[type] || type
  }

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: string } = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'INVESTIGATING': 'bg-blue-100 text-blue-800',
      'RESOLVED': 'bg-green-100 text-green-800',
      'DISMISSED': 'bg-gray-100 text-gray-800'
    }
    return badges[status] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityLevel = (incident: Incident) => {
    const now = new Date()
    const createdAt = new Date(incident.createdAt)
    const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
    
    if (hoursDiff > 48) return { level: 'High', color: 'text-red-600' }
    if (hoursDiff > 24) return { level: 'Medium', color: 'text-orange-600' }
    return { level: 'Normal', color: 'text-green-600' }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTimeElapsed = (dateString: string) => {
    const now = new Date()
    const created = new Date(dateString)
    const diffInHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60)
      return `${minutes}m ago`
    }
    if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    }
    return `${Math.floor(diffInHours / 24)}d ago`
  }

  const filteredIncidents = incidents.filter(incident => {
    if (filter === 'pending') return incident.status === 'PENDING'
    if (filter === 'investigating') return incident.status === 'INVESTIGATING'
    if (filter === 'resolved') return incident.status === 'RESOLVED'
    return true
  })

  const pendingCount = incidents.filter(i => i.status === 'PENDING').length
  const investigatingCount = incidents.filter(i => i.status === 'INVESTIGATING').length
  const resolvedCount = incidents.filter(i => i.status === 'RESOLVED').length

  return (
    <div className="max-w-7xl mx-auto">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Reports</p>
              <p className="text-2xl font-bold text-gray-900">{incidents.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">📋</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">⏳</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Under Investigation</p>
              <p className="text-2xl font-bold text-blue-600">{investigatingCount}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">🔍</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Resolved</p>
              <p className="text-2xl font-bold text-green-600">{resolvedCount}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">✅</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Incident Queue</h2>
            <p className="text-gray-600 text-sm">Sorted by submission time (oldest first)</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Filter:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
            >
              <option value="all">All Incidents</option>
              <option value="pending">Pending Only</option>
              <option value="investigating">Under Investigation</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}
      </div>

      {/* Incidents List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading incidents...</p>
            </div>
          </div>
        ) : filteredIncidents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority / Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredIncidents.map((incident) => {
                  const priority = getPriorityLevel(incident)
                  return (
                    <tr key={incident.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className={`text-xs font-semibold ${priority.color} mb-1`}>
                            {priority.level} Priority
                          </div>
                          <div className="text-sm font-medium text-gray-900">
                            {getIncidentTypeLabel(incident.incidentType)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {getTimeElapsed(incident.createdAt)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {incident.plateNumber || 'No plate number'}
                        </div>
                        <div className="text-sm text-gray-500">
                          License: {incident.driverLicense || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                          By: {incident.reportedBy.firstName} {incident.reportedBy.lastName}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {incident.location}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(incident.status)}`}>
                          {incident.status.toLowerCase().replace('_', ' ')}
                        </span>
                        {incident.ticketNumber && (
                          <div className="text-xs text-gray-600 mt-1">
                            Ticket: {incident.ticketNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>{formatDate(incident.incidentDate)}</div>
                        <div className="text-xs text-gray-500">
                          Reported: {formatDate(incident.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm space-y-2">
                        <button
                          onClick={() => handleViewDetails(incident)}
                          className="block w-full text-left text-blue-600 hover:text-blue-900 text-xs font-medium"
                        >
                          View Details
                        </button>
                        
                        {incident.status === 'PENDING' && (
                          <button
                            onClick={() => handleTakeIncident(incident.id)}
                            className="block w-full text-left text-green-600 hover:text-green-900 text-xs font-medium"
                          >
                            Take Case
                          </button>
                        )}
                        
                        {incident.status === 'INVESTIGATING' && !incident.ticketNumber && (
                          <button
                            onClick={() => {
                              setSelectedIncident(incident)
                              openResolveModal()
                            }}
                            className="block w-full text-left text-orange-600 hover:text-orange-900 text-xs font-medium"
                          >
                            Issue Ticket
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <span className="text-4xl mb-4 block">🚔</span>
            <p className="text-gray-500 text-lg">No incidents found</p>
            <p className="text-gray-400 text-sm mt-2">
              All incidents have been resolved or no reports match your filter
            </p>
          </div>
        )}
      </div>

      {/* Incident Details Modal */}
      {showModal && selectedIncident && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-lg bg-white">
            <div className="mt-3">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  Incident Report Details
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Incident Type</label>
                      <p className="mt-1 text-sm text-gray-900">{getIncidentTypeLabel(selectedIncident.incidentType)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Priority</label>
                      <span className={`mt-1 inline-block text-sm font-semibold ${getPriorityLevel(selectedIncident).color}`}>
                        {getPriorityLevel(selectedIncident).level}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <span className={`mt-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(selectedIncident.status)}`}>
                      {selectedIncident.status.toLowerCase().replace('_', ' ')}
                    </span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <div className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                      {selectedIncident.description}
                    </div>
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
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Reported By</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedIncident.reportedBy.firstName} {selectedIncident.reportedBy.lastName}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Report Submitted</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDate(selectedIncident.createdAt)}</p>
                  </div>

                  {selectedIncident.handledBy && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Handled By</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {selectedIncident.handledBy.firstName} {selectedIncident.handledBy.lastName}
                      </p>
                    </div>
                  )}

                  {selectedIncident.ticketNumber && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Ticket Number</label>
                      <p className="mt-1 text-sm text-gray-900 font-mono bg-blue-50 p-2 rounded">
                        {selectedIncident.ticketNumber}
                      </p>
                    </div>
                  )}

                  {selectedIncident.resolvedAt && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Resolved At</label>
                      <p className="mt-1 text-sm text-gray-900">{formatDate(selectedIncident.resolvedAt)}</p>
                    </div>
                  )}

                  {selectedIncident.remarks && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Remarks</label>
                      <div className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                        {selectedIncident.remarks}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t">
                {selectedIncident.status === 'PENDING' && (
                  <button
                    onClick={() => handleTakeIncident(selectedIncident.id)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Take This Case
                  </button>
                )}
                
                {selectedIncident.status === 'INVESTIGATING' && !selectedIncident.ticketNumber && (
                  <button
                    onClick={openResolveModal}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Issue Ticket & Resolve
                  </button>
                )}
                
                <button
                  onClick={closeModal}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && selectedIncident && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-lg bg-white">
            <div className="mt-3">
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🎫</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">Issue Traffic Ticket</h3>
                <p className="text-gray-600 text-sm mt-1">
                  Enter the ticket number to resolve this incident
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-4 text-sm">
                  {error}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ticket Number *
                </label>
                <input
                  type="text"
                  value={ticketNumber}
                  onChange={(e) => setTicketNumber(e.target.value)}
                  placeholder="e.g., TCK-2024-001234"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  disabled={resolving}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will mark the incident as resolved with enforcement action taken
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeResolveModal}
                  disabled={resolving}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolveIncident}
                  disabled={resolving || !ticketNumber.trim()}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
                >
                  {resolving ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Issuing...
                    </>
                  ) : (
                    'Issue Ticket'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EnforcerIncidentsList