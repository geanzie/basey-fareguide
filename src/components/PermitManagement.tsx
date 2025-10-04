'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { VehicleType, PermitStatus } from '@/generated/prisma'

interface Permit {
  id: string
  plateNumber: string
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

export default function PermitManagement() {
  const { user } = useAuth()
  const [permits, setPermits] = useState<Permit[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingPermit, setEditingPermit] = useState<Permit | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  })

  // Form states
  const [formData, setFormData] = useState({
    plateNumber: '',
    driverFullName: '',
    vehicleType: VehicleType.TRICYCLE as VehicleType,
    remarks: ''
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
    } catch (error) {
      console.error('Error fetching permits:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPermits()
  }, [pagination.page, filters])

  const resetForm = () => {
    setFormData({
      plateNumber: '',
      driverFullName: '',
      vehicleType: VehicleType.TRICYCLE,
      remarks: ''
    })
    setShowAddForm(false)
    setEditingPermit(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const payload = {
        ...formData,
        encodedBy: user?.id,
        ...(editingPermit && { updatedBy: user?.id })
      }

      const url = editingPermit ? `/api/permits/${editingPermit.id}` : '/api/permits'
      const method = editingPermit ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        resetForm()
        fetchPermits()
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error saving permit:', error)
      alert('Error saving permit')
    }
  }

  const handleRenewPermit = async (permitId: string) => {
    try {
      const response = await fetch(`/api/permits/${permitId}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          renewedBy: user?.id,
          notes: 'Permit renewed'
        })
      })

      if (response.ok) {
        fetchPermits()
        alert('Permit renewed successfully')
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error renewing permit:', error)
      alert('Error renewing permit')
    }
  }

  const handleStatusChange = async (permitId: string, newStatus: PermitStatus) => {
    try {
      const response = await fetch(`/api/permits/${permitId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          updatedBy: user?.id
        })
      })

      if (response.ok) {
        fetchPermits()
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error updating permit status:', error)
      alert('Error updating permit status')
    }
  }

  const getStatusColor = (status: PermitStatus) => {
    switch (status) {
      case PermitStatus.ACTIVE: return 'bg-green-100 text-green-800'
      case PermitStatus.EXPIRED: return 'bg-red-100 text-red-800'
      case PermitStatus.SUSPENDED: return 'bg-yellow-100 text-yellow-800'
      case PermitStatus.REVOKED: return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date()
  }

  const isExpiringSoon = (expiryDate: string) => {
    const expiry = new Date(expiryDate)
    const today = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(today.getDate() + 30)
    return expiry <= thirtyDaysFromNow && expiry > today
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Permit Management</h2>
          <p className="text-gray-600">Manage tricycle and habal-habal permits</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          Add New Permit
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Plate number or driver name"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as PermitStatus | '' })}
            >
              <option value="">All Statuses</option>
              <option value={PermitStatus.ACTIVE}>Active</option>
              <option value={PermitStatus.EXPIRED}>Expired</option>
              <option value={PermitStatus.SUSPENDED}>Suspended</option>
              <option value={PermitStatus.REVOKED}>Revoked</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Type
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={filters.vehicleType}
              onChange={(e) => setFilters({ ...filters, vehicleType: e.target.value as VehicleType | '' })}
            >
              <option value="">All Types</option>
              <option value={VehicleType.TRICYCLE}>Tricycle</option>
              <option value={VehicleType.HABAL_HABAL}>Habal-habal</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: '', vehicleType: '', search: '' })}
              className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {(showAddForm || editingPermit) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {editingPermit ? 'Edit Permit' : 'Add New Permit'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plate Number
                </label>
                <input
                  type="text"
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  value={formData.plateNumber}
                  onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value.toUpperCase() })}
                  placeholder="e.g., ABC-123"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Driver Full Name
                </label>
                <input
                  type="text"
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  value={formData.driverFullName}
                  onChange={(e) => setFormData({ ...formData, driverFullName: e.target.value })}
                  placeholder="e.g., Juan Dela Cruz"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vehicle Type
                </label>
                <select
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  value={formData.vehicleType}
                  onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value as VehicleType })}
                >
                  <option value={VehicleType.TRICYCLE}>Tricycle</option>
                  <option value={VehicleType.HABAL_HABAL}>Habal-habal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks (Optional)
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Additional notes or remarks"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-md hover:bg-emerald-700 transition-colors"
                >
                  {editingPermit ? 'Update Permit' : 'Create Permit'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permits Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading permits...</p>
          </div>
        ) : permits.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600">No permits found.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Plate Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Driver Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vehicle Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expiry Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {permits.map((permit) => (
                    <tr key={permit.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {permit.plateNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {permit.driverFullName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {permit.vehicleType.replace('_', '-')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(permit.status)}`}>
                          {permit.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          {new Date(permit.expiryDate).toLocaleDateString()}
                          {isExpired(permit.expiryDate) && (
                            <span className="block text-red-600 text-xs">Expired</span>
                          )}
                          {isExpiringSoon(permit.expiryDate) && !isExpired(permit.expiryDate) && (
                            <span className="block text-yellow-600 text-xs">Expiring Soon</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => {
                            setEditingPermit(permit)
                            setFormData({
                              plateNumber: permit.plateNumber,
                              driverFullName: permit.driverFullName,
                              vehicleType: permit.vehicleType,
                              remarks: permit.remarks || ''
                            })
                          }}
                          className="text-emerald-600 hover:text-emerald-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRenewPermit(permit.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Renew
                        </button>
                        {permit.status === PermitStatus.ACTIVE && (
                          <button
                            onClick={() => handleStatusChange(permit.id, PermitStatus.SUSPENDED)}
                            className="text-yellow-600 hover:text-yellow-900"
                          >
                            Suspend
                          </button>
                        )}
                        {permit.status === PermitStatus.SUSPENDED && (
                          <button
                            onClick={() => handleStatusChange(permit.id, PermitStatus.ACTIVE)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page <= 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page >= pagination.totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing{' '}
                      <span className="font-medium">
                        {(pagination.page - 1) * pagination.limit + 1}
                      </span>{' '}
                      to{' '}
                      <span className="font-medium">
                        {Math.min(pagination.page * pagination.limit, pagination.total)}
                      </span>{' '}
                      of{' '}
                      <span className="font-medium">{pagination.total}</span>{' '}
                      results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                        disabled={pagination.page <= 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setPagination({ ...pagination, page })}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            page === pagination.page
                              ? 'z-10 bg-emerald-50 border-emerald-500 text-emerald-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                        disabled={pagination.page >= pagination.totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}