'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import PermitQrCard from '@/components/PermitQrCard'
import { VehicleType, PermitStatus } from '@prisma/client'
import ResponsiveTable, { StatusBadge, ActionButton } from './ResponsiveTable'
import VehicleLookupField from './VehicleLookupField'
import type {
  PermitDto,
  PermitsResponseDto,
  VehicleLookupDto,
} from '@/lib/contracts'

interface PermitQrLifecycleResponse {
  permit: PermitDto
  action: 'issued' | 'rotated'
}

interface PermitQrReadResponse {
  permit: PermitDto
}

export default function PermitManagement() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const [permits, setPermits] = useState<PermitDto[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingPermit, setEditingPermit] = useState<PermitDto | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleLookupDto | null>(null)
  const [lastCreatedPermit, setLastCreatedPermit] = useState<PermitDto | null>(null)
  const [selectedQrPermit, setSelectedQrPermit] = useState<PermitDto | null>(null)
  const [loadingQrPermitId, setLoadingQrPermitId] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  })

  // Form states
  const [formData, setFormData] = useState({
    vehicleId: '',
    permitPlateNumber: '',
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
        const data: PermitsResponseDto = await response.json()
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

  // Check for modal parameter to auto-open add permit form
  useEffect(() => {
    const modal = searchParams.get('modal')
    if (modal === 'add-permit') {
      setShowAddForm(true)
      // Clean up URL parameter without page reload
      const url = new URL(window.location.href)
      url.searchParams.delete('modal')
      window.history.replaceState({}, '', url.pathname + url.search)
    }
  }, [searchParams])

  const resetForm = () => {
    setFormData({
      vehicleId: '',
      permitPlateNumber: '',
      remarks: ''
    })
    setSelectedVehicle(null)
    setShowAddForm(false)
    setEditingPermit(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (!formData.permitPlateNumber.trim()) {
        alert('Please enter a permit plate number')
        return
      }

      let assignedVehicle: VehicleLookupDto | PermitDto['vehicle'] | null = null
      if (editingPermit) {
        assignedVehicle = editingPermit.vehicle
      } else {
        assignedVehicle = selectedVehicle
        if (!assignedVehicle) {
          alert('Please select a vehicle')
          return
        }
      }

      if (!assignedVehicle) {
        alert('Vehicle information not available')
        return
      }

      const payload = {
        vehicleId: editingPermit ? editingPermit.vehicle?.id || formData.vehicleId : formData.vehicleId,
        permitPlateNumber: formData.permitPlateNumber,
        driverFullName: editingPermit 
          ? editingPermit.driverFullName 
          : selectedVehicle?.driverName || 'Unknown Driver',
        vehicleType: editingPermit 
          ? editingPermit.vehicleType 
          : selectedVehicle!.vehicleType,
        remarks: formData.remarks,
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
        const savedPermit: PermitDto = await response.json()
        if (!editingPermit) {
          setLastCreatedPermit(savedPermit)
          setSelectedQrPermit(savedPermit)
        }
        resetForm()
        fetchPermits()
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.error}`)
      }
    } catch (error) {      alert('Error saving permit')
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
    } catch (error) {      alert('Error renewing permit')
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
    } catch (error) {      alert('Error updating permit status')
    }
  }

  const handlePermitQrAction = async (permit: PermitDto, action: 'issue' | 'rotate') => {
    if (
      action === 'rotate' &&
      !window.confirm(`Rotate the QR token for permit ${permit.permitPlateNumber}? Existing printed QR copies will stop working.`)
    ) {
      return
    }

    try {
      const response = await fetch(`/api/permits/${permit.id}/qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const payload = (await response.json()) as PermitQrLifecycleResponse | { error?: string }

      if (!response.ok || !('permit' in payload)) {
        alert(`Error: ${'error' in payload ? payload.error : 'Unable to update permit QR'}`)
        return
      }

      const updatedPermit = payload.permit
      setSelectedQrPermit(updatedPermit)
      setLastCreatedPermit((current) => (current?.id === updatedPermit.id ? updatedPermit : current))
      fetchPermits()

      alert(
        payload.action === 'issued'
          ? `QR token issued for permit ${updatedPermit.permitPlateNumber}`
          : `QR token rotated for permit ${updatedPermit.permitPlateNumber}`,
      )
    } catch (error) {
      alert('Error updating permit QR')
    }
  }

  const handleViewPermitQr = async (permit: PermitDto) => {
    if (!permit.hasQrToken) {
      alert(`Permit ${permit.permitPlateNumber} does not have an issued QR token yet`)
      return
    }

    if (permit.qrToken) {
      setSelectedQrPermit(permit)
      return
    }

    try {
      setLoadingQrPermitId(permit.id)
      const response = await fetch(`/api/permits/${permit.id}/qr`)
      const payload = (await response.json()) as PermitQrReadResponse | { error?: string }

      if (!response.ok || !('permit' in payload)) {
        alert(`Error: ${'error' in payload ? payload.error : 'Unable to load permit QR'}`)
        return
      }

      setSelectedQrPermit(payload.permit)
      setLastCreatedPermit((current) => (current?.id === payload.permit.id ? payload.permit : current))
    } catch (error) {
      alert('Error loading permit QR')
    } finally {
      setLoadingQrPermitId(null)
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

  const activePermitVehicleIds = new Set(
    permits
      .filter((permit) => permit.status === PermitStatus.ACTIVE && permit.vehicle?.id)
      .map((permit) => permit.vehicle!.id),
  )

  const handleVehicleLookupSelect = (vehicle: VehicleLookupDto) => {
    setSelectedVehicle(vehicle)
    setFormData((prev) => ({
      ...prev,
      vehicleId: vehicle.id,
    }))
  }

  const clearSelectedVehicle = () => {
    setSelectedVehicle(null)
    setFormData((prev) => ({
      ...prev,
      vehicleId: '',
    }))
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

      {lastCreatedPermit?.qrToken ? (
        <div className="app-surface-card rounded-2xl p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Latest QR-issued permit</h3>
              <p className="text-sm text-gray-600">
                Permit {lastCreatedPermit.permitPlateNumber} received a stored QR token at creation time.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleViewPermitQr(lastCreatedPermit)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              View QR
            </button>
          </div>
          <PermitQrCard
            permitPlateNumber={lastCreatedPermit.permitPlateNumber}
            qrToken={lastCreatedPermit.qrToken}
            driverFullName={lastCreatedPermit.driverFullName}
          />
        </div>
      ) : null}

      {/* Filters */}
      <div className="app-surface-card rounded-2xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="permit-management-search" className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              id="permit-management-search"
              name="permitSearch"
              type="text"
              autoComplete="off"
              placeholder="Permit plate, vehicle plate, or driver name"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="permit-management-status-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="permit-management-status-filter"
              name="permitStatusFilter"
              autoComplete="off"
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
            <label htmlFor="permit-management-vehicle-type-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Type
            </label>
            <select
              id="permit-management-vehicle-type-filter"
              name="permitVehicleTypeFilter"
              autoComplete="off"
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
          <div className="app-surface-overlay mx-4 w-full max-w-md rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editingPermit ? 'Edit Permit' : 'Add New Permit'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editingPermit ? 'Assigned Vehicle' : 'Select Vehicle'}
                </label>
                {editingPermit && (
                  <p className="text-sm text-blue-600 mb-2">
                    Vehicle assignment cannot be changed when editing a permit.
                  </p>
                )}
                {editingPermit ? (
                  <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-3 text-sm text-gray-700">
                    <div><strong>Plate:</strong> {editingPermit.vehicle?.plateNumber || 'Unknown vehicle'}</div>
                    <div><strong>Type:</strong> {editingPermit.vehicle?.vehicleType?.replace('_', '-') || editingPermit.vehicleType.replace('_', '-')}</div>
                    <div><strong>Owner:</strong> {editingPermit.vehicle?.ownerName || 'Unknown owner'}</div>
                    <div><strong>Driver:</strong> {editingPermit.driverFullName}</div>
                  </div>
                ) : (
                  <VehicleLookupField
                    label="Vehicle Search"
                    placeholder="Type at least 2 characters to search active vehicles"
                    helperText="Search only when you need a match. Vehicles with active permits stay hidden from new permit assignment."
                    selectedVehicle={selectedVehicle}
                    onSelect={handleVehicleLookupSelect}
                    onClearSelection={clearSelectedVehicle}
                    requireActivePermit={false}
                    resultFilter={(vehicle) => !activePermitVehicleIds.has(vehicle.id)}
                    noResultsText="No eligible vehicles matched your search."
                  />
                )}
                {!editingPermit && formData.vehicleId && selectedVehicle && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-md text-sm">
                    <div>
                      <div><strong>Plate:</strong> {selectedVehicle.plateNumber}</div>
                      <div><strong>Type:</strong> {selectedVehicle.vehicleType.replace('_', '-')}</div>
                      <div><strong>Driver:</strong> {selectedVehicle.driverName || 'Unknown'}</div>
                      <div><strong>Owner:</strong> {selectedVehicle.ownerName}</div>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="permit-management-permit-plate-number" className="block text-sm font-medium text-gray-700 mb-1">
                  Permit Plate Number *
                </label>
                <input
                  id="permit-management-permit-plate-number"
                  name="permitPlateNumber"
                  type="text"
                  autoComplete="off"
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono"
                  value={formData.permitPlateNumber}
                  onChange={(e) => setFormData({ ...formData, permitPlateNumber: e.target.value.toUpperCase() })}
                  placeholder="e.g., PERMIT-2025-001"
                  maxLength={20}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will serve as the unique permit ID for this vehicle (valid for 1 year)
                </p>
              </div>
              <div>
                <label htmlFor="permit-management-remarks" className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks (Optional)
                </label>
                <textarea
                  id="permit-management-remarks"
                  name="remarks"
                  autoComplete="off"
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
      <div className="app-surface-card rounded-2xl overflow-hidden">
        <ResponsiveTable
          columns={[
            {
              key: 'permitPlateNumber',
              label: 'Permit Plate',
              className: 'font-medium text-emerald-600',
              render: (permitPlateNumber) => (
                <div>
                  <div className="font-mono font-medium text-emerald-900">
                    {permitPlateNumber}
                  </div>
                  <div className="text-xs text-emerald-600">Permit ID</div>
                </div>
              )
            },
            {
              key: 'hasQrToken',
              label: 'QR Status',
              mobileLabel: 'QR',
              render: (hasQrToken, permit) => (
                <div>
                  <div className="text-xs font-medium text-gray-900">
                    {hasQrToken ? 'Issued securely' : 'Not issued'}
                  </div>
                  {permit.qrIssuedAt ? (
                    <div className="text-xs text-gray-500">
                      Issued {new Date(permit.qrIssuedAt).toLocaleDateString()}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">Legacy permit without QR</div>
                  )}
                </div>
              )
            },
            {
              key: 'vehicle',
              label: 'Vehicle Info',
              render: (vehicle, permit) => {
                if (!permit || !permit.vehicle) return <span className="text-gray-500">No vehicle data</span>
                return (
                  <div>
                    <div className="font-medium text-gray-900">
                      {permit.vehicle.plateNumber}
                    </div>
                    <div className="text-sm text-gray-500">
                      {permit.vehicle.make} {permit.vehicle.model}
                    </div>
                    <div className="text-xs text-gray-400">
                      Owner: {permit.vehicle.ownerName}
                    </div>
                  </div>
                )
              }
            },
            {
              key: 'driverFullName',
              label: 'Driver Name',
              mobileLabel: 'Driver'
            },
            {
              key: 'vehicleType',
              label: 'Vehicle Type',
              mobileLabel: 'Type',
              render: (vehicleType) => vehicleType.replace('_', '-')
            },
            {
              key: 'status',
              label: 'Status',
              render: (status) => (
                <StatusBadge status={status} className={getStatusColor(status)} />
              )
            },
            {
              key: 'expiryDate',
              label: 'Expiry Date',
              mobileLabel: 'Expiry',
              render: (expiryDate) => (
                <div>
                  {new Date(expiryDate).toLocaleDateString()}
                  {isExpired(expiryDate) && (
                    <span className="block text-red-600 text-xs">Expired</span>
                  )}
                  {isExpiringSoon(expiryDate) && !isExpired(expiryDate) && (
                    <span className="block text-yellow-600 text-xs">Expiring Soon</span>
                  )}
                </div>
              )
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (_, permit) => (
                <div className="space-y-1">
                  <ActionButton
                    onClick={() => {
                      setEditingPermit(permit)
                      setSelectedVehicle(null)
                      setFormData({
                        vehicleId: permit.vehicle?.id || '',
                        permitPlateNumber: permit.permitPlateNumber || '',
                        remarks: permit.remarks || ''
                      })
                      setShowAddForm(true)
                    }}
                    variant="secondary"
                    size="xs"
                  >
                    Edit
                  </ActionButton>
                  <ActionButton
                    onClick={() => handleRenewPermit(permit.id)}
                    variant="primary"
                    size="xs"
                  >
                    Renew
                  </ActionButton>
                  {permit.hasQrToken ? (
                    <>
                      <ActionButton
                        onClick={() => void handleViewPermitQr(permit)}
                        variant="secondary"
                        size="xs"
                      >
                        {loadingQrPermitId === permit.id ? 'Loading QR...' : 'View QR'}
                      </ActionButton>
                      <ActionButton
                        onClick={() => handlePermitQrAction(permit, 'rotate')}
                        variant="secondary"
                        size="xs"
                      >
                        Rotate QR
                      </ActionButton>
                    </>
                  ) : (
                    <ActionButton
                      onClick={() => handlePermitQrAction(permit, 'issue')}
                      variant="primary"
                      size="xs"
                    >
                      Issue QR
                    </ActionButton>
                  )}
                  {permit.status === PermitStatus.ACTIVE && (
                    <ActionButton
                      onClick={() => handleStatusChange(permit.id, PermitStatus.SUSPENDED)}
                      variant="danger"
                      size="xs"
                    >
                      Suspend
                    </ActionButton>
                  )}
                  {permit.status === PermitStatus.SUSPENDED && (
                    <ActionButton
                      onClick={() => handleStatusChange(permit.id, PermitStatus.ACTIVE)}
                      variant="primary"
                      size="xs"
                    >
                      Activate
                    </ActionButton>
                  )}
                </div>
              )
            }
          ]}
          data={permits}
          loading={loading}
          emptyMessage="No permits found."
          className="rounded-lg"
        />

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
      </div>

      {selectedQrPermit?.qrToken ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="app-surface-overlay mx-4 w-full max-w-lg rounded-2xl p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Permit QR</h3>
                <p className="text-sm text-gray-600">
                  Reuse the stored QR token for display and printing. No regeneration happens here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQrPermit(null)}
                className="text-2xl leading-none text-gray-400 transition-colors hover:text-gray-600"
                aria-label="Close QR preview"
              >
                ×
              </button>
            </div>
            <PermitQrCard
              permitPlateNumber={selectedQrPermit.permitPlateNumber}
              qrToken={selectedQrPermit.qrToken}
              driverFullName={selectedQrPermit.driverFullName}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
