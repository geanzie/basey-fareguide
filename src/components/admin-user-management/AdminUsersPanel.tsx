'use client'

import { useMemo, useState } from 'react'

import ResponsiveTable, { ActionButton, StatusBadge } from '@/components/ResponsiveTable'
import type { AdminUserCreationSource, AdminUserDto, AdminUserType } from '@/lib/admin/user-management-contract'

import {
  formatAdminUserTypeLabel,
  formatCreationSourceLabel,
  formatVehicleTypeLabel,
  getCreationSourceBadgeClass,
  getRoleBadgeClass,
} from './display'

interface AdminUsersPanelProps {
  users: AdminUserDto[]
  loading: boolean
  onOpenUser: (user: AdminUserDto) => void
  onToggleStatus: (user: AdminUserDto) => void
  statusUpdatingUserId: string | null
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="app-surface-inner rounded-2xl p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  )
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )
}

export default function AdminUsersPanel({
  users,
  loading,
  onOpenUser,
  onToggleStatus,
  statusUpdatingUserId,
}: AdminUsersPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | AdminUserType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | AdminUserCreationSource>('all')

  const filteredUsers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return users.filter((user) => {
      const matchesSearch =
        !normalizedQuery ||
        user.fullName.toLowerCase().includes(normalizedQuery) ||
        user.username.toLowerCase().includes(normalizedQuery) ||
        (user.phoneNumber || '').toLowerCase().includes(normalizedQuery) ||
        (user.governmentId || '').toLowerCase().includes(normalizedQuery) ||
        (user.barangayResidence || '').toLowerCase().includes(normalizedQuery) ||
        (user.assignedVehicle?.plateNumber || '').toLowerCase().includes(normalizedQuery)

      const matchesRole = roleFilter === 'all' || user.userType === roleFilter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && user.isActive) ||
        (statusFilter === 'inactive' && !user.isActive)
      const matchesSource = sourceFilter === 'all' || user.creationSource === sourceFilter

      return matchesSearch && matchesRole && matchesStatus && matchesSource
    })
  }, [roleFilter, searchQuery, sourceFilter, statusFilter, users])

  const totalUsers = users.length
  const activeUsers = users.filter((user) => user.isActive).length
  const inactiveUsers = totalUsers - activeUsers
  const selfRegisteredUsers = users.filter((user) => user.creationSource === 'SELF_REGISTERED').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <SummaryCard label="Total Accounts" value={totalUsers} />
        <SummaryCard label="Active Accounts" value={activeUsers} />
        <SummaryCard label="Inactive Accounts" value={inactiveUsers} />
        <SummaryCard label="Self-Registered Public" value={selfRegisteredUsers} />
      </div>

      <div className="app-surface-inner rounded-2xl p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label htmlFor="admin-users-search" className="block text-sm font-medium text-gray-700">
              Search users
            </label>
            <input
              id="admin-users-search"
              name="userSearch"
              type="text"
              autoComplete="off"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, username, phone, ID, barangay, or plate..."
              className="mt-2 block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="admin-users-role-filter" className="block text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              id="admin-users-role-filter"
              name="roleFilter"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as 'all' | AdminUserType)}
              className="mt-2 block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
            >
              <option value="all">All roles</option>
              <option value="ADMIN">Administrator</option>
              <option value="DATA_ENCODER">Data Encoder</option>
              <option value="ENFORCER">Enforcer</option>
              <option value="DRIVER">Driver</option>
              <option value="PUBLIC">Public</option>
            </select>
          </div>

          <div>
            <label htmlFor="admin-users-source-filter" className="block text-sm font-medium text-gray-700">
              Creation source
            </label>
            <select
              id="admin-users-source-filter"
              name="creationSourceFilter"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as 'all' | AdminUserCreationSource)}
              className="mt-2 block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
            >
              <option value="all">All sources</option>
              <option value="ADMIN_CREATED">Admin created</option>
              <option value="SELF_REGISTERED">Self-registered</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4 border-t border-gray-200 pt-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-sm font-medium text-gray-700">Account status</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <FilterChip active={statusFilter === 'all'} label={`All (${users.length})`} onClick={() => setStatusFilter('all')} />
              <FilterChip
                active={statusFilter === 'active'}
                label={`Active (${activeUsers})`}
                onClick={() => setStatusFilter('active')}
              />
              <FilterChip
                active={statusFilter === 'inactive'}
                label={`Inactive (${inactiveUsers})`}
                onClick={() => setStatusFilter('inactive')}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 xl:justify-end">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-900">{filteredUsers.length}</span> of{' '}
              <span className="font-semibold text-gray-900">{users.length}</span> users
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setRoleFilter('all')
                setStatusFilter('all')
                setSourceFilter('all')
              }}
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      <ResponsiveTable
        columns={[
          {
            key: 'user',
            label: 'User',
            mobileLabel: 'User',
            render: (_value: unknown, user: AdminUserDto) => (
              <div>
                <div className="font-medium text-gray-900">{user.fullName}</div>
                <div className="text-sm text-gray-500">@{user.username}</div>
              </div>
            ),
          },
          {
            key: 'userType',
            label: 'Role',
            render: (value: string) => (
              <StatusBadge status={formatAdminUserTypeLabel(value)} className={getRoleBadgeClass(value)} />
            ),
          },
          {
            key: 'creationSource',
            label: 'Source',
            mobileLabel: 'Source',
            render: (value: AdminUserCreationSource) => (
              <StatusBadge status={formatCreationSourceLabel(value)} className={getCreationSourceBadgeClass(value)} />
            ),
          },
          {
            key: 'isActive',
            label: 'Status',
            render: (value: boolean) => (
              <StatusBadge
                status={value ? 'Active' : 'Inactive'}
                className={value ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}
              />
            ),
          },
          {
            key: 'assignedVehicle',
            label: 'Driver Link',
            mobileLabel: 'Driver Link',
            render: (value: AdminUserDto['assignedVehicle']) =>
              value ? (
                <div>
                  <div className="font-medium text-gray-900">{value.plateNumber}</div>
                  <div className="text-sm text-gray-500">{formatVehicleTypeLabel(value.vehicleType)}</div>
                </div>
              ) : (
                <span className="text-sm text-gray-500">Not linked</span>
              ),
          },
          {
            key: 'createdAt',
            label: 'Created',
            mobileLabel: 'Created',
            render: (value: string) => new Date(value).toLocaleDateString(),
          },
          {
            key: 'actions',
            label: 'Actions',
            mobileLabel: 'Actions',
            render: (_value: unknown, user: AdminUserDto) => (
              <div className="flex flex-wrap justify-end gap-2 md:justify-start">
                <ActionButton onClick={() => onOpenUser(user)} variant="secondary">
                  View Details
                </ActionButton>
                <ActionButton
                  onClick={() => onToggleStatus(user)}
                  variant={user.isActive ? 'danger' : 'primary'}
                  disabled={statusUpdatingUserId === user.id}
                >
                  {statusUpdatingUserId === user.id ? 'Updating...' : user.isActive ? 'Deactivate' : 'Activate'}
                </ActionButton>
              </div>
            ),
          },
        ]}
        data={filteredUsers}
        loading={loading}
        emptyMessage="No users match the current filters"
        className="app-surface-card rounded-2xl"
        getRowKey={(user) => user.id}
      />
    </div>
  )
}
