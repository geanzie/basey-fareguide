'use client'

import { useState, useEffect } from 'react'
import RoleGuard from '@/components/RoleGuard'
import PageWrapper from '@/components/PageWrapper'

interface Incident {
  id: string
  incidentType: string
  description: string
  location: string
  status: string
  createdAt: string
  reportedBy: {
    firstName: string
    lastName: string
  }
  handledBy?: {
    firstName: string
    lastName: string
  }
  ticketNumber?: string
}

export default function AdminIncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchIncidents()
  }, [])

  const fetchIncidents = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch('/api/incidents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setIncidents(data.incidents || [])
      } else {
        throw new Error('Failed to fetch incidents')
      }
    } catch (error) {
      console.error('Error fetching incidents:', error)
      setError('Failed to load incidents')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      INVESTIGATING: { color: 'bg-blue-100 text-blue-800', label: 'Investigating' },
      RESOLVED: { color: 'bg-green-100 text-green-800', label: 'Resolved' },
      DISMISSED: { color: 'bg-gray-100 text-gray-800', label: 'Dismissed' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    )
  }

  const filteredIncidents = incidents.filter(incident => 
    statusFilter === 'all' || incident.status === statusFilter
  )

  const incidentCounts = {
    all: incidents.length,
    PENDING: incidents.filter(i => i.status === 'PENDING').length,
    INVESTIGATING: incidents.filter(i => i.status === 'INVESTIGATING').length,
    RESOLVED: incidents.filter(i => i.status === 'RESOLVED').length,
    DISMISSED: incidents.filter(i => i.status === 'DISMISSED').length
  }

  if (loading) {
    return (
      <RoleGuard allowedRoles={['ADMIN']}>
        <PageWrapper title="All Incidents" subtitle="System-wide incident management">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </PageWrapper>
      </RoleGuard>
    )
  }

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageWrapper 
        title="All Incidents"
        subtitle="System-wide incident management and oversight"
      >
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <span className="text-red-500 text-xl mr-3">❌</span>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-gray-900">{incidentCounts.all}</div>
            <div className="text-sm text-gray-600">Total Incidents</div>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-yellow-600">{incidentCounts.PENDING}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-blue-600">{incidentCounts.INVESTIGATING}</div>
            <div className="text-sm text-gray-600">Investigating</div>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-green-600">{incidentCounts.RESOLVED}</div>
            <div className="text-sm text-gray-600">Resolved</div>
          </div>
          <div className="bg-gray-50 rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-gray-600">{incidentCounts.DISMISSED}</div>
            <div className="text-sm text-gray-600">Dismissed</div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'all' 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({incidentCounts.all})
            </button>
            {['PENDING', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === status 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0) + status.slice(1).toLowerCase()} ({incidentCounts[status as keyof typeof incidentCounts]})
              </button>
            ))}
          </div>
        </div>

        {/* Incidents Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Incident
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reported By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Handled By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ticket #
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredIncidents.map((incident) => (
                  <tr key={incident.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {incident.incidentType.replace('_', ' ')}
                        </div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {incident.description}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(incident.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {incident.location}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {incident.reportedBy.firstName} {incident.reportedBy.lastName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {incident.handledBy 
                        ? `${incident.handledBy.firstName} ${incident.handledBy.lastName}` 
                        : '-'
                      }
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(incident.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {incident.ticketNumber || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredIncidents.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No incidents found</h3>
              <p className="text-gray-600">
                {statusFilter === 'all' 
                  ? 'No incidents have been reported yet.' 
                  : `No incidents with status "${statusFilter}" found.`
                }
              </p>
            </div>
          )}
        </div>
      </PageWrapper>
    </RoleGuard>
  )
}