'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { VehicleType } from '@/generated/prisma'
import ResponsiveTable, { StatusBadge, ActionButton } from './ResponsiveTable'

interface Vehicle {
  id: string
  plateNumber: string
  vehicleType: VehicleType
  make: string
  model: string
  year: number
  color: string
  capacity: number
  isActive: boolean
  ownerName: string
  ownerContact: string
  driverName?: string
  driverLicense?: string
  registrationExpiry: string
  insuranceExpiry?: string
  createdAt: string
  updatedAt: string
  permit?: {
    id: string
    permitPlateNumber: string
    status: string
    issuedDate: string
    expiryDate: string
  }
}

interface PaginatedResponse {
  vehicles: Vehicle[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function VehiclesList() {
  const { user } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  // Filter states
  const [filters, setFilters] = useState({
    vehicleType: '' as VehicleType | '',
    isActive: '' as 'true' | 'false' | '',
    search: ''
  })

  const fetchVehicles = async () => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.vehicleType && { vehicleType: filters.vehicleType }),
        ...(filters.isActive && { isActive: filters.isActive }),
        ...(filters.search && { search: filters.search })
      })

      const response = await fetch(`/api/vehicles?${queryParams}`)
      if (response.ok) {
        const data: PaginatedResponse = await response.json()
        setVehicles(data.vehicles)
        setPagination(data.pagination)
      }
    } catch (error) {} finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVehicles()
  }, [pagination.page, filters])

  const handleStatusUpdate = async (vehicleId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive }),
      })

      if (response.ok) {
        // Refresh the vehicles list
        fetchVehicles()
      } else {      }
    } catch (error) {}
  }

  const handleViewDetails = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle)
    setShowDetails(true)
  }

  const getVehicleTypeColor = (vehicleType: VehicleType) => {
    switch (vehicleType) {
      case VehicleType.JEEPNEY: return 'bg-blue-100 text-blue-800'
      case VehicleType.TRICYCLE: return 'bg-purple-100 text-purple-800'
      case VehicleType.HABAL_HABAL: return 'bg-indigo-100 text-indigo-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }

  const columns = [
    {
      key: 'plateNumber',
      label: 'Vehicle Plate',
      render: (value: any, vehicle: Vehicle) => {
        if (!vehicle) return null
        return (
          <div>
            <div className="font-mono font-medium text-gray-900">
              {vehicle.plateNumber || '-'}
            </div>
            <div className="text-xs text-gray-500">
              Vehicle Plate
            </div>
          </div>
        )
      }
    },
    {
      key: 'permitPlateNumber',
      label: 'Permit Plate',
      render: (value: any, vehicle: Vehicle) => {
        if (!vehicle) return null
        if (!vehicle.permit?.permitPlateNumber) {
          return (
            <div className="text-sm">
              <span className="text-red-600 font-medium">No Permit</span>
              <div className="text-xs text-gray-500">Not registered</div>
            </div>
          )
        }
        return (
          <div>
            <div className="font-mono font-medium text-emerald-900">
              {vehicle.permit.permitPlateNumber}
            </div>
            <div className="text-xs text-emerald-600">
              Permit ID
            </div>
          </div>
        )
      }
    },
    {
      key: 'vehicleInfo',
      label: 'Vehicle Info',
      render: (value: any, vehicle: Vehicle) => {
        if (!vehicle) return null
        return (
          <div>
            <div className="font-medium text-gray-900">
              {vehicle.make} {vehicle.model}
            </div>
            <div className="text-sm text-gray-500">
              {vehicle.year} • {vehicle.color} • {vehicle.capacity} capacity
            </div>
          </div>
        )
      }
    },
    {
      key: 'vehicleType',
      label: 'Type',
      render: (value: any, vehicle: Vehicle) => {
        if (!vehicle || !vehicle.vehicleType) return null
        return (
          <StatusBadge
            status={vehicle.vehicleType}
            className={getVehicleTypeColor(vehicle.vehicleType)}
          />
        )
      }
    },
    {
      key: 'owner',
      label: 'Owner',
      render: (value: any, vehicle: Vehicle) => {
        if (!vehicle || !vehicle.ownerName) return null
        return (
          <div>
            <div className="font-medium text-gray-900">
              {vehicle.ownerName}
            </div>
            <div className="text-sm text-gray-500">
              {vehicle.ownerContact}
            </div>
          </div>
        )
      }
    },
    {
      key: 'driver',
      label: 'Driver',
      render: (value: any, vehicle: Vehicle) => {
        if (!vehicle) return null
        if (!vehicle.driverName) {
          return <span className="text-sm text-gray-500">No driver assigned</span>
        }
        return (
          <div>
            <div className="font-medium text-gray-900">
              {vehicle.driverName}
            </div>
            {vehicle.driverLicense && (
              <div className="text-sm text-gray-500">
                License: {vehicle.driverLicense}
              </div>
            )}
          </div>
        )
      }
    },
    {
      key: 'registrationExpiry',
      label: 'Registration',
      render: (value: any, vehicle: Vehicle) => {
        if (!vehicle || !vehicle.registrationExpiry) return null
        
        const expiryDate = new Date(vehicle.registrationExpiry)
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
      key: 'status',
      label: 'Status',
      render: (value: any, vehicle: Vehicle) => {
        if (!vehicle) return null
        return (
          <StatusBadge
            status={vehicle.isActive ? 'Active' : 'Inactive'}
            className={getStatusColor(vehicle.isActive)}
          />
        )
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (value: any, vehicle: Vehicle) => {
        if (!vehicle || !vehicle.id) return null
        
        return (
          <div className="flex space-x-2">
            <ActionButton
              onClick={() => handleViewDetails(vehicle)}
              variant="secondary"
              size="sm"
            >
              View Details
            </ActionButton>
            {vehicle.isActive ? (
              <ActionButton
                onClick={() => handleStatusUpdate(vehicle.id, false)}
                variant="danger"
                size="sm"
              >
                Deactivate
              </ActionButton>
            ) : (
              <ActionButton
                onClick={() => handleStatusUpdate(vehicle.id, true)}
                variant="primary"
                size="sm"
              >
                Activate
              </ActionButton>
            )}
          </div>
        )
      }
    }
  ]

  return (
    <div className="space-y-6 max-w-full">
      {/* Filters and Search */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              placeholder="Search vehicles..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-w-0"
            />
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

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filters.isActive}
              onChange={(e) => setFilters(prev => ({ ...prev, isActive: e.target.value as 'true' | 'false' | '' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ vehicleType: '', isActive: '', search: '' })}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
          <div className="bg-green-50 p-3 rounded-lg min-w-0">
            <div className="text-sm text-green-600 font-medium truncate">Active Vehicles</div>
            <div className="text-lg font-bold text-green-800">
              {vehicles.filter(v => v.isActive).length}
            </div>
          </div>
          <div className="bg-emerald-50 p-3 rounded-lg min-w-0">
            <div className="text-sm text-emerald-600 font-medium truncate">With Permits</div>
            <div className="text-lg font-bold text-emerald-800">
              {vehicles.filter(v => v.permit?.permitPlateNumber).length}
            </div>
          </div>
          <div className="bg-red-50 p-3 rounded-lg min-w-0">
            <div className="text-sm text-red-600 font-medium truncate">No Permits</div>
            <div className="text-lg font-bold text-red-800">
              {vehicles.filter(v => !v.permit?.permitPlateNumber).length}
            </div>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg min-w-0">
            <div className="text-sm text-blue-600 font-medium truncate">Jeepneys</div>
            <div className="text-lg font-bold text-blue-800">
              {vehicles.filter(v => v.vehicleType === VehicleType.JEEPNEY).length}
            </div>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg min-w-0">
            <div className="text-sm text-purple-600 font-medium truncate">Tricycles</div>
            <div className="text-lg font-bold text-purple-800">
              {vehicles.filter(v => v.vehicleType === VehicleType.TRICYCLE).length}
            </div>
          </div>
          <div className="bg-indigo-50 p-3 rounded-lg min-w-0">
            <div className="text-sm text-indigo-600 font-medium truncate">Total</div>
            <div className="text-lg font-bold text-indigo-800">
              {pagination.total}
            </div>
          </div>
        </div>
      </div>

      {/* Vehicles Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <ResponsiveTable
          columns={columns}
          data={vehicles || []}
          loading={loading}
          emptyMessage="No vehicles found matching your criteria"
        />
        
        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-sm text-gray-700 min-w-0">
              <span className="block sm:inline">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} vehicles
              </span>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700 whitespace-nowrap">
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

      {/* Vehicle Details Modal */}
      {showDetails && selectedVehicle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Vehicle Details - {selectedVehicle.plateNumber}
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
                {/* Vehicle Information */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Vehicle Information</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-500">Vehicle Plate Number:</span>
                      <div className="font-mono font-medium">{selectedVehicle.plateNumber}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Permit Plate Number:</span>
                      {selectedVehicle.permit?.permitPlateNumber ? (
                        <div className="font-mono font-medium text-emerald-900">
                          {selectedVehicle.permit.permitPlateNumber}
                        </div>
                      ) : (
                        <div className="text-red-600 font-medium">No permit issued</div>
                      )}
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Vehicle Type:</span>
                      <div>
                        <StatusBadge
                          status={selectedVehicle.vehicleType}
                          className={getVehicleTypeColor(selectedVehicle.vehicleType)}
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Make & Model:</span>
                      <div className="font-medium">{selectedVehicle.make} {selectedVehicle.model}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Year:</span>
                      <div>{selectedVehicle.year}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Color:</span>
                      <div>{selectedVehicle.color}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Capacity:</span>
                      <div>{selectedVehicle.capacity} passengers</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Vehicle Status:</span>
                      <div>
                        <StatusBadge
                          status={selectedVehicle.isActive ? 'Active' : 'Inactive'}
                          className={getStatusColor(selectedVehicle.isActive)}
                        />
                      </div>
                    </div>
                    {selectedVehicle.permit && (
                      <div>
                        <span className="text-sm text-gray-500">Permit Status:</span>
                        <div>
                          <StatusBadge
                            status={selectedVehicle.permit.status}
                            className={selectedVehicle.permit.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Owner & Driver Information */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Owner & Driver</h4>
                  <div className="space-y-4">
                    <div>
                      <span className="text-sm text-gray-500">Owner:</span>
                      <div className="font-medium">{selectedVehicle.ownerName}</div>
                      <div className="text-sm text-gray-600">{selectedVehicle.ownerContact}</div>
                    </div>
                    
                    {selectedVehicle.driverName ? (
                      <div>
                        <span className="text-sm text-gray-500">Assigned Driver:</span>
                        <div className="font-medium">{selectedVehicle.driverName}</div>
                        {selectedVehicle.driverLicense && (
                          <div className="text-sm text-gray-600">License: {selectedVehicle.driverLicense}</div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <span className="text-sm text-gray-500">Assigned Driver:</span>
                        <div className="text-gray-500 italic">No driver assigned</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Registration & Insurance */}
                <div className="md:col-span-2">
                  <h4 className="font-medium text-gray-900 mb-3">Registration & Permits</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500">Registration Expiry:</span>
                      <div>{new Date(selectedVehicle.registrationExpiry).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Insurance Expiry:</span>
                      <div>
                        {selectedVehicle.insuranceExpiry 
                          ? new Date(selectedVehicle.insuranceExpiry).toLocaleDateString()
                          : 'Not provided'
                        }
                      </div>
                    </div>
                    {selectedVehicle.permit && (
                      <>
                        <div>
                          <span className="text-sm text-gray-500">Permit Issued:</span>
                          <div>{new Date(selectedVehicle.permit.issuedDate).toLocaleDateString()}</div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Permit Expiry:</span>
                          <div className={new Date(selectedVehicle.permit.expiryDate) < new Date() ? 'text-red-600 font-medium' : ''}>
                            {new Date(selectedVehicle.permit.expiryDate).toLocaleDateString()}
                            {new Date(selectedVehicle.permit.expiryDate) < new Date() && (
                              <span className="text-xs text-red-500 ml-2">(Expired)</span>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Timestamps */}
                <div className="md:col-span-2">
                  <h4 className="font-medium text-gray-900 mb-3">Record Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500">Created At:</span>
                      <div>{new Date(selectedVehicle.createdAt).toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Last Updated:</span>
                      <div>{new Date(selectedVehicle.updatedAt).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>

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