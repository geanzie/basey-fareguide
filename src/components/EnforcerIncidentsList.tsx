'use client'

import { useState, useEffect } from 'react'
import ResponsiveTable, { StatusBadge, ActionButton } from './ResponsiveTable'
import EvidenceManager from './EvidenceManager'

interface Incident {
  id: string
  incidentType: string
  plateNumber?: string
  driverLicense?: string
  location: string
  status: 'PENDING' | 'INVESTIGATING' | 'RESOLVED'
  incidentDate: string
  createdAt: string
  ticketNumber?: string
  description?: string
  penalty?: number
  evidenceCount?: number
  reportedBy: {
    firstName: string
    lastName: string
  }
}

export default function EnforcerIncidentsList() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [showIncidentDetails, setShowIncidentDetails] = useState(false)
  const [showEvidenceManager, setShowEvidenceManager] = useState(false)
  const [evidenceIncidentId, setEvidenceIncidentId] = useState<string | null>(null)

  useEffect(() => {
    loadIncidents()
  }, [])

  const loadIncidents = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/incidents/enforcer', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setIncidents(data.incidents || [])
      }
    } catch (error) {
      console.error('Error loading incidents:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredIncidents = incidents.filter(incident => {
    if (statusFilter === 'ALL') return true
    return incident.status === statusFilter
  })

  const handleTakeIncident = async (incidentId: string) => {
    try {
      const response = await fetch(`/api/incidents/${incidentId}/take`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (response.ok) {
        loadIncidents() // Refresh the list
      }
    } catch (error) {
      console.error('Error taking incident:', error)
    }
  }

  const handleViewDetails = (incident: Incident) => {
    setSelectedIncident(incident)
    setShowIncidentDetails(true)
  }

  const handleManageEvidence = (incidentId: string) => {
    setEvidenceIncidentId(incidentId)
    setShowEvidenceManager(true)
  }

  const closeIncidentDetails = () => {
    setShowIncidentDetails(false)
    setSelectedIncident(null)
  }

  const closeEvidenceManager = () => {
    setShowEvidenceManager(false)
    setEvidenceIncidentId(null)
  }

  const getIncidentTypeLabel = (type: string) => {
    switch (type) {
      case 'OVERCHARGING': return 'Overcharging'
      case 'RECKLESS_DRIVING': return 'Reckless Driving'
      case 'NO_PERMIT': return 'No Permit'
      case 'ROUTE_VIOLATION': return 'Route Violation'
      default: return type
    }
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

  const getTimeElapsed = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  const getPriorityLevel = (incident: Incident) => {
    const hoursOld = (new Date().getTime() - new Date(incident.createdAt).getTime()) / (1000 * 60 * 60)
    
    if (incident.incidentType === 'RECKLESS_DRIVING' || hoursOld > 24) {
      return { level: 'HIGH', color: 'text-red-600' }
    }
    if (hoursOld > 12) {
      return { level: 'MEDIUM', color: 'text-yellow-600' }
    }
    return { level: 'LOW', color: 'text-green-600' }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'INVESTIGATING': return 'bg-blue-100 text-blue-800'
      case 'RESOLVED': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const stats = {
    total: incidents.length,
    pending: incidents.filter(i => i.status === 'PENDING').length,
    investigating: incidents.filter(i => i.status === 'INVESTIGATING').length,
    resolved: incidents.filter(i => i.status === 'RESOLVED').length
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Traffic Enforcement Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                Monitor and manage traffic violation incidents
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-8">
        <div className="space-y-8">
          
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <span className="text-2xl">📊</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Incidents</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <span className="text-2xl">⏳</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <span className="text-2xl">🔍</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Investigating</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.investigating}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <span className="text-2xl">✅</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Resolved</p>
                  <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="bg-white rounded-lg shadow">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
                {[
                  { key: 'ALL', label: 'All Incidents', count: stats.total },
                  { key: 'PENDING', label: 'Pending', count: stats.pending },
                  { key: 'INVESTIGATING', label: 'Investigating', count: stats.investigating },
                  { key: 'RESOLVED', label: 'Resolved', count: stats.resolved }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      statusFilter === tab.key
                        ? 'border-emerald-500 text-emerald-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </nav>
            </div>

            {/* Incidents Table */}
            <div className="p-6">
              <ResponsiveTable
                columns={[
                  {
                    key: 'priority',
                    label: 'Priority / Type',
                    mobileLabel: 'Incident Info',
                    render: (_, incident) => {
                      const priority = getPriorityLevel(incident)
                      return (
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
                      )
                    }
                  },
                  {
                    key: 'details',
                    label: 'Details',
                    mobileLabel: 'Vehicle & Reporter',
                    render: (_, incident) => (
                      <div>
                        <div className="text-sm text-gray-900">
                          {incident.plateNumber || 'No plate number'}
                        </div>
                        <div className="text-sm text-gray-500">
                          License: {incident.driverLicense || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                          By: {incident.reportedBy.firstName} {incident.reportedBy.lastName}
                        </div>
                      </div>
                    )
                  },
                  {
                    key: 'location',
                    label: 'Location',
                    render: (location) => location
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (_, incident) => (
                      <div>
                        <StatusBadge 
                          status={incident.status.toLowerCase().replace('_', ' ')} 
                          className={getStatusColor(incident.status)}
                        />
                        {incident.ticketNumber && (
                          <div className="text-xs text-gray-600 mt-1">
                            Ticket: {incident.ticketNumber}
                          </div>
                        )}
                      </div>
                    )
                  },
                  {
                    key: 'time',
                    label: 'Time',
                    mobileLabel: 'Dates',
                    render: (_, incident) => (
                      <div>
                        <div>{formatDate(incident.incidentDate)}</div>
                        <div className="text-xs text-gray-500">
                          Reported: {formatDate(incident.createdAt)}
                        </div>
                      </div>
                    )
                  },
                  {
                    key: 'actions',
                    label: 'Actions',
                    render: (_, incident) => (
                      <div className="space-y-1">
                        <ActionButton
                          onClick={() => handleViewDetails(incident)}
                          variant="secondary"
                          size="xs"
                        >
                          View Details
                        </ActionButton>
                        
                        <ActionButton
                          onClick={() => handleManageEvidence(incident.id)}
                          variant="secondary"
                          size="xs"
                        >
                          Evidence
                        </ActionButton>
                        
                        {incident.status === 'PENDING' && (
                          <ActionButton
                            onClick={() => handleTakeIncident(incident.id)}
                            variant="primary"
                            size="xs"
                          >
                            Take Case
                          </ActionButton>
                        )}
                      </div>
                    )
                  }
                ]}
                data={filteredIncidents}
                loading={loading}
                emptyMessage="No incidents found for the selected filter."
                className="rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Incident Details Modal */}
      {showIncidentDetails && selectedIncident && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-lg bg-white">
            <div className="mt-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                  <span className="text-2xl mr-2">🚔</span>
                  Incident Details
                </h3>
                <button
                  onClick={closeIncidentDetails}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>

              {/* Content */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Incident Information</h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">Type:</span> {getIncidentTypeLabel(selectedIncident.incidentType)}</p>
                      <p><span className="font-medium">Status:</span> <StatusBadge status={selectedIncident.status.toLowerCase()} className={getStatusColor(selectedIncident.status)} /></p>
                      <p><span className="font-medium">Location:</span> {selectedIncident.location}</p>
                      <p><span className="font-medium">Date:</span> {formatDate(selectedIncident.incidentDate)}</p>
                      {selectedIncident.ticketNumber && (
                        <p><span className="font-medium">Ticket Number:</span> {selectedIncident.ticketNumber}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Vehicle Information</h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">Plate Number:</span> {selectedIncident.plateNumber || 'N/A'}</p>
                      <p><span className="font-medium">Driver License:</span> {selectedIncident.driverLicense || 'N/A'}</p>
                      <p><span className="font-medium">Reported By:</span> {selectedIncident.reportedBy.firstName} {selectedIncident.reportedBy.lastName}</p>
                      {selectedIncident.evidenceCount !== undefined && (
                        <p><span className="font-medium">Evidence Files:</span> {selectedIncident.evidenceCount} file(s)</p>
                      )}
                    </div>
                  </div>
                </div>

                {selectedIncident.description && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                      {selectedIncident.description}
                    </p>
                  </div>
                )}

                {selectedIncident.penalty && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Penalty Information</h4>
                    <p className="text-sm text-gray-700">
                      Amount: ₱{selectedIncident.penalty.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center mt-6 pt-4 border-t">
                <button
                  onClick={() => handleManageEvidence(selectedIncident.id)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Manage Evidence
                </button>
                <button
                  onClick={closeIncidentDetails}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Manager Modal */}
      {showEvidenceManager && evidenceIncidentId && (
        <EvidenceManager 
          incidentId={evidenceIncidentId} 
          onClose={closeEvidenceManager} 
        />
      )}
    </div>
  )
}