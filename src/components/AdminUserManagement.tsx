'use client'

import { useEffect, useState } from 'react'

import type { AdminUserDto } from '@/lib/admin/user-management-contract'

import AdminPasswordReset from './AdminPasswordReset'
import { fetchAllAdminUsers, updateAdminUserStatus } from './admin-user-management/api'
import AdminUserCreateForm from './admin-user-management/AdminUserCreateForm'
import AdminUserDetailModal from './admin-user-management/AdminUserDetailModal'
import AdminUsersPanel from './admin-user-management/AdminUsersPanel'
import AdminUserTabs from './admin-user-management/AdminUserTabs'

type AdminTab = 'users' | 'create' | 'password-reset'

export default function AdminUserManagement() {
  const [activeTab, setActiveTab] = useState<AdminTab>('users')
  const [users, setUsers] = useState<AdminUserDto[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminUserDto | null>(null)
  const [statusUpdatingUserId, setStatusUpdatingUserId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    void loadUsers()
  }, [])

  async function loadUsers() {
    try {
      setUsersLoading(true)
      const result = await fetchAllAdminUsers()
      setUsers(result.users)
    } catch (loadError) {
      setNotice({
        tone: 'error',
        text: loadError instanceof Error ? loadError.message : 'Failed to load user accounts',
      })
    } finally {
      setUsersLoading(false)
    }
  }

  function handleUserCreated(user: AdminUserDto) {
    setUsers((current) => [user, ...current.filter((existingUser) => existingUser.id !== user.id)])
    setNotice({
      tone: 'success',
      text: `${user.fullName} is now available in the user directory.`,
    })
  }

  async function handleToggleUserStatus(user: AdminUserDto) {
    try {
      setStatusUpdatingUserId(user.id)
      const response = await updateAdminUserStatus(user.id, !user.isActive)

      setUsers((current) =>
        current.map((existingUser) =>
          existingUser.id === response.data.userId ? { ...existingUser, isActive: response.data.isActive } : existingUser,
        ),
      )

      setSelectedUser((current) =>
        current && current.id === response.data.userId ? { ...current, isActive: response.data.isActive } : current,
      )

      setNotice({
        tone: 'success',
        text: response.message || `Account ${response.data.isActive ? 'activated' : 'deactivated'} successfully.`,
      })
    } catch (statusError) {
      setNotice({
        tone: 'error',
        text: statusError instanceof Error ? statusError.message : 'Failed to update account status',
      })
    } finally {
      setStatusUpdatingUserId(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="app-surface-card rounded-2xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-gray-600">
            Manage official accounts, self-registered users, status changes, and password resets
          </p>
        </div>

        <AdminUserTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="p-6">
          {notice ? (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
                notice.tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span>{notice.text}</span>
                <button type="button" onClick={() => setNotice(null)} className="font-medium">
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          {activeTab === 'users' ? (
            <AdminUsersPanel
              users={users}
              loading={usersLoading}
              onOpenUser={setSelectedUser}
              onToggleStatus={handleToggleUserStatus}
              statusUpdatingUserId={statusUpdatingUserId}
            />
          ) : null}
          {activeTab === 'create' ? <AdminUserCreateForm onUserCreated={handleUserCreated} /> : null}
          {activeTab === 'password-reset' ? <AdminPasswordReset users={users} onRefresh={loadUsers} /> : null}
        </div>
      </div>

      <AdminUserDetailModal
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
        onToggleStatus={handleToggleUserStatus}
        statusUpdating={selectedUser ? statusUpdatingUserId === selectedUser.id : false}
      />
    </div>
  )
}
