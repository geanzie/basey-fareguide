'use client'

import { useEffect, useState } from 'react'

import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
} from '@/components/dashboardIcons'
import LoadingSpinner from '@/components/LoadingSpinner'
import type { IncidentListItemDto, IncidentsResponseDto } from '@/lib/contracts'

const IncidentsList = () => {
  const [incidents, setIncidents] = useState<IncidentListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    status: 'ALL',
    incidentType: 'ALL',
    dateRange: 'ALL',
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIncident, setSelectedIncident] = useState<IncidentListItemDto | null>(null)
  const [showModal, setShowModal] = useState(false)

  const statusOptions = [
    { value: 'ALL', label: 'All Status' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'INVESTIGATING', label: 'Investigating' },
    { value: 'RESOLVED', label: 'Resolved' },
    { value: 'DISMISSED', label: 'Dismissed' },
  ]

  const incidentTypeOptions = [
    { value: 'ALL', label: 'All Types' },
    { value: 'FARE_OVERCHARGE', label: 'Fare Overcharging' },
    { value: 'FARE_UNDERCHARGE', label: 'Fare Undercharging' },
    { value: 'RECKLESS_DRIVING', label: 'Reckless Driving' },
    { value: 'VEHICLE_VIOLATION', label: 'Vehicle Violation' },
    { value: 'ROUTE_VIOLATION', label: 'Route Violation' },
    { value: 'OTHER', label: 'Other Violation' },
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

      const response = await fetch(`/api/incidents?${params.toString()}`)
      if (response.ok) {
        const data: IncidentsResponseDto = await response.json()
        setIncidents(data.incidents || [])
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target
    setFilter((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      INVESTIGATING: 'bg-blue-100 text-blue-800',
      RESOLVED: 'bg-green-100 text-green-800',
      DISMISSED: 'bg-gray-100 text-gray-800',
    }
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800'
  }

  const handleViewDetails = (incident: IncidentListItemDto) => {
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
      minute: '2-digit',
    })
  }

  const filteredIncidents = incidents.filter((incident) => {
    if (!searchQuery.trim()) {
      return true
    }

    const query = searchQuery.toLowerCase()
    return (
      incident.plateNumber?.toLowerCase().includes(query) ||
      incident.location?.toLowerCase().includes(query) ||
      incident.description?.toLowerCase().includes(query) ||
      incident.type?.toLowerCase().includes(query) ||
      `${incident.reportedBy?.firstName || ''} ${incident.reportedBy?.lastName || ''}`.toLowerCase().includes(query)
    )
  })

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Incident Reports</h1>
            <p className="text-gray-600 mt-1">Monitor and manage transportation violations</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className={getDashboardIconChipClasses('amber')}>
              <DashboardIconSlot icon={DASHBOARD_ICONS.list} size={DASHBOARD_ICON_POLICY.sizes.card} />
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Total Incidents</div>
              <div className="text-2xl font-bold text-gray-900">{incidents.length}</div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
            Search Incidents
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <DashboardIconSlot icon={DASHBOARD_ICONS.inspect} size={DASHBOARD_ICON_POLICY.sizes.button} />
            </div>
            <input
              type="text"
              id="search"
              name="incidentSearch"
              autoComplete="off"
              placeholder="Search by plate number, location, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <DashboardIconSlot icon={DASHBOARD_ICONS.close} size={DASHBOARD_ICON_POLICY.sizes.button} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              id="status"
              name="status"
              autoComplete="off"
              value={filter.status}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {statusOptions.map((option) => (
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
              autoComplete="off"
              value={filter.incidentType}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {incidentTypeOptions.map((option) => (
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
              autoComplete="off"
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

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <LoadingSpinner className="justify-center text-emerald-600" size={28} />
              <p className="text-gray-600 mt-2">Loading incidents...</p>
            </div>
          </div>
        ) : filteredIncidents.length > 0 ? (
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
                          {incident.typeLabel}
                        </div>
                        <div className="text-sm text-gray-500">
                          Reported by: {incident.reportedBy ? `${incident.reportedBy.firstName} ${incident.reportedBy.lastName}` : 'Unknown'}
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
                      {formatDate(incident.date)}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleViewDetails(incident)}
                        className="text-emerald-600 hover:text-emerald-900 text-sm font-medium inline-flex items-center gap-2"
                      >
                        <DashboardIconSlot icon={DASHBOARD_ICONS.view} size={DASHBOARD_ICON_POLICY.sizes.button} />
                        <span>View Details</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <DashboardIconSlot icon={DASHBOARD_ICONS.list} size={DASHBOARD_ICON_POLICY.sizes.empty} />
            </div>
            <p className="text-gray-500 text-lg">No incidents found</p>
            <p className="text-gray-400 text-sm mt-2">
              {searchQuery ? 'Try adjusting your search terms' : 'Try adjusting your filters or check back later'}
            </p>
          </div>
        )}
      </div>

      {showModal && selectedIncident ? (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  <DashboardIconSlot icon={DASHBOARD_ICONS.list} size={DASHBOARD_ICON_POLICY.sizes.section} className="text-emerald-600" />
                  <span>Incident Details</span>
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <DashboardIconSlot icon={DASHBOARD_ICONS.close} size={DASHBOARD_ICON_POLICY.sizes.card} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Incident Type</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedIncident.typeLabel}</p>
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
                    <p className="mt-1 text-sm text-gray-900">{formatDate(selectedIncident.date)}</p>
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
                      {selectedIncident.reportedBy ? `${selectedIncident.reportedBy.firstName} ${selectedIncident.reportedBy.lastName}` : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Handled By</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedIncident.handledBy
                        ? `${selectedIncident.handledBy.firstName} ${selectedIncident.handledBy.lastName}`
                        : 'Not assigned'}
                    </p>
                  </div>
                </div>

                {selectedIncident.penaltyAmount ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Penalty Amount</label>
                    <p className="mt-1 text-sm text-gray-900 font-semibold text-red-600">
                      PHP {selectedIncident.penaltyAmount.toLocaleString()}
                    </p>
                  </div>
                ) : null}

                {selectedIncident.remarks ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Remarks</label>
                    <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                      {selectedIncident.remarks}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end mt-6 pt-4 border-t">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 inline-flex items-center gap-2"
                >
                  <DashboardIconSlot icon={DASHBOARD_ICONS.close} size={DASHBOARD_ICON_POLICY.sizes.button} />
                  <span>Close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default IncidentsList
