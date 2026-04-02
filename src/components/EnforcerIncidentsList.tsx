'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import ResponsiveTable, { ActionButton, StatusBadge } from './ResponsiveTable'
import EvidenceManager from './EvidenceManager'
import type { IncidentListItemDto, IncidentsResponseDto } from '@/lib/contracts'

interface TicketFormState {
  ticketNumber: string
  penaltyAmount: string
  remarks: string
}

export default function EnforcerIncidentsList() {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'INVESTIGATING' | 'RESOLVED'>('ALL')
  const [dateRange, setDateRange] = useState<number>(90)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIncident, setSelectedIncident] = useState<IncidentListItemDto | null>(null)
  const [showIncidentDetails, setShowIncidentDetails] = useState(false)
  const [evidenceIncidentId, setEvidenceIncidentId] = useState<string | null>(null)
  const [showEvidenceManager, setShowEvidenceManager] = useState(false)
  const [ticketIncident, setTicketIncident] = useState<IncidentListItemDto | null>(null)
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [ticketData, setTicketData] = useState<TicketFormState>({
    ticketNumber: '',
    penaltyAmount: '',
    remarks: '',
  })

  const swrKey = `/api/incidents/enforcer?days=${dateRange}`
  const { data, error, isLoading, mutate } = useSWR<IncidentsResponseDto>(swrKey)
  const incidents = data?.incidents || []

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const matchesStatus = statusFilter === 'ALL' || incident.status === statusFilter

      if (!searchQuery.trim()) {
        return matchesStatus
      }

      const query = searchQuery.toLowerCase()
      const matchesSearch =
        incident.plateNumber?.toLowerCase().includes(query) ||
        incident.location?.toLowerCase().includes(query) ||
        incident.description?.toLowerCase().includes(query) ||
        incident.ticketNumber?.toLowerCase().includes(query) ||
        incident.type?.toLowerCase().includes(query) ||
        incident.driverLicense?.toLowerCase().includes(query) ||
        `${incident.reportedBy?.firstName || ''} ${incident.reportedBy?.lastName || ''}`.toLowerCase().includes(query)

      return Boolean(matchesStatus && matchesSearch)
    })
  }, [incidents, searchQuery, statusFilter])

  const stats = useMemo(
    () => ({
      total: incidents.length,
      pending: incidents.filter((incident) => incident.status === 'PENDING').length,
      investigating: incidents.filter((incident) => incident.status === 'INVESTIGATING').length,
      resolved: incidents.filter((incident) => incident.status === 'RESOLVED').length,
    }),
    [incidents],
  )

  const openTicketModal = (incident: IncidentListItemDto) => {
    setTicketIncident(incident)
    setTicketData({
      ticketNumber: '',
      penaltyAmount: incident.penaltyAmount != null ? String(incident.penaltyAmount) : '500',
      remarks: '',
    })
    setShowTicketModal(true)
  }

  const closeTicketModal = () => {
    setShowTicketModal(false)
    setTicketIncident(null)
    setTicketData({
      ticketNumber: '',
      penaltyAmount: '',
      remarks: '',
    })
  }

  const handleTakeAndIssueTicket = async (incident: IncidentListItemDto) => {
    try {
      const response = await fetch(`/api/incidents/${incident.id}/take`, {
        method: 'PATCH',
      })
      const payload = await response.json()

      if (!response.ok) {
        alert(payload.message || 'Failed to take incident.')
        return
      }

      await mutate()
      openTicketModal({ ...incident, status: 'INVESTIGATING' })
    } catch (_error) {
      alert('Error taking incident. Please try again.')
    }
  }

  const handleResolveIncident = async (incident: IncidentListItemDto) => {
    const confirmed = window.confirm(
      'Resolve this incident without issuing a ticket? This will mark it as resolved and start evidence cleanup.'
    )

    if (!confirmed) {
      return
    }

    const remarks = window.prompt('Resolution remarks (optional):', '') || ''

    try {
      const response = await fetch(`/api/incidents/${incident.id}/resolve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ remarks }),
      })
      const payload = await response.json()

      if (!response.ok) {
        alert(payload.message || 'Failed to resolve incident.')
        return
      }

      alert(payload.message || 'Incident resolved successfully.')
      if (selectedIncident?.id === incident.id) {
        closeIncidentDetails()
      }
      await mutate()
    } catch (_error) {
      alert('Error resolving incident. Please try again.')
    }
  }

  const handleTicketSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!ticketIncident || !ticketData.ticketNumber || !ticketData.penaltyAmount) {
      alert('Please complete the ticket number and penalty amount.')
      return
    }

    try {
      const response = await fetch(`/api/incidents/${ticketIncident.id}/issue-ticket`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketNumber: ticketData.ticketNumber,
          penaltyAmount: Number(ticketData.penaltyAmount),
          remarks: ticketData.remarks,
        }),
      })
      const payload = await response.json()

      if (!response.ok) {
        alert(payload.message || 'Failed to issue ticket.')
        return
      }

      alert(payload.message || 'Ticket issued successfully.')
      closeTicketModal()
      closeIncidentDetails()
      await mutate()
    } catch (_error) {
      alert('Error issuing ticket. Please try again.')
    }
  }

  const closeIncidentDetails = () => {
    setShowIncidentDetails(false)
    setSelectedIncident(null)
  }

  const closeEvidenceManager = () => {
    setShowEvidenceManager(false)
    setEvidenceIncidentId(null)
  }

  const openEvidenceManager = (incidentId: string) => {
    setEvidenceIncidentId(incidentId)
    setShowEvidenceManager(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'INVESTIGATING':
        return 'bg-blue-100 text-blue-800'
      case 'RESOLVED':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-300 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 mb-2">Failed to load incidents</h3>
        <p className="text-red-700 mb-3">
          {error.message || 'Unable to retrieve incident reports. Please try again.'}
        </p>
        <button
          onClick={() => mutate()}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-semibold"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Enforcer Incident Queue</h1>
          <p className="text-gray-600 mt-1">
            Take incidents, review evidence, issue tickets, or resolve cases without a ticket when appropriate.
          </p>
        </div>
      </div>

      <div className="px-6 py-8 space-y-8">
        {stats.pending > 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-red-800">
              {stats.pending} incident{stats.pending === 1 ? '' : 's'} awaiting response
            </h3>
            <p className="text-red-600 text-sm">
              Use the pending filter to take the next case and move it into the investigation workflow.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <MetricCard label="Total Incidents" value={stats.total} />
          <MetricCard label="Pending" value={stats.pending} />
          <MetricCard label="Investigating" value={stats.investigating} />
          <MetricCard label="Resolved" value={stats.resolved} />
        </div>

        <div className="bg-white rounded-lg shadow p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="dateRange" className="text-sm font-medium text-gray-700">
              Include resolved incidents from:
            </label>
            <select
              id="dateRange"
              value={dateRange}
              onChange={(e) => setDateRange(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={180}>Last 6 months</option>
              <option value={365}>Last year</option>
              <option value={3650}>All time</option>
            </select>
          </div>
          <div className="text-sm text-gray-500">
            <span className="font-medium">{incidents.length}</span> incident{incidents.length === 1 ? '' : 's'} returned
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by plate number, location, ticket number, description, or reporter..."
              className="block w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'ALL', label: 'All', count: stats.total },
              { key: 'PENDING', label: 'Pending', count: stats.pending },
              { key: 'INVESTIGATING', label: 'Investigating', count: stats.investigating },
              { key: 'RESOLVED', label: 'Resolved', count: stats.resolved },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key as typeof statusFilter)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  statusFilter === tab.key
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <ResponsiveTable
              columns={[
                {
                  key: 'type',
                  label: 'Incident',
                  mobileLabel: 'Incident',
                  render: (_, incident) => (
                    <div>
                      <div className="text-sm font-medium text-gray-900">{incident.typeLabel}</div>
                      <div className="text-xs text-gray-500">{getTimeElapsed(incident.createdAt)}</div>
                    </div>
                  ),
                },
                {
                  key: 'details',
                  label: 'Details',
                  mobileLabel: 'Vehicle and Reporter',
                  render: (_, incident) => (
                    <div>
                      <div className="text-sm text-gray-900">{incident.plateNumber || 'No plate number'}</div>
                      <div className="text-sm text-gray-500">{incident.driverLicense || 'No driver license recorded'}</div>
                      <div className="text-xs text-gray-500">
                        Reporter:{' '}
                        {incident.reportedBy ? `${incident.reportedBy.firstName} ${incident.reportedBy.lastName}` : 'Unknown'}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'location',
                  label: 'Location',
                  render: (location) => location,
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
                      {incident.ticketNumber ? (
                        <div className="text-xs text-gray-600 mt-1">Ticket: {incident.ticketNumber}</div>
                      ) : null}
                    </div>
                  ),
                },
                {
                  key: 'time',
                  label: 'Incident Date',
                  render: (_, incident) => (
                    <div>
                      <div>{formatDate(incident.date)}</div>
                      <div className="text-xs text-gray-500">Reported: {formatDate(incident.createdAt)}</div>
                    </div>
                  ),
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (_, incident) => (
                    <div className="space-y-1">
                      <ActionButton onClick={() => {
                        setSelectedIncident(incident)
                        setShowIncidentDetails(true)
                      }} variant="secondary" size="xs">
                        View Details
                      </ActionButton>
                      <ActionButton onClick={() => openEvidenceManager(incident.id)} variant="secondary" size="xs">
                        Evidence
                      </ActionButton>
                      {incident.status === 'PENDING' ? (
                        <ActionButton
                          onClick={() => handleTakeAndIssueTicket(incident)}
                          variant="primary"
                          size="xs"
                          className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                        >
                          Take and Issue Ticket
                        </ActionButton>
                      ) : null}
                      {incident.status === 'INVESTIGATING' && !incident.ticketNumber ? (
                        <>
                          <ActionButton
                            onClick={() => openTicketModal(incident)}
                            variant="primary"
                            size="xs"
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                          >
                            Issue Ticket
                          </ActionButton>
                          <ActionButton onClick={() => handleResolveIncident(incident)} variant="secondary" size="xs">
                            Resolve Only
                          </ActionButton>
                        </>
                      ) : null}
                    </div>
                  ),
                },
              ]}
              data={filteredIncidents}
              loading={isLoading}
              emptyMessage="No incidents found for the selected filters."
              className="rounded-lg"
            />
          </div>
        </div>
      </div>

      {showIncidentDetails && selectedIncident ? (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-lg bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Incident Details</h3>
                <button onClick={closeIncidentDetails} className="text-gray-400 hover:text-gray-600">
                  <span className="text-2xl">x</span>
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Incident Information</h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">Type:</span> {selectedIncident.typeLabel}</p>
                      <p>
                        <span className="font-medium">Status:</span>{' '}
                        <StatusBadge
                          status={selectedIncident.status.toLowerCase()}
                          className={getStatusColor(selectedIncident.status)}
                        />
                      </p>
                      <p><span className="font-medium">Location:</span> {selectedIncident.location}</p>
                      <p><span className="font-medium">Date:</span> {formatDate(selectedIncident.date)}</p>
                      {selectedIncident.ticketNumber ? (
                        <p><span className="font-medium">Ticket Number:</span> {selectedIncident.ticketNumber}</p>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Vehicle Information</h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">Plate Number:</span> {selectedIncident.plateNumber || 'N/A'}</p>
                      <p><span className="font-medium">Driver License:</span> {selectedIncident.driverLicense || 'N/A'}</p>
                      <p>
                        <span className="font-medium">Reported By:</span>{' '}
                        {selectedIncident.reportedBy
                          ? `${selectedIncident.reportedBy.firstName} ${selectedIncident.reportedBy.lastName}`
                          : 'Unknown'}
                      </p>
                      {selectedIncident.evidenceCount !== undefined ? (
                        <p><span className="font-medium">Evidence Files:</span> {selectedIncident.evidenceCount}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                {selectedIncident.description ? (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedIncident.description}</p>
                  </div>
                ) : null}

                {selectedIncident.penaltyAmount != null ? (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Penalty Information</h4>
                    <p className="text-sm text-gray-700">
                      Amount: PHP {selectedIncident.penaltyAmount.toLocaleString()}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex justify-between items-center mt-6 pt-4 border-t">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => openEvidenceManager(selectedIncident.id)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Manage Evidence
                  </button>

                  {selectedIncident.status === 'PENDING' ? (
                    <button
                      onClick={() => {
                        closeIncidentDetails()
                        handleTakeAndIssueTicket(selectedIncident)
                      }}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-semibold"
                    >
                      Take and Issue Ticket
                    </button>
                  ) : null}

                  {selectedIncident.status === 'INVESTIGATING' && !selectedIncident.ticketNumber ? (
                    <>
                      <button
                        onClick={() => {
                          closeIncidentDetails()
                          openTicketModal(selectedIncident)
                        }}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-semibold"
                      >
                        Issue Ticket
                      </button>
                      <button
                        onClick={() => handleResolveIncident(selectedIncident)}
                        className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors font-semibold"
                      >
                        Resolve Only
                      </button>
                    </>
                  ) : null}

                  {selectedIncident.ticketNumber ? (
                    <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-semibold">
                      Ticket Issued: {selectedIncident.ticketNumber}
                    </div>
                  ) : null}
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
      ) : null}

      {showEvidenceManager && evidenceIncidentId ? (
        <EvidenceManager incidentId={evidenceIncidentId} onClose={closeEvidenceManager} />
      ) : null}

      {showTicketModal && ticketIncident ? (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-lg bg-white max-h-[90vh] overflow-y-auto">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Issue Ticket</h3>
                <button onClick={closeTicketModal} className="text-gray-400 hover:text-gray-600">
                  <span className="text-2xl">x</span>
                </button>
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-800 mb-2">Incident Details</h4>
                <p className="text-sm text-gray-600"><strong>Type:</strong> {ticketIncident.typeLabel}</p>
                <p className="text-sm text-gray-600"><strong>Plate:</strong> {ticketIncident.plateNumber || 'N/A'}</p>
                <p className="text-sm text-gray-600"><strong>Location:</strong> {ticketIncident.location}</p>
                <p className="text-sm text-gray-600"><strong>Date:</strong> {formatDate(ticketIncident.date)}</p>
              </div>

              <form onSubmit={handleTicketSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ticket Number *
                  </label>
                  <input
                    type="text"
                    value={ticketData.ticketNumber}
                    onChange={(e) => setTicketData((prev) => ({ ...prev, ticketNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Enter ticket number"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Penalty Amount *
                  </label>
                  <input
                    type="number"
                    value={ticketData.penaltyAmount}
                    onChange={(e) => setTicketData((prev) => ({ ...prev, penaltyAmount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Enter penalty amount"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Remarks
                  </label>
                  <textarea
                    value={ticketData.remarks}
                    onChange={(e) => setTicketData((prev) => ({ ...prev, remarks: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    rows={3}
                    placeholder="Additional notes or remarks"
                  />
                </div>

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
      ) : null}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
    </div>
  )
}
