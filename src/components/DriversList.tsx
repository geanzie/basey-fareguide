'use client'

import { useState, useEffect } from 'react'
import ResponsiveTable, { StatusBadge, ActionButton } from './ResponsiveTable'

interface Driver {
  id: string
  licenseNumber?: string
  licenseType?: string
  licenseExpiry?: string
  emergencyContact?: string
  bloodType?: string
  isActive: boolean
  vehicleCount?: number
  user: {
    firstName: string
    lastName: string
    username: string
  }
  vehicles?: {
    id: string
    plateNumber: string
    vehicleType: string
    make: string
    model: string
  }[]
  createdAt?: string
  updatedAt?: string
}

interface PaginatedResponse {
  drivers: Driver[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function DriversList() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalDrivers, setTotalDrivers] = useState(0)
  const limit = 20

  // Filter states
  const [filters, setFilters] = useState({
    licenseType: '',
    isActive: '' as 'true' | 'false' | '',
    search: ''
  })

  const fetchDrivers = async (page = 1, currentFilters = filters) => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(currentFilters.licenseType && { licenseType: currentFilters.licenseType }),
        ...(currentFilters.isActive && { isActive: currentFilters.isActive }),
        ...(currentFilters.search && { search: currentFilters.search })
      })

      // This would be the actual API endpoint for drivers
      const response = await fetch(`/api/drivers?${queryParams}`)
      if (response.ok) {
        const data: PaginatedResponse = await response.json()
        setDrivers(data.drivers)
        setCurrentPage(data.pagination.page)
        setTotalPages(data.pagination.totalPages)
        setTotalDrivers(data.pagination.total)
      } else {
        // For now, show mock data since the API might not exist yet
        setDrivers(mockDrivers)
        setCurrentPage(page)
        setTotalPages(1)
        setTotalDrivers(mockDrivers.length)
      }
    } catch (error) {
      console.error('Error fetching drivers:', error)
      // Show mock data as fallback
      setDrivers(mockDrivers)
      setCurrentPage(page)
      setTotalPages(1)
      setTotalDrivers(mockDrivers.length)
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchDrivers(1, filters)
  }, [])

  // Handle filter changes (reset to page 1)
  useEffect(() => {
    setCurrentPage(1)
    fetchDrivers(1, filters)
  }, [filters.licenseType, filters.isActive, filters.search])

  const handleStatusUpdate = async (driverId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/drivers/${driverId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive }),
      })

      if (response.ok) {
        fetchDrivers()
      } else {
        console.error('Failed to update driver status')
      }
    } catch (error) {
      console.error('Error updating driver status:', error)
    }
  }

  const handleViewDetails = (driver: Driver) => {
    setSelectedDriver(driver)
    setShowDetails(true)
  }

  const getLicenseStatusColor = (expiryDate?: string) => {
    if (!expiryDate) return 'bg-gray-100 text-gray-800'
    
    const expiry = new Date(expiryDate)
    const today = new Date()
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysUntilExpiry <= 0) return 'bg-red-100 text-red-800'
    if (daysUntilExpiry <= 30) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }

  const columns = [
    {
      key: 'name',
      label: 'Driver Name',
      render: (value: any, driver: Driver) => {
        if (!driver) return null
        return (
          <div>
            <div className="font-medium text-gray-900">
              {`${driver.user.firstName} ${driver.user.lastName}`}
            </div>
            <div className="text-sm text-gray-500">
              {driver.vehicleCount} vehicle{driver.vehicleCount !== 1 ? 's' : ''}
            </div>
          </div>
        )
      }
    },
    {
      key: 'license',
      label: 'License Info',
      render: (value: any, driver: Driver) => {
        if (!driver) return null
        if (!driver.licenseNumber) {
          return <span className="text-sm text-gray-500">No license info</span>
        }
        return (
          <div>
            <div className="font-mono font-medium text-gray-900">
              {driver.licenseNumber}
            </div>
            <div className="text-sm text-gray-500">
              {driver.licenseType}
            </div>
          </div>
        )
      }
    },
    {
      key: 'licenseExpiry',
      label: 'License Status',
      render: (value: any, driver: Driver) => {
        if (!driver || !driver.licenseExpiry) {
          return <span className="text-sm text-gray-500">No expiry date</span>
        }
        
        const expiryDate = new Date(driver.licenseExpiry)
        const today = new Date()
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        
        let status = 'Valid'
        if (daysUntilExpiry <= 0) status = 'Expired'
        else if (daysUntilExpiry <= 30) status = 'Expiring Soon'
        
        return (
          <div className="text-sm">
            <StatusBadge
              status={status}
              className={getLicenseStatusColor(driver.licenseExpiry)}
            />
            <div className="text-xs text-gray-500 mt-1">
              {expiryDate.toLocaleDateString()}
            </div>
          </div>
        )
      }
    },
    {
      key: 'contact',
      label: 'Contact Info',
      render: (value: any, driver: Driver) => {
        if (!driver) return null
        return (
          <div className="text-sm">
            {driver.emergencyContact ? (
              <div>
                <div className="text-gray-900">{driver.emergencyContact}</div>
                {driver.bloodType && (
                  <div className="text-gray-500">Blood: {driver.bloodType}</div>
                )}
              </div>
            ) : (
              <span className="text-gray-500">No contact info</span>
            )}
          </div>
        )
      }
    },
    {
      key: 'vehicles',
      label: 'Assigned Vehicles',
      render: (value: any, driver: Driver) => {
        if (!driver || !driver.vehicles || driver.vehicles.length === 0) {
          return <span className="text-sm text-gray-500">No vehicles assigned</span>
        }
        
        return (
          <div className="text-sm">
            {driver.vehicles.slice(0, 2).map((vehicle, index) => (
              <div key={vehicle.id} className="text-gray-900">
                {vehicle.plateNumber} ({vehicle.vehicleType})
              </div>
            ))}
            {driver.vehicles.length > 2 && (
              <div className="text-gray-500">
                +{driver.vehicles.length - 2} more
              </div>
            )}
          </div>
        )
      }
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: any, driver: Driver) => {
        if (!driver) return null
        return (
          <StatusBadge
            status={driver.isActive ? 'Active' : 'Inactive'}
            className={getStatusColor(driver.isActive)}
          />
        )
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (value: any, driver: Driver) => {
        if (!driver || !driver.id) return null
        
        return (
          <div className="flex space-x-2">
            <ActionButton
              onClick={() => handleViewDetails(driver)}
              variant="secondary"
              size="sm"
            >
              View Details
            </ActionButton>
            {driver.isActive ? (
              <ActionButton
                onClick={() => handleStatusUpdate(driver.id, false)}
                variant="danger"
                size="sm"
              >
                Deactivate
              </ActionButton>
            ) : (
              <ActionButton
                onClick={() => handleStatusUpdate(driver.id, true)}
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
              placeholder="Search drivers..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-w-0"
            />
          </div>

          {/* License Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              License Type
            </label>
            <select
              value={filters.licenseType}
              onChange={(e) => setFilters(prev => ({ ...prev, licenseType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">All Types</option>
              <option value="PROFESSIONAL">Professional</option>
              <option value="NON-PROFESSIONAL">Non-Professional</option>
              <option value="STUDENT-PERMIT">Student Permit</option>
              <option value="CONDUCTOR">Conductor</option>
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
              onClick={() => setFilters({ licenseType: '', isActive: '', search: '' })}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
          <div className="bg-green-50 p-3 rounded-lg min-w-0">
            <div className="text-sm text-green-600 font-medium truncate">Active Drivers</div>
            <div className="text-lg font-bold text-green-800">
              {drivers.filter(d => d.isActive).length}
            </div>
          </div>
          <div className="bg-emerald-50 p-3 rounded-lg min-w-0">
            <div className="text-sm text-emerald-600 font-medium truncate">With Vehicles</div>
            <div className="text-lg font-bold text-emerald-800">
              {drivers.filter(d => (d.vehicleCount || 0) > 0).length}
            </div>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg min-w-0">
            <div className="text-sm text-yellow-600 font-medium truncate">License Expiring</div>
            <div className="text-lg font-bold text-yellow-800">
              {drivers.filter(d => {
                if (!d.licenseExpiry) return false
                const daysUntilExpiry = Math.ceil((new Date(d.licenseExpiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                return daysUntilExpiry <= 30 && daysUntilExpiry > 0
              }).length}
            </div>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg min-w-0">
            <div className="text-sm text-blue-600 font-medium truncate">Total Drivers</div>
            <div className="text-lg font-bold text-blue-800">
              {totalDrivers}
            </div>
          </div>
        </div>
      </div>

      {/* Drivers Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <ResponsiveTable
          columns={columns}
          data={drivers || []}
          loading={loading}
          emptyMessage="No drivers found matching your criteria"
        />
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-sm text-gray-700 min-w-0">
              <span className="block sm:inline">
                Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalDrivers)} of {totalDrivers} drivers
              </span>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                onClick={() => {
                  const newPage = Math.max(1, currentPage - 1)
                  setCurrentPage(newPage)
                  fetchDrivers(newPage, filters)
                }}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700 whitespace-nowrap">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => {
                  const newPage = Math.min(totalPages, currentPage + 1)
                  setCurrentPage(newPage)
                  fetchDrivers(newPage, filters)
                }}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Driver Details Modal */}
      {showDetails && selectedDriver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Driver Details - {`${selectedDriver.user.firstName} ${selectedDriver.user.lastName}`}
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
                {/* Driver Information */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Driver Information</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-500">Full Name:</span>
                      <div className="font-medium">{`${selectedDriver.user.firstName} ${selectedDriver.user.lastName}`}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">License Number:</span>
                      <div className="font-mono">{selectedDriver.licenseNumber || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">License Type:</span>
                      <div>{selectedDriver.licenseType || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">License Expiry:</span>
                      <div>{selectedDriver.licenseExpiry ? new Date(selectedDriver.licenseExpiry).toLocaleDateString() : 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Emergency Contact:</span>
                      <div>{selectedDriver.emergencyContact || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Blood Type:</span>
                      <div>{selectedDriver.bloodType || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Status:</span>
                      <div>
                        <StatusBadge
                          status={selectedDriver.isActive ? 'Active' : 'Inactive'}
                          className={getStatusColor(selectedDriver.isActive)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assigned Vehicles */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">
                    Assigned Vehicles ({selectedDriver.vehicleCount})
                  </h4>
                  {selectedDriver.vehicles && selectedDriver.vehicles.length > 0 ? (
                    <div className="space-y-3">
                      {selectedDriver.vehicles.map((vehicle) => (
                        <div key={vehicle.id} className="border border-gray-200 rounded-lg p-3">
                          <div className="font-mono font-medium text-gray-900">
                            {vehicle.plateNumber}
                          </div>
                          <div className="text-sm text-gray-600">
                            {vehicle.make} {vehicle.model} ({vehicle.vehicleType})
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No vehicles assigned</p>
                  )}
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

// Mock data for development - replace with actual API call
const mockDrivers: Driver[] = [
  {
    id: '1',
    user: {
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      username: 'juan.delacruz'
    },
    licenseNumber: 'N01-12-123456',
    licenseType: 'PROFESSIONAL',
    licenseExpiry: '2024-12-31',
    emergencyContact: '09171234567',
    bloodType: 'O+',
    isActive: true,
    vehicleCount: 2,
    vehicles: [
      { id: '1', plateNumber: 'ABC-123', vehicleType: 'TRICYCLE', make: 'Honda', model: 'TMX 155' },
      { id: '2', plateNumber: 'DEF-456', vehicleType: 'JEEPNEY', make: 'Isuzu', model: 'Elf' }
    ],
    createdAt: '2024-01-15',
    updatedAt: '2024-10-01'
  },
  {
    id: '2',
    user: {
      firstName: 'Maria',
      lastName: 'Santos',
      username: 'maria.santos'
    },
    licenseNumber: 'N02-12-234567',
    licenseType: 'NON-PROFESSIONAL',
    licenseExpiry: '2025-06-15',
    emergencyContact: '09181234567',
    bloodType: 'A+',
    isActive: true,
    vehicleCount: 1,
    vehicles: [
      { id: '3', plateNumber: 'GHI-789', vehicleType: 'TRICYCLE', make: 'Yamaha', model: 'Mio' }
    ],
    createdAt: '2024-02-20',
    updatedAt: '2024-09-15'
  },
  {
    id: '3',
    user: {
      firstName: 'Pedro',
      lastName: 'Garcia',
      username: 'pedro.garcia'
    },
    licenseNumber: 'N03-12-345678',
    licenseType: 'PROFESSIONAL',
    licenseExpiry: '2024-11-30',
    emergencyContact: '09191234567',
    bloodType: 'B+',
    isActive: false,
    vehicleCount: 0,
    vehicles: [],
    createdAt: '2024-03-10',
    updatedAt: '2024-08-20'
  }
]