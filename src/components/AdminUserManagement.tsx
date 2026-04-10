'use client'

import { useEffect, useMemo, useState } from 'react'
import LoadingSpinner from '@/components/LoadingSpinner'
import ResponsiveTable, { ActionButton, StatusBadge } from './ResponsiveTable'
import AdminPasswordReset from './AdminPasswordReset'

enum UserType {
  ADMIN = 'ADMIN',
  DATA_ENCODER = 'DATA_ENCODER',
  ENFORCER = 'ENFORCER',
  PUBLIC = 'PUBLIC',
}

interface AdminUserForm {
  username: string
  firstName: string
  lastName: string
  phoneNumber: string
  userType: UserType
  department?: string
  position?: string
  employeeId?: string
  notes?: string
}

interface AdminUserListItem {
  id: string
  username: string
  firstName: string
  lastName: string
  userType: string
  isActive: boolean
  isVerified: boolean
  createdAt: string
  governmentId?: string
  barangayResidence?: string
  reasonForRegistration?: string
  phoneNumber?: string
}

interface PaginatedAdminUsersResponse {
  success?: boolean
  users?: AdminUserListItem[]
  pagination?: {
    totalPages?: number
  }
}

type AdminTab = 'create' | 'pending' | 'users' | 'password-reset'

const EMPTY_USER_FORM: AdminUserForm = {
  username: '',
  firstName: '',
  lastName: '',
  phoneNumber: '',
  userType: UserType.DATA_ENCODER,
  department: '',
  position: '',
  employeeId: '',
  notes: '',
}

const TABS: Array<{ key: AdminTab; label: string }> = [
  { key: 'create', label: 'Create Official User' },
  { key: 'pending', label: 'Pending Verifications' },
  { key: 'users', label: 'All Users' },
  { key: 'password-reset', label: 'Password Reset' },
]

const ADMIN_USERS_PAGE_SIZE = 100

