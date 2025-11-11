'use client'

import { useState } from 'react'

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

  const selectedUser = users.find(u => u.id === selectedUserId)

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastName.toLowerCase().includes(searchTerm.toLowerCase())
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
      const token = localStorage.getItem('token')
      const body: any = { userId: selectedUserId, action }
      
      if (action === 'set-password') {
        body.newPassword = newPassword
      }

      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
    } catch (err) {
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
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          🔐 Password Reset Management
        </h3>
        <p className="text-sm text-gray-600">
          Generate reset tokens or directly set passwords for any user in the system.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {resetToken && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-blue-800 mb-2">
                  Reset Token Generated
                </h4>
                <div className="bg-white rounded p-3 border border-blue-300">
                  <code className="text-xs text-blue-900 break-all">{resetToken}</code>
                </div>
                <p className="mt-2 text-xs text-blue-700">
                  Provide this token to the user. They can use it at the password reset page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(resetToken)}
                className="ml-4 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select User
          </label>
          <input
            type="text"
            placeholder="Search users..."
            className="mb-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            required
          >
            <option value="">-- Select a user --</option>
            {filteredUsers.map(user => (
              <option key={user.id} value={user.id}>
                {user.firstName} {user.lastName} (@{user.username}) - {user.userType}
              </option>
            ))}
          </select>
        </div>

        {selectedUser && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Selected User</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <p><strong>Name:</strong> {selectedUser.firstName} {selectedUser.lastName}</p>
              <p><strong>Username:</strong> @{selectedUser.username}</p>
              <p><strong>Role:</strong> {selectedUser.userType}</p>
              <p><strong>Status:</strong> {selectedUser.isActive ? '✅ Active' : '❌ Inactive'}</p>
            </div>
          </div>
        )}

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

        {action === 'set-password' && (
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
        )}

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
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
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
          <p className="text-xs text-blue-800">
            <strong>ℹ️ Note:</strong> Users can now reset their passwords independently using OTP codes sent to their registered email addresses. 
            This admin panel is useful for emergency password resets or when users don't have access to their email.
          </p>
        </div>
      </div>
    </div>
  )
}

export default AdminPasswordReset
