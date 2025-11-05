'use client';

import { useState, useEffect } from 'react';
import ResponsiveTable, { StatusBadge, ActionButton } from './ResponsiveTable';
import { PageSection, StatsGrid, StatCard } from './PageWrapper';
import AdminPasswordReset from './AdminPasswordReset';

// Local enum definition to avoid Prisma import issues
enum UserType {
  ADMIN = 'ADMIN',
  DATA_ENCODER = 'DATA_ENCODER',
  ENFORCER = 'ENFORCER',
  PUBLIC = 'PUBLIC'
}

interface AdminUser {
  id?: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  userType: UserType;
  department?: string;
  position?: string;
  employeeId?: string;
  notes?: string;
}

interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  userType: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  governmentId?: string;
  barangayResidence?: string;
  reasonForRegistration?: string;
}

export default function AdminUserManagement() {
  const [activeTab, setActiveTab] = useState<'create' | 'pending' | 'users' | 'password-reset'>('create');
  const [users, setUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const [newUser, setNewUser] = useState<AdminUser>({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    userType: UserType.DATA_ENCODER,
    department: '',
    position: '',
    employeeId: '',
    notes: ''
  });

  useEffect(() => {
    if (activeTab === 'users' || activeTab === 'password-reset') {
      fetchUsers();
    } else if (activeTab === 'pending') {
      fetchPendingUsers();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/users/pending', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setPendingUsers(data.users);
      }
    } catch (error) {
      console.error('Error fetching pending users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      });

      const data = await response.json();
      
      if (data.success) {
        alert('User created successfully!');
        setNewUser({
          firstName: '',
          lastName: '',
          phoneNumber: '',
          userType: UserType.DATA_ENCODER,
          department: '',
          position: '',
          employeeId: '',
          notes: ''
        });
        if (activeTab === 'users') {
          fetchUsers();
        }
      } else {
        alert(data.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyUser = async (userId: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/admin/users/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, action, reason }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`User ${action}d successfully!`);
        fetchPendingUsers();
        if (activeTab === 'users') {
          fetchUsers();
        }
      } else {
        alert(data.error || `Failed to ${action} user`);
      }
    } catch (error) {
      console.error(`Error ${action}ing user:`, error);
      alert(`Failed to ${action} user`);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/admin/users/toggle-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, isActive: !currentStatus }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully!`);
        fetchUsers();
      } else {
        alert(data.error || 'Failed to update user status');
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Failed to update user status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage official accounts and verify public users</p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'create', label: 'Create Official User', icon: '➕' },
              { key: 'pending', label: 'Pending Verifications', icon: '⏳' },
              { key: 'users', label: 'All Users', icon: '👥' },
              { key: 'password-reset', label: 'Password Reset', icon: '🔐' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Create Official User Tab */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateUser} className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="text-blue-600 text-xl">ℹ️</span>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      Creating Official User Account
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>Only administrators can create Enforcer and Data Encoder accounts. These users will have immediate access upon creation.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={newUser.phoneNumber}
                    onChange={(e) => setNewUser({ ...newUser, phoneNumber: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    User Role *
                  </label>
                  <select
                    required
                    value={newUser.userType}
                    onChange={(e) => setNewUser({ ...newUser, userType: e.target.value as UserType })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value={UserType.DATA_ENCODER}>Data Encoder</option>
                    <option value={UserType.ENFORCER}>Enforcer</option>
                    <option value={UserType.ADMIN}>Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={newUser.employeeId}
                    onChange={(e) => setNewUser({ ...newUser, employeeId: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Department
                  </label>
                  <input
                    type="text"
                    value={newUser.department}
                    onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                    placeholder="e.g., Traffic Management, Transport Office"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Position
                  </label>
                  <input
                    type="text"
                    value={newUser.position}
                    onChange={(e) => setNewUser({ ...newUser, position: e.target.value })}
                    placeholder="e.g., Traffic Enforcer, Data Entry Clerk"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  value={newUser.notes}
                  onChange={(e) => setNewUser({ ...newUser, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes about this user account..."
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

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
          )}

          {/* Pending Verifications Tab */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading pending users...</p>
                </div>
              ) : pendingUsers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No pending user verifications</p>
                </div>
              ) : (
                pendingUsers.map((user) => (
                  <div key={user.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </h3>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Government ID:</span> {user.governmentId || 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">Barangay:</span> {user.barangayResidence || 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">Registered:</span> {new Date(user.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        {user.reasonForRegistration && (
                          <div className="mt-2">
                            <span className="font-medium text-sm">Reason:</span>
                            <p className="text-sm text-gray-600 mt-1">{user.reasonForRegistration}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleVerifyUser(user.id, 'approve')}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Reason for rejection:');
                            if (reason) {
                              handleVerifyUser(user.id, 'reject', reason);
                            }
                          }}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        >
                          ✗ Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* All Users Tab */}
          {activeTab === 'users' && (
            <ResponsiveTable
              columns={[
                {
                  key: 'user',
                  label: 'User',
                  mobileLabel: 'User Info',
                  render: (_, user) => (
                    <div>
                      <div className="font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  )
                },
                {
                  key: 'userType',
                  label: 'Role',
                  render: (userType) => (
                    <StatusBadge 
                      status={userType.replace('_', ' ')} 
                      className={
                        userType === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                        userType === 'ENFORCER' ? 'bg-red-100 text-red-800' :
                        userType === 'DATA_ENCODER' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }
                    />
                  )
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (_, user) => (
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
                  )
                },
                {
                  key: 'createdAt',
                  label: 'Created',
                  mobileLabel: 'Created Date',
                  render: (createdAt) => new Date(createdAt).toLocaleDateString()
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (_, user) => (
                    <ActionButton
                      onClick={() => toggleUserStatus(user.id, user.isActive)}
                      variant={user.isActive ? 'danger' : 'primary'}
                    >
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </ActionButton>
                  )
                }
              ]}
              data={users}
              loading={loading}
              emptyMessage="No users found"
              className="bg-white rounded-lg shadow"
            />
          )}

          {/* Password Reset Tab */}
          {activeTab === 'password-reset' && (
            <>
              <AdminPasswordReset 
                users={users} 
                onRefresh={fetchUsers}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}