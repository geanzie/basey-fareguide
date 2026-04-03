'use client'

import { useState } from 'react'

import LoadingSpinner from '@/components/LoadingSpinner'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
} from '@/components/dashboardIcons'

interface User {
  id: string
  username: string
  firstName: string
  lastName: string
  userType: string
  isActive: boolean
}

interface AdminPasswordResetProps {
  users: User[]
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
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const selectedUser = users.find((u) => u.id === selectedUserId)

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastName.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(null)
    setResetToken(null)

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
      const body: { userId: string; action: string; newPassword?: string } = { userId: selectedUserId, action }

      if (action === 'set-password') {
        body.newPassword = newPassword
      }

      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (response.ok) {
        if (action === 'generate-token') {
          setResetToken(data.token)
          setSuccess(`Reset token generated for ${data.user.username}. Token expires at ${new Date(data.expiresAt).toLocaleString()}`)
        } else {
          setSuccess(`Password successfully reset for ${data.user.username}`)
          setNewPassword('')
          setConfirmPassword('')
        }

        if (onRefresh) {
          onRefresh()
        }
      } else {
        setError(data.message || 'Operation failed')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Token copied to clipboard!')
  }

  return (
    <div className="app-surface-card rounded-2xl p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-3">
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
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <DashboardIconSlot icon={DASHBOARD_ICONS.reports} size={DASHBOARD_ICON_POLICY.sizes.alert} className="text-red-600" />
            <span>{error}</span>
          </div>
        ) : null}

        {success ? (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <DashboardIconSlot icon={DASHBOARD_ICONS.check} size={DASHBOARD_ICON_POLICY.sizes.alert} className="text-green-600" />
            <span>{success}</span>
          </div>
        ) : null}

        {resetToken ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-blue-800 mb-2">
                  Reset Token Generated
                </h4>
                <div className="app-surface-inner rounded p-3 border border-blue-300">
                  <code className="text-xs text-blue-900 break-all">{resetToken}</code>
                </div>
                <p className="mt-2 text-xs text-blue-700">
                  Provide this token to the user. They can use it at the password reset page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(resetToken)}
                className="ml-4 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 inline-flex items-center gap-2"
              >
                <DashboardIconSlot icon={DASHBOARD_ICONS.copy} size={14} />
                <span>Copy</span>
              </button>
            </div>
          </div>
        ) : null}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select User
          </label>
          <div className="relative mb-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <DashboardIconSlot icon={DASHBOARD_ICONS.inspect} size={DASHBOARD_ICON_POLICY.sizes.button} />
            </div>
            <input
              type="text"
              placeholder="Search users..."
              className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            required
          >
            <option value="">-- Select a user --</option>
            {filteredUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.firstName} {user.lastName} (@{user.username}) - {user.userType}
              </option>
            ))}
          </select>
        </div>

        {selectedUser ? (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Selected User</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <p><strong>Name:</strong> {selectedUser.firstName} {selectedUser.lastName}</p>
              <p><strong>Username:</strong> @{selectedUser.username}</p>
              <p><strong>Role:</strong> {selectedUser.userType}</p>
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reset Method
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                name="action"
                value="generate-token"
                checked={action === 'generate-token'}
                onChange={(e) => setAction(e.target.value as 'generate-token')}
                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">
                Generate Reset Token (User sets their own password)
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="action"
                value="set-password"
                checked={action === 'set-password'}
                onChange={(e) => setAction(e.target.value as 'set-password')}
                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">
                Set Password Directly (Admin sets the password)
              </span>
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
                type="password"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                placeholder="Enter new password (min 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              setResetToken(null)
            }}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={loading || !selectedUserId}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
          >
            {loading ? (
              <>
                <LoadingSpinner size={20} className="mr-3 text-white" />
                Processing...
              </>
            ) : action === 'generate-token' ? (
              'Generate Reset Token'
            ) : (
              'Set New Password'
            )}
          </button>
        </div>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Instructions</h4>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li><strong>Generate Token:</strong> Creates a secure token the user can use to reset their own password</li>
          <li><strong>Set Password:</strong> Allows you to directly set a new password for the user</li>
          <li>Both methods will unlock the account if it was locked due to failed login attempts</li>
          <li>Reset tokens expire after 24 hours</li>
        </ul>

        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800 inline-flex items-start gap-2">
            <DashboardIconSlot icon={DASHBOARD_ICONS.info} size={14} className="mt-0.5" />
            <span>
              <strong>Note:</strong> Users can now reset their passwords independently using OTP codes sent to their registered email addresses.
              This admin panel is useful for emergency password resets or when users do not have access to their email.
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default AdminPasswordReset
