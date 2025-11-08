'use client'

import { useState, useEffect } from 'react'

interface User {
  id: string
  username: string
  firstName: string
  lastName: string
  dateOfBirth: Date | null
  phoneNumber: string | null
  barangayResidence: string | null
  createdAt: Date
}

interface DiscountType {
  value: 'SENIOR_CITIZEN' | 'PWD' | 'STUDENT'
  label: string
  description: string
}

interface AdminDiscountOverrideProps {
  onSuccess?: (discountCard: any) => void
  onCancel?: () => void
}

export default function AdminDiscountOverride({ onSuccess, onCancel }: AdminDiscountOverrideProps) {
  const [eligibleUsers, setEligibleUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [discountTypes, setDiscountTypes] = useState<DiscountType[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedDiscountType, setSelectedDiscountType] = useState<'SENIOR_CITIZEN' | 'PWD' | 'STUDENT' | ''>('')
  const [validFrom, setValidFrom] = useState<string>(new Date().toISOString().split('T')[0])
  const [validUntil, setValidUntil] = useState<string>(
    new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
  )
  const [overrideReason, setOverrideReason] = useState('')
  const [notes, setNotes] = useState('')

  // Optional fields
  const [schoolName, setSchoolName] = useState('')
  const [disabilityType, setDisabilityType] = useState('')
  const [idNumber, setIdNumber] = useState('')

  // Load eligible users and discount types
  useEffect(() => {
    fetchEligibleUsers()
  }, [])

  // Filter users based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(eligibleUsers)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = eligibleUsers.filter(user =>
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(query) ||
      user.username.toLowerCase().includes(query) ||
      user.barangayResidence?.toLowerCase().includes(query)
    )
    setFilteredUsers(filtered)
  }, [searchQuery, eligibleUsers])

  const fetchEligibleUsers = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      const response = await fetch('/api/admin/discount-cards/create', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch eligible users')
      }

      const data = await response.json()
      setEligibleUsers(data.eligibleUsers || [])
      setFilteredUsers(data.eligibleUsers || [])
      setDiscountTypes(data.discountTypes || [])
      } catch (err: any) {
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Validation
    if (!selectedUserId) {
      setError('Please select a user')
      return
    }

    if (!selectedDiscountType) {
      setError('Please select a discount type')
      return
    }

    if (!overrideReason.trim()) {
      setError('Please provide a reason for this override')
      return
    }

    if (overrideReason.length < 10) {
      setError('Override reason must be at least 10 characters')
      return
    }

    try {
      setCreating(true)
      const token = localStorage.getItem('token')

      const payload: any = {
        userId: selectedUserId,
        discountType: selectedDiscountType,
        validFrom: validFrom,
        validUntil: validUntil,
        overrideReason: overrideReason.trim(),
        notes: notes.trim() || undefined
      }

      // Add optional fields
      if (idNumber.trim()) payload.idNumber = idNumber.trim()
      if (selectedDiscountType === 'STUDENT' && schoolName.trim()) {
        payload.schoolName = schoolName.trim()
      }
      if (selectedDiscountType === 'PWD' && disabilityType.trim()) {
        payload.disabilityType = disabilityType.trim()
      }

      const response = await fetch('/api/admin/discount-cards/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create discount card')
      }

      setSuccess(`Discount card created successfully for ${data.discountCard.user.firstName} ${data.discountCard.user.lastName}`)
      
      // Reset form
      setSelectedUserId('')
      setSelectedDiscountType('')
      setOverrideReason('')
      setNotes('')
      setSchoolName('')
      setDisabilityType('')
      setIdNumber('')

      // Remove user from eligible list
      setEligibleUsers(prev => prev.filter(u => u.id !== selectedUserId))

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(data.discountCard)
      }

      // Refresh user list
      setTimeout(() => {
        fetchEligibleUsers()
      }, 1000)
      } catch (err: any) {
      setError(err.message || 'Failed to create discount card')
    } finally {
      setCreating(false)
    }
  }

  const selectedUser = eligibleUsers.find(u => u.id === selectedUserId)

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span className="text-3xl">👤➕</span>
          Admin Discount Card Override
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Manually activate discount cards without validation. This action bypasses all requirements.
        </p>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-800">Error</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800 text-xl">
            ✕
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <span className="text-2xl">✓</span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-green-800">Success</h3>
            <p className="text-sm text-green-700">{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-600 hover:text-green-800 text-xl">
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select User <span className="text-red-500">*</span>
            </label>
            
            {/* Search */}
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl">🔍</span>
              <input
                type="text"
                placeholder="Search by name, username, or barangay..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* User List */}
            <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {searchQuery ? 'No users found matching your search' : 'No eligible users available'}
                </div>
              ) : (
                filteredUsers.map(user => (
                  <label
                    key={user.id}
                    className={`flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 ${
                      selectedUserId === user.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="user"
                      value={user.id}
                      checked={selectedUserId === user.id}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-gray-600">@{user.username}</div>
                      {user.barangayResidence && (
                        <div className="text-xs text-gray-500 mt-1">
                          📍 {user.barangayResidence}
                        </div>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>

            {selectedUser && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-900">Selected User:</div>
                <div className="text-sm text-blue-800 mt-1">
                  {selectedUser.firstName} {selectedUser.lastName} (@{selectedUser.username})
                </div>
              </div>
            )}
          </div>

          {/* Discount Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Discount Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {discountTypes.map(type => (
                <label
                  key={type.value}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedDiscountType === type.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-blue-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="discountType"
                    value={type.value}
                    checked={selectedDiscountType === type.value}
                    onChange={(e) => setSelectedDiscountType(e.target.value as any)}
                    className="sr-only"
                  />
                  <div className="font-medium text-gray-900">{type.label}</div>
                  <div className="text-xs text-gray-600 mt-1">{type.description}</div>
                </label>
              ))}
            </div>
          </div>

          {/* Conditional Fields */}
          {selectedDiscountType === 'STUDENT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                School Name (Optional)
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="e.g., Basey National High School"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {selectedDiscountType === 'PWD' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Disability Type (Optional)
              </label>
              <input
                type="text"
                value={disabilityType}
                onChange={(e) => setDisabilityType(e.target.value)}
                placeholder="e.g., Visual Impairment, Mobility"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* ID Number (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ID Number (Optional)
            </label>
            <input
              type="text"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="Reference ID number if available"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Validity Period */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valid From <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">📅</span>
                <input
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valid Until <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">📅</span>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  required
                  min={validFrom}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Override Reason (Required) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Override Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              required
              minLength={10}
              rows={3}
              placeholder="Provide a detailed reason for bypassing validation (minimum 10 characters). Example: Emergency assistance approved by Mayor's office, Government official designation, etc."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="text-xs text-gray-500 mt-1">
              {overrideReason.length}/10 minimum characters
            </div>
          </div>

          {/* Additional Notes (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional information or context..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={creating || !selectedUserId || !selectedDiscountType}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <span className="text-xl">✓</span>
                  Create Discount Card
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
