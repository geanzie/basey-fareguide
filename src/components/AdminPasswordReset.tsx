'use client'

import { useState } from 'react'

import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
} from '@/components/dashboardIcons'
import { submitAdminPasswordReset } from '@/components/admin-user-management/api'
import { formatAdminUserTypeLabel, formatCreationSourceLabel } from '@/components/admin-user-management/display'
import type { AdminUserDto } from '@/lib/admin/user-management-contract'

interface AdminPasswordResetProps {
  users: AdminUserDto[]
  onRefresh?: () => void
}

const AdminPasswordReset = ({ users, onRefresh }: AdminPasswordResetProps) => {
  const [selectedUserId, setSelectedUserId] = useState('')
  const [action, setAction] = useState<'generate-token' | 'set-password'>('generate-token')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<string | null>(null)
  const [resetOutput, setResetOutput] = useState<{ token: string | null; expiresAt: string | null } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const selectedUser = users.find((user) => user.id === selectedUserId)

  const filteredUsers = users.filter((user) => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) {
      return true
    }

    return (
      user.username.toLowerCase().includes(query) ||
      user.firstName.toLowerCase().includes(query) ||
      user.lastName.toLowerCase().includes(query) ||
      user.fullName.toLowerCase().includes(query)
    )
  })

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess(null)
    setResetOutput(null)

    if (!selectedUserId) {
      setError('Please select a user')
      return
    }

    if (action === 'set-password') {
      if (newPassword !== confirmPassword) {
        setError('Passwords do not match')
        return
      }

      if (newPassword.length < 8) {
        setError('Password must be at least 8 characters long')
        return
      }
    }

    setLoading(true)

    try {
      const response = await submitAdminPasswordReset({
        userId: selectedUserId,
        action,
        ...(action === 'set-password' ? { newPassword } : {}),
      })

      if (action === 'generate-token') {
        setResetOutput({
          token: response.data.token,
          expiresAt: response.data.expiresAt,
        })
        setSuccess(
          `Reset token generated for ${response.data.user.username}. Expires at ${new Date(response.data.expiresAt || '').toLocaleString()}`,
        )
      } else {
        setSuccess(`Password successfully reset for ${response.data.user.username}`)
        setNewPassword('')
        setConfirmPassword('')
      }

      if (onRefresh) {
        onRefresh()
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    if (!navigator.clipboard) {
      return
    }

    void navigator.clipboard.writeText(text)
  }

  return (
    <div className="app-surface-card rounded-2xl p-6">
      <div className="mb-6">
        <h3 className="mb-2 flex items-center gap-3 text-lg font-semibold text-gray-900">
          <span className={getDashboardIconChipClasses('blue')}>
            <DashboardIconSlot icon={DASHBOARD_ICONS.key} size={DASHBOARD_ICON_POLICY.sizes.card} />
          </span>
          <span>Password Reset Management</span>
        </h3>
        <p className="text-sm text-gray-600">
          Generate reset tokens or directly set passwords for any user in the system.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <DashboardIconSlot icon={DASHBOARD_ICONS.reports} size={DASHBOARD_ICON_POLICY.sizes.alert} className="text-red-600" />
            <span>{error}</span>
          </div>
        ) : null}

        {success ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
            <DashboardIconSlot icon={DASHBOARD_ICONS.check} size={DASHBOARD_ICON_POLICY.sizes.alert} className="text-green-600" />
            <span>{success}</span>
          </div>
        ) : null}

        {resetOutput?.token ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="mb-2 text-sm font-medium text-blue-800">Reset Token Generated</h4>
                <div className="app-surface-inner rounded border border-blue-300 p-3">
                  <code className="break-all text-xs text-blue-900">{resetOutput.token}</code>
                </div>
                <p className="mt-2 text-xs text-blue-700">
                  Provide this token securely. It expires at{' '}
                  {resetOutput.expiresAt ? new Date(resetOutput.expiresAt).toLocaleString() : 'the configured reset window'}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(resetOutput.token || '')}
                className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
              >
                <DashboardIconSlot icon={DASHBOARD_ICONS.copy} size={14} />
                <span>Copy</span>
              </button>
            </div>
          </div>
        ) : null}

        <div>
          <label htmlFor="admin-password-reset-search" className="mb-2 block text-sm font-medium text-gray-700">
            Select User
          </label>
          <div className="relative mb-2">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              <DashboardIconSlot icon={DASHBOARD_ICONS.inspect} size={DASHBOARD_ICON_POLICY.sizes.button} />
            </div>
            <input
              id="admin-password-reset-search"
              name="userSearch"
              type="text"
              autoComplete="off"
              placeholder="Search users..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 pl-10 focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <label htmlFor="admin-password-reset-user-select" className="sr-only">
            Choose a user for password reset
          </label>
          <select
            id="admin-password-reset-user-select"
            name="selectedUserId"
            autoComplete="off"
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            required
          >
            <option value="">-- Select a user --</option>
            {filteredUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName} (@{user.username}) - {formatAdminUserTypeLabel(user.userType)}
              </option>
            ))}
          </select>
        </div>

        {selectedUser ? (
          <div className="rounded-lg bg-gray-50 p-4">
            <h4 className="mb-2 text-sm font-medium text-gray-900">Selected User</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <p><strong>Name:</strong> {selectedUser.fullName}</p>
              <p><strong>Username:</strong> @{selectedUser.username}</p>
              <p><strong>Role:</strong> {formatAdminUserTypeLabel(selectedUser.userType)}</p>
              <p><strong>Source:</strong> {formatCreationSourceLabel(selectedUser.creationSource)}</p>
              <p className="inline-flex items-center gap-2">
                <strong>Status:</strong>
                <DashboardIconSlot
                  icon={selectedUser.isActive ? DASHBOARD_ICONS.check : DASHBOARD_ICONS.close}
                  size={14}
                  className={selectedUser.isActive ? 'text-green-600' : 'text-red-600'}
                />
                <span>{selectedUser.isActive ? 'Active' : 'Inactive'}</span>
              </p>
            </div>
          </div>
        ) : null}

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Reset Method</label>
          <div className="space-y-2">
            <label htmlFor="admin-password-reset-generate-token" className="flex items-center">
              <input
                id="admin-password-reset-generate-token"
                type="radio"
                name="action"
                value="generate-token"
                checked={action === 'generate-token'}
                onChange={(event) => setAction(event.target.value as 'generate-token')}
                className="h-4 w-4 border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="ml-2 text-sm text-gray-700">Generate Reset Token (User sets their own password)</span>
            </label>
            <label htmlFor="admin-password-reset-set-password" className="flex items-center">
              <input
                id="admin-password-reset-set-password"
                type="radio"
                name="action"
                value="set-password"
                checked={action === 'set-password'}
                onChange={(event) => setAction(event.target.value as 'set-password')}
                className="h-4 w-4 border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="ml-2 text-sm text-gray-700">Set Password Directly (Admin sets the password)</span>
            </label>
          </div>
        </div>

        {action === 'set-password' ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm"
                placeholder="Enter new password (min 8 characters)"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          </div>
        ) : null}

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => {
              setSelectedUserId('')
              setNewPassword('')
              setConfirmPassword('')
              setError('')
              setSuccess(null)
              setResetOutput(null)
            }}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={loading || !selectedUserId}
            className="inline-flex items-center rounded-md border border-transparent bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (action === 'generate-token' ? 'Generating...' : 'Resetting...') : action === 'generate-token' ? 'Generate Reset Token' : 'Set New Password'}
          </button>
        </div>
      </form>

      <div className="mt-6 border-t border-gray-200 pt-6">
        <h4 className="mb-2 text-sm font-medium text-gray-900">Instructions</h4>
        <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
          <li><strong>Generate Token:</strong> Creates a secure token the user can use to reset their own password</li>
          <li><strong>Set Password:</strong> Allows you to directly set a new password for the user</li>
          <li>Both methods unlock the account if it was locked due to failed login attempts</li>
          <li>Reset tokens expire after 24 hours</li>
        </ul>
      </div>
    </div>
  )
}

export default AdminPasswordReset