export default function AdminUserManagement() {
  const [activeTab, setActiveTab] = useState<AdminTab>('create')
  const [users, setUsers] = useState<AdminUserListItem[]>([])
  const [pendingUsers, setPendingUsers] = useState<AdminUserListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterUserType, setFilterUserType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [createUserMessage, setCreateUserMessage] = useState<string | null>(null)
  const [newUser, setNewUser] = useState<AdminUserForm>(EMPTY_USER_FORM)

  useEffect(() => {
    if (activeTab === 'users' || activeTab === 'password-reset') {
      void fetchUsers()
      return
    }

    if (activeTab === 'pending') {
      void fetchPendingUsers()
    }
  }, [activeTab])

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const searchLower = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !searchLower ||
        user.firstName.toLowerCase().includes(searchLower) ||
        user.lastName.toLowerCase().includes(searchLower) ||
        user.username.toLowerCase().includes(searchLower) ||
        user.phoneNumber?.toLowerCase().includes(searchLower) ||
        user.governmentId?.toLowerCase().includes(searchLower) ||
        user.barangayResidence?.toLowerCase().includes(searchLower)

      const matchesUserType = filterUserType === 'all' || user.userType === filterUserType
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && user.isActive) ||
        (filterStatus === 'inactive' && !user.isActive) ||
        (filterStatus === 'verified' && user.isVerified) ||
        (filterStatus === 'pending' && !user.isVerified)

      return Boolean(matchesSearch && matchesUserType && matchesStatus)
    })
  }, [filterStatus, filterUserType, searchQuery, users])

  async function loadAllUsers(endpoint: string) {
    const collectedUsers: AdminUserListItem[] = []
    let page = 1
    let totalPages = 1

    while (page <= totalPages) {
      const separator = endpoint.includes('?') ? '&' : '?'
      const response = await fetch(`${endpoint}${separator}page=${page}&limit=${ADMIN_USERS_PAGE_SIZE}`)
      const data: PaginatedAdminUsersResponse = await response.json()

      if (!response.ok || !data.success) {
        throw new Error('Failed to fetch users')
      }

      collectedUsers.push(...(data.users || []))
      totalPages = data.pagination?.totalPages || page
      page += 1
    }

    return collectedUsers
  }

  async function fetchUsers() {
    try {
      setLoading(true)
      setUsers(await loadAllUsers('/api/admin/users'))
    } finally {
      setLoading(false)
    }
  }

  async function fetchPendingUsers() {
    try {
      setLoading(true)
      setPendingUsers(await loadAllUsers('/api/admin/users/pending'))
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateUser(event: React.FormEvent) {
    event.preventDefault()
    setCreateUserMessage(null)

    try {
      setLoading(true)

      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        alert(data.error || 'Failed to create user')
        return
      }

      setCreateUserMessage(
        `${data.message || `Account created for ${data.user.username}.`} Temporary password: ${data.tempPassword}. Share these credentials securely with the user and ask them to change the password after first login.`
      )
      setNewUser(EMPTY_USER_FORM)

      if (activeTab === 'users') {
        await fetchUsers()
      }
    } catch {
      alert('Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyUser(userId: string, action: 'approve' | 'reject', reason?: string) {
    try {
      setLoading(true)

      const response = await fetch('/api/admin/users/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, action, reason }),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        alert(data.error || `Failed to ${action} user`)
        return
      }

      alert(data.message || `User ${action}d successfully!`)
      await fetchPendingUsers()

      if (activeTab === 'users') {
        await fetchUsers()
      }
    } catch {
      alert(`Failed to ${action} user`)
    } finally {
      setLoading(false)
    }
  }

  async function toggleUserStatus(userId: string, currentStatus: boolean) {
    try {
      setLoading(true)

      const response = await fetch('/api/admin/users/toggle-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, isActive: !currentStatus }),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        alert(data.error || 'Failed to update user status')
        return
      }

      alert(data.message || `User ${!currentStatus ? 'activated' : 'deactivated'} successfully!`)
      await fetchUsers()
    } catch {
      alert('Failed to update user status')
    } finally {
      setLoading(false)
    }
  }

  function renderTabNavigation() {
    return (
      <div className="border-b border-gray-200">
        <nav className="flex flex-wrap gap-6 px-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    )
  }

  function renderCreateTab() {
    return (
      <form onSubmit={handleCreateUser} className="space-y-6">
        {createUserMessage ? (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-sm text-green-800">{createUserMessage}</p>
          </div>
        ) : null}

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex gap-3">
            <div className="text-blue-600 text-sm font-semibold uppercase tracking-wide">Info</div>
            <div>
              <h3 className="text-sm font-medium text-blue-800">Creating Official User Account</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  Only administrators can create administrator, enforcer, and data encoder accounts here. These
                  accounts are activated immediately.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <LabeledInput label="Username *" fieldId="admin-user-username">
            <input
              id="admin-user-username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={newUser.username}
              onChange={(event) => setNewUser({ ...newUser, username: event.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </LabeledInput>

          <LabeledInput label="First Name *" fieldId="admin-user-first-name">
            <input
              id="admin-user-first-name"
              name="firstName"
              type="text"
              autoComplete="given-name"
              required
              value={newUser.firstName}
              onChange={(event) => setNewUser({ ...newUser, firstName: event.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </LabeledInput>

          <LabeledInput label="Last Name *" fieldId="admin-user-last-name">
            <input
              id="admin-user-last-name"
              name="lastName"
              type="text"
              autoComplete="family-name"
              required
              value={newUser.lastName}
              onChange={(event) => setNewUser({ ...newUser, lastName: event.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </LabeledInput>

          <LabeledInput label="Phone Number *" fieldId="admin-user-phone-number">
            <input
              id="admin-user-phone-number"
              name="phoneNumber"
              type="tel"
              autoComplete="tel"
              required
              value={newUser.phoneNumber}
              onChange={(event) => setNewUser({ ...newUser, phoneNumber: event.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </LabeledInput>

          <LabeledInput label="User Role *" fieldId="admin-user-role">
            <select
              id="admin-user-role"
              name="userType"
              autoComplete="off"
              required
              value={newUser.userType}
              onChange={(event) => setNewUser({ ...newUser, userType: event.target.value as UserType })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value={UserType.DATA_ENCODER}>Data Encoder</option>
              <option value={UserType.ENFORCER}>Enforcer</option>
              <option value={UserType.ADMIN}>Administrator</option>
            </select>
          </LabeledInput>

          <LabeledInput label="Employee ID" fieldId="admin-user-employee-id">
            <input
              id="admin-user-employee-id"
              name="employeeId"
              type="text"
              autoComplete="off"
              value={newUser.employeeId}
              onChange={(event) => setNewUser({ ...newUser, employeeId: event.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </LabeledInput>

          <LabeledInput label="Department" fieldId="admin-user-department">
            <input
              id="admin-user-department"
              name="department"
              type="text"
              autoComplete="organization"
              value={newUser.department}
              onChange={(event) => setNewUser({ ...newUser, department: event.target.value })}
              placeholder="e.g., Traffic Management, Transport Office"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </LabeledInput>

          <LabeledInput label="Position" fieldId="admin-user-position">
            <input
              id="admin-user-position"
              name="position"
              type="text"
              autoComplete="organization-title"
              value={newUser.position}
              onChange={(event) => setNewUser({ ...newUser, position: event.target.value })}
              placeholder="e.g., Traffic Enforcer, Data Entry Clerk"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </LabeledInput>
        </div>

        <LabeledInput label="Notes" fieldId="admin-user-notes">
          <textarea
            id="admin-user-notes"
            name="notes"
            autoComplete="off"
            value={newUser.notes}
            onChange={(event) => setNewUser({ ...newUser, notes: event.target.value })}
            rows={3}
            placeholder="Additional notes about this user account..."
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </LabeledInput>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>
    )
  }

  function renderPendingTab() {
    if (loading) {
      return (
        <div className="text-center py-8">
          <LoadingSpinner className="justify-center text-blue-600" size={24} />
          <p className="mt-2 text-gray-600">Loading pending users...</p>
        </div>
      )
    }

    if (pendingUsers.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">No pending user verifications</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {pendingUsers.map((user) => (
          <div key={user.id} className="app-surface-inner rounded-lg p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">
                  {user.firstName} {user.lastName}
                </h3>
                <div className="mt-2 grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                  <div>
                    <span className="font-medium">Government ID:</span> {user.governmentId || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">Barangay:</span> {user.barangayResidence || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">Registered:</span>{' '}
                    {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {user.reasonForRegistration ? (
                  <div className="mt-2">
                    <span className="font-medium text-sm">Reason:</span>
                    <p className="text-sm text-gray-600 mt-1">{user.reasonForRegistration}</p>
                  </div>
                ) : null}
              </div>

              <div className="flex gap-2 lg:ml-4">
                <button
                  onClick={() => handleVerifyUser(user.id, 'approve')}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => {
                    const reason = window.prompt('Reason for rejection:')
                    if (reason) {
                      void handleVerifyUser(user.id, 'reject', reason)
                    }
                  }}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  function renderUsersTab() {
    return (
      <div className="space-y-6">
        <div className="app-surface-inner rounded-lg p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label htmlFor="admin-users-search" className="block text-sm font-medium text-gray-700 mb-2">Search Users</label>
              <input
                id="admin-users-search"
                name="userSearch"
                type="text"
                autoComplete="off"
                placeholder="Search by name, username, phone, ID, or barangay..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="admin-users-type-filter" className="block text-sm font-medium text-gray-700 mb-2">User Type</label>
              <select
                id="admin-users-type-filter"
                name="userTypeFilter"
                autoComplete="off"
                value={filterUserType}
                onChange={(event) => setFilterUserType(event.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types</option>
                <option value="ADMIN">Administrator</option>
                <option value="ENFORCER">Enforcer</option>
                <option value="DATA_ENCODER">Data Encoder</option>
                <option value="PUBLIC">Public</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">Status Filter</label>
              <div className="flex flex-wrap gap-2">
                <FilterButton
                  active={filterStatus === 'all'}
                  onClick={() => setFilterStatus('all')}
                  label={`All (${users.length})`}
                />
                <FilterButton
                  active={filterStatus === 'active'}
                  onClick={() => setFilterStatus('active')}
                  activeClassName="bg-green-600 text-white"
                  label={`Active (${users.filter((user) => user.isActive).length})`}
                />
                <FilterButton
                  active={filterStatus === 'inactive'}
                  onClick={() => setFilterStatus('inactive')}
                  activeClassName="bg-red-600 text-white"
                  label={`Inactive (${users.filter((user) => !user.isActive).length})`}
                />
                <FilterButton
                  active={filterStatus === 'verified'}
                  onClick={() => setFilterStatus('verified')}
                  label={`Verified (${users.filter((user) => user.isVerified).length})`}
                />
                <FilterButton
                  active={filterStatus === 'pending'}
                  onClick={() => setFilterStatus('pending')}
                  activeClassName="bg-yellow-600 text-white"
                  label={`Pending (${users.filter((user) => !user.isVerified).length})`}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold">{filteredUsers.length}</span> of{' '}
              <span className="font-semibold">{users.length}</span> total users
              {searchQuery ? (
                <span className="ml-2">
                  - Searching for: <span className="font-semibold">&quot;{searchQuery}&quot;</span>
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <ResponsiveTable
          columns={[
            {
              key: 'user',
              label: 'User',
              mobileLabel: 'User Info',
              render: (_, user: AdminUserListItem) => (
                <div>
                  <div className="font-medium text-gray-900">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-sm text-gray-500">@{user.username}</div>
                </div>
              ),
            },
            {
              key: 'userType',
              label: 'Role',
              render: (userType: string) => (
                <StatusBadge
                  status={userType.replace('_', ' ')}
                  className={
                    userType === 'ADMIN'
                      ? 'bg-purple-100 text-purple-800'
                      : userType === 'ENFORCER'
                        ? 'bg-red-100 text-red-800'
                        : userType === 'DATA_ENCODER'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                  }
                />
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (_: unknown, user: AdminUserListItem) => (
                <div className="space-y-1">
                  <StatusBadge
                    status={user.isActive ? 'Active' : 'Inactive'}
                    className={user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                  />
                  <br />
                  <StatusBadge
                    status={user.isVerified ? 'Verified' : 'Pending'}
                    className={user.isVerified ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}
                  />
                </div>
              ),
            },
            {
              key: 'createdAt',
              label: 'Created',
              mobileLabel: 'Created Date',
              render: (createdAt: string) => new Date(createdAt).toLocaleDateString(),
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (_: unknown, user: AdminUserListItem) => (
                <ActionButton
                  onClick={() => toggleUserStatus(user.id, user.isActive)}
                  variant={user.isActive ? 'danger' : 'primary'}
                >
                  {user.isActive ? 'Deactivate' : 'Activate'}
                </ActionButton>
              ),
            },
          ]}
          data={filteredUsers}
          loading={loading}
          emptyMessage="No users found"
          className="app-surface-card rounded-2xl"
        />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="app-surface-card rounded-2xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage official accounts and verify public users</p>
        </div>

        {renderTabNavigation()}

        <div className="p-6">
          {activeTab === 'create' ? renderCreateTab() : null}
          {activeTab === 'pending' ? renderPendingTab() : null}
          {activeTab === 'users' ? renderUsersTab() : null}
          {activeTab === 'password-reset' ? <AdminPasswordReset users={users} onRefresh={fetchUsers} /> : null}
        </div>
      </div>
    </div>
  )
}

function FilterButton({
  active,
  activeClassName = 'bg-blue-600 text-white',
  label,
  onClick,
}: {
  active: boolean
  activeClassName?: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium ${
        active ? activeClassName : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )
}

function LabeledInput({
  children,
  fieldId,
  label,
}: {
  children: React.ReactNode
  fieldId: string
  label: string
}) {
  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}
