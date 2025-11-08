'use client'

import { useState, useEffect, useMemo } from 'react'
import useSWR from 'swr'
import ResponsiveTable, { StatusBadge, ActionButton } from './ResponsiveTable'
import EvidenceManager from './EvidenceManager'

interface ViolationHistory {
  id: string
  plateNumber: string
  violationType: string
  violationDate: string
  penaltyAmount: number
  status: 'PAID' | 'UNPAID' | 'PENDING'
  ticketNumber?: string
}

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
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [evidenceIncidentId, setEvidenceIncidentId] = useState<string | null>(null)
  const [ticketIncident, setTicketIncident] = useState<Incident | null>(null)
  const [ticketData, setTicketData] = useState({
    ticketNumber: '',
    penaltyAmount: '',
    remarks: '',
    previousOffenses: [] as ViolationHistory[],
    offenseCount: 0,
    calculatedPenalty: 500
  })

  const days = 30
  const [violationFilter, setViolationFilter] = useState<string>('all')
  const swrKey = `/api/incidents/enforcer?days=${days}&filter=${violationFilter}`
  const { data, isLoading, mutate } = useSWR<{ incidents: Incident[] }>(swrKey)

  useEffect(() => {
    if (data?.incidents) {
      setIncidents(data.incidents)
    }
    setLoading(isLoading)
  }, [data, isLoading])

  // Removed manual loadIncidents; SWR handles fetching

  const filteredIncidents = useMemo(() => {
    return incidents.filter(incident => {
      if (statusFilter === 'ALL') return true
      return incident.status === statusFilter
    })
  }, [incidents, statusFilter])

  const handleTakeIncident = async (incidentId: string) => {
    try {
      const response = await fetch(`/api/incidents/${incidentId}/take`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (response.ok) {
        mutate() // Refresh the list via SWR
      } else {
        const errorData = await response.json()      }
    } catch (error) {}
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

  const handleIssueTicket = async (incident: Incident) => {
    setTicketIncident(incident)
    setShowTicketModal(true)
    
    // Fetch violation history if plate number exists
    if (incident.plateNumber) {
      const violations = await fetchViolationHistory(incident.plateNumber)
      const offenseCount = violations.length
      const calculatedPenalty = getOffensePenalty(offenseCount)
      
      setTicketData({
        ticketNumber: '',
        penaltyAmount: calculatedPenalty.toString(),
        remarks: '',
        previousOffenses: violations,
        offenseCount: offenseCount,
        calculatedPenalty: calculatedPenalty
      })
    } else {
      setTicketData({
        ticketNumber: '',
        penaltyAmount: '500',
        remarks: '',
        previousOffenses: [],
        offenseCount: 0,
        calculatedPenalty: 500
      })
    }
  }

  const handleTakeAndIssueTicket = async (incident: Incident) => {
    try {
      // First take the incident
      const response = await fetch(`/api/incidents/${incident.id}/take`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (response.ok) {
        // Update local state to investigating
        const updatedIncident = { ...incident, status: 'INVESTIGATING' as const }
        
        // Then proceed to issue ticket
        await handleIssueTicket(updatedIncident)
        
  // Refresh the list to show updated status
  mutate()
      } else {
        const errorData = await response.json()
        alert(`Error taking incident: ${errorData.message || 'Unknown error'}`)
      }
    } catch (error) {      alert('Error taking incident. Please try again.')
    }
  }

  const closeTicketModal = () => {
    setShowTicketModal(false)
    setTicketIncident(null)
    setTicketData({
      ticketNumber: '',
      penaltyAmount: '',
      remarks: '',
      previousOffenses: [],
      offenseCount: 0,
      calculatedPenalty: 500
    })
  }

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!ticketIncident || !ticketData.ticketNumber || !ticketData.penaltyAmount) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const response = await fetch(`/api/incidents/${ticketIncident.id}/issue-ticket`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ticketNumber: ticketData.ticketNumber,
          penaltyAmount: parseFloat(ticketData.penaltyAmount),
          remarks: ticketData.remarks
        })
      })

      if (response.ok) {
        alert('Ticket issued successfully!')
  closeTicketModal()
  mutate() // Refresh the list
      } else {
        const errorData = await response.json()
        alert(`Error issuing ticket: ${errorData.message || 'Unknown error'}`)
      }
    } catch (error) {      alert('Error issuing ticket. Please try again.')
    }
  }

  // Penalty amounts based on Municipal Ordinance offense system
  const getOffensePenalty = (offenseCount: number): number => {
    switch (offenseCount + 1) { // +1 because we're calculating for the current offense
      case 1: return 500   // 1st Offense
      case 2: return 1000  // 2nd Offense
      case 3: return 1500  // 3rd Offense
      default: return 1500 // 3rd offense penalty for subsequent violations
    }
  }

  // Fetch violation history for a vehicle
  const fetchViolationHistory = async (plateNumber: string) => {
    if (!plateNumber.trim()) return []
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/violations/history/${encodeURIComponent(plateNumber)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        return data.violations || []
      }
    } catch (error) {}
    return []
  }

  const getIncidentTypeLabel = (type: string) => {
    switch (type) {
      case 'OVERCHARGING': return 'Overcharging'
      case 'FARE_OVERCHARGE': return 'Fare Overcharge'
      case 'RECKLESS_DRIVING': return 'Reckless Driving'
      case 'NO_PERMIT': return 'No Permit'
      case 'ROUTE_VIOLATION': return 'Route Violation'
      case 'VEHICLE_VIOLATION': return 'Vehicle Violation'
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

  const stats = useMemo(() => ({
    total: incidents.length,
    pending: incidents.filter(i => i.status === 'PENDING').length,
    investigating: incidents.filter(i => i.status === 'INVESTIGATING').length,
    resolved: incidents.filter(i => i.status === 'RESOLVED').length
  }), [incidents])

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
          
          {/* Quick Action Banner */}
          {stats.pending > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">🚨</span>
                  <div>
                    <h3 className="text-lg font-semibold text-red-800">
                      {stats.pending} Incident{stats.pending !== 1 ? 's' : ''} Awaiting Response
                    </h3>
                    <p className="text-red-600 text-sm">
                      Click "Issue Ticket Now" on any pending incident to take the case and issue a ticket immediately.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setStatusFilter('PENDING')}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-semibold"
                >
                  View Pending ({stats.pending})
                </button>
              </div>
            </div>
          )}

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

            {/* Help Section */}
            <div className="px-6 pt-4 pb-2 bg-blue-50 border-b border-blue-200">
              <div className="flex items-center text-sm text-blue-700">
                <span className="text-lg mr-2">💡</span>
                <div>
                  <strong>Ticket Issuing Guide:</strong> 
                  Use "🎫 Issue Ticket Now" for pending incidents to take and ticket immediately, 
                  or "🎫 Issue Ticket" for incidents you're already investigating.
                </div>
              </div>
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
                          <>
                            <ActionButton
                              onClick={() => handleTakeIncident(incident.id)}
                              variant="secondary"
                              size="xs"
                            >
                              Take Case
                            </ActionButton>
                            <ActionButton
                              onClick={() => handleTakeAndIssueTicket(incident)}
                              variant="primary"
                              size="xs"
                              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                            >
                              🎫 Issue Ticket Now
                            </ActionButton>
                          </>
                        )}
                        
                        {incident.status === 'INVESTIGATING' && !incident.ticketNumber && (
                          <ActionButton
                            onClick={() => handleIssueTicket(incident)}
                            variant="primary"
                            size="xs"
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                          >
                            🎫 Issue Ticket
                          </ActionButton>
                        )}
                        
                        {/* Debug info - remove in production */}
                        {process.env.NODE_ENV === 'development' && (
                          <div className="text-xs text-gray-500 mt-1">
                            Status: {incident.status} | Ticket: {incident.ticketNumber || 'None'}
                          </div>
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
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleManageEvidence(selectedIncident.id)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Manage Evidence
                  </button>
                  
                  {/* Issue Ticket Button in Modal */}
                  {selectedIncident.status === 'PENDING' && (
                    <button
                      onClick={() => {
                        closeIncidentDetails()
                        handleTakeAndIssueTicket(selectedIncident)
                      }}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-semibold"
                    >
                      🎫 Take & Issue Ticket
                    </button>
                  )}
                  
                  {selectedIncident.status === 'INVESTIGATING' && !selectedIncident.ticketNumber && (
                    <button
                      onClick={() => {
                        closeIncidentDetails()
                        handleIssueTicket(selectedIncident)
                      }}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-semibold"
                    >
                      🎫 Issue Ticket
                    </button>
                  )}
                  
                  {selectedIncident.ticketNumber && (
                    <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-semibold">
                      ✅ Ticket Issued: {selectedIncident.ticketNumber}
                    </div>
                  )}
                </div>
                
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

      {/* Issue Ticket Modal */}
      {showTicketModal && ticketIncident && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-lg bg-white max-h-[90vh] overflow-y-auto">
            <div className="mt-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                  <span className="text-2xl mr-2">🎫</span>
                  Issue Ticket
                </h3>
                <button
                  onClick={closeTicketModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>

              {/* Incident Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-800 mb-2">Incident Details</h4>
                <p className="text-sm text-gray-600">
                  <strong>Type:</strong> {getIncidentTypeLabel(ticketIncident.incidentType)}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Plate:</strong> {ticketIncident.plateNumber || 'N/A'}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Location:</strong> {ticketIncident.location}
                </p>
              </div>

              {/* Violation History and Penalty Calculation */}
              {ticketIncident.plateNumber && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="text-lg mr-2">⚠️</span>
                    Vehicle Violation History
                  </h4>
                  
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span>Previous Violations:</span>
                      <span className="font-medium">
                        {ticketData.offenseCount} violation{ticketData.offenseCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Current Offense:</span>
                      <span className="font-medium">
                        {ticketData.offenseCount + 1}
                        {ticketData.offenseCount === 0 ? 'st' : 
                         ticketData.offenseCount === 1 ? 'nd' : 
                         ticketData.offenseCount === 2 ? 'rd' : 'th'} Offense
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Municipal Ordinance Penalty:</span>
                      <span className="font-semibold text-red-600">
                        ₱{ticketData.calculatedPenalty.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      All violations follow uniform penalty structure regardless of violation type
                    </div>
                    
                    {ticketData.previousOffenses.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-yellow-300">
                        <span className="text-xs text-gray-600 font-medium">Recent violations:</span>
                        <div className="mt-2 space-y-2 max-h-24 overflow-y-auto">
                          {ticketData.previousOffenses.slice(-3).map((violation, index) => (
                            <div key={violation.id} className="text-xs text-gray-600 flex justify-between items-center bg-white p-2 rounded">
                              <div>
                                <div className="font-medium">{getIncidentTypeLabel(violation.violationType)}</div>
                                {violation.ticketNumber && (
                                  <div className="text-gray-500">Ticket: {violation.ticketNumber}</div>
                                )}
                              </div>
                              <div className="text-right">
                                <div>{new Date(violation.violationDate).toLocaleDateString()}</div>
                                <div className="text-gray-500">₱{violation.penaltyAmount}</div>
                              </div>
                            </div>
                          ))}
                          {ticketData.previousOffenses.length > 3 && (
                            <div className="text-xs text-gray-500 text-center py-1">
                              ... and {ticketData.previousOffenses.length - 3} more violation{ticketData.previousOffenses.length - 3 !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Ticket Form */}
              <form onSubmit={handleTicketSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ticket Number *
                  </label>
                  <input
                    type="text"
                    value={ticketData.ticketNumber}
                    onChange={(e) => setTicketData(prev => ({ ...prev, ticketNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Enter ticket number"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Penalty Amount (₱) *
                  </label>
                  <input
                    type="number"
                    value={ticketData.penaltyAmount}
                    onChange={(e) => setTicketData(prev => ({ ...prev, penaltyAmount: e.target.value }))}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                      ticketIncident?.plateNumber ? 'bg-gray-100' : ''
                    }`}
                    placeholder="Enter penalty amount"
                    min="0"
                    step="0.01"
                    required
                    readOnly={!!ticketIncident?.plateNumber}
                  />
                  {ticketIncident?.plateNumber && (
                    <p className="text-xs text-gray-500 mt-1">
                      Penalty automatically calculated based on Municipal Ordinance offense system
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Remarks
                  </label>
                  <textarea
                    value={ticketData.remarks}
                    onChange={(e) => setTicketData(prev => ({ ...prev, remarks: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    rows={3}
                    placeholder="Additional notes or remarks"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={closeTicketModal}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                  >
                    Issue Ticket
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}