'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { VehicleType, PermitStatus } from '@/generated/prisma'
import ResponsiveTable, { StatusBadge, ActionButton } from './ResponsiveTable'

interface Permit {
  id: string
  permitPlateNumber: string
  driverFullName: string
  vehicleType: VehicleType
  issuedDate: string
  expiryDate: string
  status: PermitStatus
  remarks?: string
  encodedBy: string
  encodedAt: string
  lastUpdatedBy?: string
  lastUpdatedAt?: string
  renewalHistory: Array<{
    id: string
    previousExpiry: string
    newExpiry: string
    renewedBy: string
    renewedAt: string
    notes?: string
  }>
}

interface PaginatedResponse {
  permits: Permit[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function PermitsList() {
  const { user } = useAuth()
  const [permits, setPermits] = useState<Permit[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPermit, setSelectedPermit] = useState<Permit | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  // Filter states
  const [filters, setFilters] = useState({
    status: '' as PermitStatus | '',
    vehicleType: '' as VehicleType | '',
    search: ''
  })

  const fetchPermits = async () => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.status && { status: filters.status }),
        ...(filters.vehicleType && { vehicleType: filters.vehicleType }),
        ...(filters.search && { search: filters.search })
      })

      const response = await fetch(`/api/permits?${queryParams}`)
      if (response.ok) {
        const data: PaginatedResponse = await response.json()
        setPermits(data.permits)
        setPagination(data.pagination)
      }
    } catch (error) {} finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPermits()
  }, [pagination.page, filters])

  const handleStatusUpdate = async (permitId: string, newStatus: PermitStatus) => {
    try {
      const response = await fetch(`/api/permits/${permitId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        // Refresh the permits list
        fetchPermits()
      } else {      }
    } catch (error) {}
  }

  const handleViewDetails = (permit: Permit) => {
    setSelectedPermit(permit)
    setShowDetails(true)
  }

  const getStatusColor = (status: PermitStatus) => {
    switch (status) {
      case PermitStatus.ACTIVE: return 'bg-green-100 text-green-800'
      case PermitStatus.EXPIRED: return 'bg-red-100 text-red-800'
      case PermitStatus.SUSPENDED: return 'bg-orange-100 text-orange-800'
      case PermitStatus.REVOKED: return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getVehicleTypeColor = (vehicleType: VehicleType) => {
    switch (vehicleType) {
      case VehicleType.JEEPNEY: return 'bg-blue-100 text-blue-800'
      case VehicleType.TRICYCLE: return 'bg-purple-100 text-purple-800'
      case VehicleType.HABAL_HABAL: return 'bg-indigo-100 text-indigo-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const columns = [
    {
      key: 'plateNumber',
      label: 'Plate Number',
      render: (value: any, permit: Permit) => {
        if (!permit) return null
        return (
          <div className="font-mono font-medium text-gray-900">
            {permit.permitPlateNumber || '-'}
          </div>
        )
      }
    },
    {
      key: 'driverFullName',
      label: 'Driver Name',
      render: (value: any, permit: Permit) => {
        if (!permit) return null
        return (
          <div className="font-medium text-gray-900">
            {permit.driverFullName || '-'}
          </div>
        )
      }
    },
    {
      key: 'vehicleType',
      label: 'Vehicle Type',
      render: (value: any, permit: Permit) => {
        if (!permit || !permit.vehicleType) return null
        return (
          <StatusBadge
            status={permit.vehicleType}
            className={getVehicleTypeColor(permit.vehicleType)}
          />
        )
      }
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: any, permit: Permit) => {
        if (!permit || !permit.status) return null
        return (
          <StatusBadge
            status={permit.status}
            className={getStatusColor(permit.status)}
          />
        )
      }
    },
    {
      key: 'issuedDate',
      label: 'Issued Date',
      render: (value: any, permit: Permit) => {
        if (!permit || !permit.issuedDate) return null
        return (
          <div className="text-sm text-gray-600">
            {new Date(permit.issuedDate).toLocaleDateString()}
          </div>
        )
      }
    },
    {
      key: 'expiryDate',
      label: 'Expiry Date',
      render: (value: any, permit: Permit) => {
        if (!permit || !permit.expiryDate) return null
        
        const expiryDate = new Date(permit.expiryDate)
        const today = new Date()
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        
        return (
          <div className="text-sm">
            <div className={`${daysUntilExpiry <= 30 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
              {expiryDate.toLocaleDateString()}
            </div>
            {daysUntilExpiry <= 30 && daysUntilExpiry > 0 && (
              <div className="text-xs text-red-500">
                Expires in {daysUntilExpiry} days
              </div>
            )}
            {daysUntilExpiry <= 0 && (
              <div className="text-xs text-red-600 font-medium">
                Expired
              </div>
            )}
          </div>
        )
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (value: any, permit: Permit) => {
        if (!permit || !permit.id) return null
        
        return (
          <div className="flex space-x-2">
            <ActionButton
              onClick={() => handleViewDetails(permit)}
              variant="secondary"
              size="sm"
            >
              View Details
            </ActionButton>
            {permit.status === PermitStatus.EXPIRED && (
              <ActionButton
                onClick={() => handleStatusUpdate(permit.id, PermitStatus.ACTIVE)}
                variant="primary"
                size="sm"
              >
                Renew
              </ActionButton>
            )}
            {permit.status === PermitStatus.ACTIVE && (
              <ActionButton
                onClick={() => handleStatusUpdate(permit.id, PermitStatus.SUSPENDED)}
                variant="danger"
                size="sm"
              >
                Suspend
              </ActionButton>
            )}
            {permit.status === PermitStatus.SUSPENDED && (
              <ActionButton
                onClick={() => handleStatusUpdate(permit.id, PermitStatus.ACTIVE)}
                variant="primary"
                size="sm"
              >
                Reactivate
              </ActionButton>
            )}
          </div>
        )
      }
    }
  ]

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              placeholder="Search plate number or driver name..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as PermitStatus | '' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">All Statuses</option>
              <option value={PermitStatus.ACTIVE}>Active</option>
              <option value={PermitStatus.EXPIRED}>Expired</option>
              <option value={PermitStatus.SUSPENDED}>Suspended</option>
              <option value={PermitStatus.REVOKED}>Revoked</option>
            </select>
          </div>

          {/* Vehicle Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vehicle Type
            </label>
            <select
              value={filters.vehicleType}
              onChange={(e) => setFilters(prev => ({ ...prev, vehicleType: e.target.value as VehicleType | '' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">All Types</option>
              <option value={VehicleType.JEEPNEY}>Jeepney</option>
              <option value={VehicleType.TRICYCLE}>Tricycle</option>
              <option value={VehicleType.HABAL_HABAL}>Habal-habal</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: '', vehicleType: '', search: '' })}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="text-sm text-green-600 font-medium">Active</div>
            <div className="text-lg font-bold text-green-800">
              {permits.filter(p => p.status === PermitStatus.ACTIVE).length}
            </div>
          </div>
          <div className="bg-red-50 p-3 rounded-lg">
            <div className="text-sm text-red-600 font-medium">Expired</div>
            <div className="text-lg font-bold text-red-800">
              {permits.filter(p => p.status === PermitStatus.EXPIRED).length}
            </div>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg">
            <div className="text-sm text-orange-600 font-medium">Suspended</div>
            <div className="text-lg font-bold text-orange-800">
              {permits.filter(p => p.status === PermitStatus.SUSPENDED).length}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600 font-medium">Revoked</div>
            <div className="text-lg font-bold text-gray-800">
              {permits.filter(p => p.status === PermitStatus.REVOKED).length}
            </div>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-sm text-blue-600 font-medium">Total</div>
            <div className="text-lg font-bold text-blue-800">
              {pagination.total}
            </div>
          </div>
        </div>
      </div>

      {/* Permits Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <ResponsiveTable
          columns={columns}
          data={permits || []}
          loading={loading}
          emptyMessage="No permits found matching your criteria"
        />
        
        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} permits
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Permit Details Modal */}
      {showDetails && selectedPermit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Permit Details - {selectedPermit.permitPlateNumber}
                </h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Basic Information</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-500">Plate Number:</span>
                      <div className="font-mono font-medium">{selectedPermit.permitPlateNumber}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Driver Name:</span>
                      <div className="font-medium">{selectedPermit.driverFullName}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Vehicle Type:</span>
                      <div>
                        <StatusBadge
                          status={selectedPermit.vehicleType}
                          className={getVehicleTypeColor(selectedPermit.vehicleType)}
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Status:</span>
                      <div>
                        <StatusBadge
                          status={selectedPermit.status}
                          className={getStatusColor(selectedPermit.status)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Dates & Validity</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-500">Issued Date:</span>
                      <div>{new Date(selectedPermit.issuedDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Expiry Date:</span>
                      <div>{new Date(selectedPermit.expiryDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Encoded By:</span>
                      <div>{selectedPermit.encodedBy}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Encoded At:</span>
                      <div>{new Date(selectedPermit.encodedAt).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>

              {selectedPermit.remarks && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-2">Remarks</h4>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                    {selectedPermit.remarks}
                  </p>
                </div>
              )}

              {selectedPermit.renewalHistory.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-3">Renewal History</h4>
                  <div className="space-y-3">
                    {selectedPermit.renewalHistory.map((renewal) => (
                      <div key={renewal.id} className="bg-gray-50 p-3 rounded-lg">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Previous Expiry:</span>
                            <div>{new Date(renewal.previousExpiry).toLocaleDateString()}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">New Expiry:</span>
                            <div>{new Date(renewal.newExpiry).toLocaleDateString()}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Renewed By:</span>
                            <div>{renewal.renewedBy}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Renewed At:</span>
                            <div>{new Date(renewal.renewedAt).toLocaleString()}</div>
                          </div>
                        </div>
                        {renewal.notes && (
                          <div className="mt-2">
                            <span className="text-gray-500 text-sm">Notes:</span>
                            <p className="text-gray-700">{renewal.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowDetails(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
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