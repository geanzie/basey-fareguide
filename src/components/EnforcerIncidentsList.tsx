'use client'

import { useState, useEffect } from 'react'
import ResponsiveTable, { StatusBadge, ActionButton } from './ResponsiveTable'

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
  reportedBy: {
    firstName: string
    lastName: string
  }
}

export default function EnforcerIncidentsList() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

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
                          onClick={() => {
                            // View details functionality
                          }}
                          variant="secondary"
                          size="xs"
                        >
                          View Details
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
    </div>
  )
}