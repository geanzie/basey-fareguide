'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'

interface DiscountCard {
  id: string
  userId: string
  discountType: 'SENIOR_CITIZEN' | 'PWD' | 'STUDENT'
  idNumber: string | null
  idType: string | null
  issuingAuthority: string | null
  fullName: string
  dateOfBirth: string
  photoUrl: string | null
  schoolName: string | null
  schoolAddress: string | null
  gradeLevel: string | null
  schoolIdExpiry: string | null
  disabilityType: string | null
  pwdIdExpiry: string | null
  verificationStatus: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'EXPIRED'
  verifiedBy: string | null
  verifiedAt: string | null
  verificationNotes: string | null
  rejectionReason: string | null
  isAdminOverride: boolean
  overrideReason: string | null
  overrideBy: string | null
  overrideAt: string | null
  isActive: boolean
  validFrom: string
  validUntil: string
  lastUsedAt: string | null
  usageCount: number
  dailyUsageCount: number
  lastResetDate: string | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    username: string
    firstName: string
    lastName: string
    phoneNumber: string | null
    barangayResidence: string | null
  }
}

interface PaginationInfo {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface DiscountListProps {
  onRefresh?: () => void
}

export default function AdminDiscountList({ onRefresh }: DiscountListProps) {
  const { user } = useAuth()
  const [discountCards, setDiscountCards] = useState<DiscountCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  })

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [discountTypeFilter, setDiscountTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [activeFilter, setActiveFilter] = useState<string>('')
  const [overrideFilter, setOverrideFilter] = useState<string>('')
  const [selectedCard, setSelectedCard] = useState<DiscountCard | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  useEffect(() => {
    fetchDiscountCards()
  }, [pagination.page, searchTerm, discountTypeFilter, statusFilter, activeFilter, overrideFilter])

  const fetchDiscountCards = async () => {
    try {
      setLoading(true)
      setError(null)

      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })

      if (searchTerm) params.append('search', searchTerm)
      if (discountTypeFilter) params.append('discountType', discountTypeFilter)
      if (statusFilter) params.append('verificationStatus', statusFilter)
      if (activeFilter) params.append('isActive', activeFilter)
      if (overrideFilter) params.append('isAdminOverride', overrideFilter)

      const response = await fetch(`/api/admin/discount-cards?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch discount cards')
      }

      const data = await response.json()
      setDiscountCards(data.discountCards)
      setPagination(data.pagination)
    } catch (err: any) {
      setError(err.message)
      console.error('Error fetching discount cards:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchDiscountCards()
  }

  const clearFilters = () => {
    setSearchTerm('')
    setDiscountTypeFilter('')
    setStatusFilter('')
    setActiveFilter('')
    setOverrideFilter('')
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const viewDetails = (card: DiscountCard) => {
    setSelectedCard(card)
    setShowDetailsModal(true)
  }

  const getDiscountTypeBadge = (type: string) => {
    const badges = {
      SENIOR_CITIZEN: 'bg-purple-100 text-purple-800',
      PWD: 'bg-blue-100 text-blue-800',
      STUDENT: 'bg-green-100 text-green-800'
    }
    return badges[type as keyof typeof badges] || 'bg-gray-100 text-gray-800'
  }

  const getDiscountTypeLabel = (type: string) => {
    const labels = {
      SENIOR_CITIZEN: 'Senior Citizen',
      PWD: 'PWD',
      STUDENT: 'Student'
    }
    return labels[type as keyof typeof labels] || type
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      UNDER_REVIEW: 'bg-blue-100 text-blue-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      SUSPENDED: 'bg-orange-100 text-orange-800',
      EXPIRED: 'bg-gray-100 text-gray-800'
    }
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date()
    const birth = new Date(dateOfBirth)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  if (loading && discountCards.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Discount Cards List</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-600 font-medium">Total Cards</div>
            <div className="text-2xl font-bold text-blue-900">{pagination.totalCount}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-600 font-medium">Active Cards</div>
            <div className="text-2xl font-bold text-green-900">
              {discountCards.filter(c => c.isActive).length}
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-sm text-purple-600 font-medium">Admin Overrides</div>
            <div className="text-2xl font-bold text-purple-900">
              {discountCards.filter(c => c.isAdminOverride).length}
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-sm text-orange-600 font-medium">Pending Review</div>
            <div className="text-2xl font-bold text-orange-900">
              {discountCards.filter(c => c.verificationStatus === 'PENDING' || c.verificationStatus === 'UNDER_REVIEW').length}
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Name, ID number, username..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount Type
              </label>
              <select
                value={discountTypeFilter}
                onChange={(e) => setDiscountTypeFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Types</option>
                <option value="SENIOR_CITIZEN">Senior Citizen</option>
                <option value="PWD">PWD</option>
                <option value="STUDENT">Student</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Verification Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">⏳ Pending</option>
                <option value="UNDER_REVIEW">👁️ Under Review</option>
                <option value="APPROVED">✓ Approved</option>
                <option value="REJECTED">✗ Rejected</option>
                <option value="SUSPENDED">⚠️ Suspended</option>
                <option value="EXPIRED">⌛ Expired</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Active Status
              </label>
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin Override
              </label>
              <select
                value={overrideFilter}
                onChange={(e) => setOverrideFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Applications</option>
                <option value="true">Override Only</option>
                <option value="false">Regular Only</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Clear Filters
            </button>
            <button
              type="button"
              onClick={fetchDiscountCards}
              className="ml-auto px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Discount Cards Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User Info
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Discount Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valid Until
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {discountCards.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No discount cards found. Adjust your filters or search criteria.
                  </td>
                </tr>
              ) : (
                discountCards.map((card) => (
                  <tr key={card.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-900">
                          {card.user.firstName} {card.user.lastName}
                        </div>
                        <div className="text-sm text-gray-500">@{card.user.username}</div>
                        {card.user.barangayResidence && (
                          <div className="text-xs text-gray-400">{card.user.barangayResidence}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDiscountTypeBadge(card.discountType)}`}>
                        {getDiscountTypeLabel(card.discountType)}
                      </span>
                      {card.isAdminOverride && (
                        <div className="mt-1">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                            Override
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{card.idNumber || 'N/A'}</div>
                      {card.idType && (
                        <div className="text-xs text-gray-500">{card.idType}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(card.verificationStatus)}`}>
                          {card.verificationStatus}
                        </span>
                        {card.isActive ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                            Inactive
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(card.validUntil)}</div>
                      {new Date(card.validUntil) < new Date() && (
                        <div className="text-xs text-red-500">Expired</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        Total: {card.usageCount}
                      </div>
                      <div className="text-xs text-gray-500">
                        Today: {card.dailyUsageCount}
                      </div>
                      {card.lastUsedAt && (
                        <div className="text-xs text-gray-400">
                          Last: {formatDate(card.lastUsedAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => viewDetails(card)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of {pagination.totalCount} results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={!pagination.hasPrev}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const page = i + 1
                  return (
                    <button
                      key={page}
                      onClick={() => setPagination(prev => ({ ...prev, page }))}
                      className={`px-4 py-2 border rounded-lg text-sm font-medium ${
                        pagination.page === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={!pagination.hasNext}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Discount Card Details</h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* User Information */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">User Information</h4>
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                    <div>
                      <div className="text-sm text-gray-500">Full Name</div>
                      <div className="text-sm font-medium text-gray-900">{selectedCard.fullName}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Username</div>
                      <div className="text-sm font-medium text-gray-900">@{selectedCard.user.username}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Date of Birth</div>
                      <div className="text-sm font-medium text-gray-900">
                        {formatDate(selectedCard.dateOfBirth)} ({calculateAge(selectedCard.dateOfBirth)} years old)
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Phone Number</div>
                      <div className="text-sm font-medium text-gray-900">{selectedCard.user.phoneNumber || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Barangay</div>
                      <div className="text-sm font-medium text-gray-900">{selectedCard.user.barangayResidence || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                {/* Photo ID */}
                {selectedCard.photoUrl && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Uploaded Photo ID</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-center">
                        <img
                          src={selectedCard.photoUrl}
                          alt="Discount Card Photo"
                          className="max-w-md max-h-96 object-contain rounded-lg border-2 border-gray-300 shadow-sm"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder-image.png'
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 text-center mt-2">
                        Click to view full size or download
                      </p>
                      <div className="flex justify-center mt-2 gap-2">
                        <a
                          href={selectedCard.photoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        >
                          View Full Size
                        </a>
                        <a
                          href={selectedCard.photoUrl}
                          download
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Discount Information */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Discount Information</h4>
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                    <div>
                      <div className="text-sm text-gray-500">Discount Type</div>
                      <div className="text-sm font-medium text-gray-900">{getDiscountTypeLabel(selectedCard.discountType)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">ID Number</div>
                      <div className="text-sm font-medium text-gray-900">{selectedCard.idNumber || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">ID Type</div>
                      <div className="text-sm font-medium text-gray-900">{selectedCard.idType || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Issuing Authority</div>
                      <div className="text-sm font-medium text-gray-900">{selectedCard.issuingAuthority || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                {/* Type-Specific Information */}
                {selectedCard.discountType === 'STUDENT' && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Student Information</h4>
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                      <div>
                        <div className="text-sm text-gray-500">School Name</div>
                        <div className="text-sm font-medium text-gray-900">{selectedCard.schoolName || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Grade Level</div>
                        <div className="text-sm font-medium text-gray-900">{selectedCard.gradeLevel || 'N/A'}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-sm text-gray-500">School Address</div>
                        <div className="text-sm font-medium text-gray-900">{selectedCard.schoolAddress || 'N/A'}</div>
                      </div>
                      {selectedCard.schoolIdExpiry && (
                        <div>
                          <div className="text-sm text-gray-500">School ID Expiry</div>
                          <div className="text-sm font-medium text-gray-900">{formatDate(selectedCard.schoolIdExpiry)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedCard.discountType === 'PWD' && selectedCard.disabilityType && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">PWD Information</h4>
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                      <div>
                        <div className="text-sm text-gray-500">Disability Type</div>
                        <div className="text-sm font-medium text-gray-900">{selectedCard.disabilityType}</div>
                      </div>
                      {selectedCard.pwdIdExpiry && (
                        <div>
                          <div className="text-sm text-gray-500">PWD ID Expiry</div>
                          <div className="text-sm font-medium text-gray-900">{formatDate(selectedCard.pwdIdExpiry)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Verification Status */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Verification Status</h4>
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                    <div>
                      <div className="text-sm text-gray-500">Status</div>
                      <div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(selectedCard.verificationStatus)}`}>
                          {selectedCard.verificationStatus}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Active</div>
                      <div className="text-sm font-medium text-gray-900">{selectedCard.isActive ? 'Yes' : 'No'}</div>
                    </div>
                    {selectedCard.verifiedAt && (
                      <>
                        <div>
                          <div className="text-sm text-gray-500">Verified At</div>
                          <div className="text-sm font-medium text-gray-900">{formatDate(selectedCard.verifiedAt)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Verified By</div>
                          <div className="text-sm font-medium text-gray-900">{selectedCard.verifiedBy || 'N/A'}</div>
                        </div>
                      </>
                    )}
                    {selectedCard.verificationNotes && (
                      <div className="col-span-2">
                        <div className="text-sm text-gray-500">Verification Notes</div>
                        <div className="text-sm font-medium text-gray-900">{selectedCard.verificationNotes}</div>
                      </div>
                    )}
                    {selectedCard.rejectionReason && (
                      <div className="col-span-2">
                        <div className="text-sm text-gray-500">Rejection Reason</div>
                        <div className="text-sm font-medium text-red-600">{selectedCard.rejectionReason}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Admin Override */}
                {selectedCard.isAdminOverride && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Admin Override</h4>
                    <div className="grid grid-cols-2 gap-4 bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                      <div>
                        <div className="text-sm text-gray-500">Override By</div>
                        <div className="text-sm font-medium text-gray-900">{selectedCard.overrideBy || 'N/A'}</div>
                      </div>
                      {selectedCard.overrideAt && (
                        <div>
                          <div className="text-sm text-gray-500">Override At</div>
                          <div className="text-sm font-medium text-gray-900">{formatDate(selectedCard.overrideAt)}</div>
                        </div>
                      )}
                      {selectedCard.overrideReason && (
                        <div className="col-span-2">
                          <div className="text-sm text-gray-500">Override Reason</div>
                          <div className="text-sm font-medium text-gray-900">{selectedCard.overrideReason}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Validity Period */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Validity Period</h4>
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                    <div>
                      <div className="text-sm text-gray-500">Valid From</div>
                      <div className="text-sm font-medium text-gray-900">{formatDate(selectedCard.validFrom)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Valid Until</div>
                      <div className="text-sm font-medium text-gray-900">{formatDate(selectedCard.validUntil)}</div>
                    </div>
                  </div>
                </div>

                {/* Usage Statistics */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Usage Statistics</h4>
                  <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
                    <div>
                      <div className="text-sm text-gray-500">Total Usage</div>
                      <div className="text-sm font-medium text-gray-900">{selectedCard.usageCount}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Daily Usage</div>
                      <div className="text-sm font-medium text-gray-900">{selectedCard.dailyUsageCount}</div>
                    </div>
                    {selectedCard.lastUsedAt && (
                      <div>
                        <div className="text-sm text-gray-500">Last Used</div>
                        <div className="text-sm font-medium text-gray-900">{formatDate(selectedCard.lastUsedAt)}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timestamps */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Timestamps</h4>
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                    <div>
                      <div className="text-sm text-gray-500">Created At</div>
                      <div className="text-sm font-medium text-gray-900">{formatDate(selectedCard.createdAt)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Updated At</div>
                      <div className="text-sm font-medium text-gray-900">{formatDate(selectedCard.updatedAt)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
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
