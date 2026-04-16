'use client'

import { ActionButton, StatusBadge } from '@/components/ResponsiveTable'
import type { AdminUserDto } from '@/lib/admin/user-management-contract'

import {
  formatAdminUserTypeLabel,
  formatCreationSourceLabel,
  formatVehicleTypeLabel,
  getCreationSourceBadgeClass,
  getRoleBadgeClass,
} from './display'

interface AdminUserDetailModalProps {
  user: AdminUserDto | null
  onClose: () => void
  onToggleStatus: (user: AdminUserDto) => void
  statusUpdating: boolean
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-gray-900">{value}</div>
    </div>
  )
}

export default function AdminUserDetailModal({
  user,
  onClose,
  onToggleStatus,
  statusUpdating,
}: AdminUserDetailModalProps) {
  if (!user) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">User Details</h3>
            <p className="mt-1 text-sm text-gray-600">Review account status, role, source, and linked driver context.</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-medium text-gray-500 hover:text-gray-700">
            Close
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="text-xl font-semibold text-gray-900">{user.fullName}</h4>
                <p className="mt-1 text-sm text-gray-600">@{user.username}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={formatAdminUserTypeLabel(user.userType)} className={getRoleBadgeClass(user.userType)} />
                <StatusBadge
                  status={formatCreationSourceLabel(user.creationSource)}
                  className={getCreationSourceBadgeClass(user.creationSource)}
                />
                <StatusBadge
                  status={user.isActive ? 'Active' : 'Inactive'}
                  className={user.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <DetailField label="Created" value={new Date(user.createdAt).toLocaleString()} />
              <DetailField label="Creation Source" value={formatCreationSourceLabel(user.creationSource)} />
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-gray-900">Contact and Identity</h4>
            <div className="mt-3 grid grid-cols-1 gap-4 rounded-2xl border border-gray-200 bg-white p-5 md:grid-cols-2">
              <DetailField label="Phone Number" value={user.phoneNumber || 'Not provided'} />
              <DetailField label="Government ID" value={user.governmentId || 'Not provided'} />
              <DetailField label="Barangay" value={user.barangayResidence || 'Not provided'} />
              <DetailField label="Registration Reason" value={user.reasonForRegistration || 'Not provided'} />
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-gray-900">Driver Link</h4>
            <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-5">
              {user.assignedVehicle ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <DetailField label="Plate Number" value={user.assignedVehicle.plateNumber} />
                  <DetailField label="Vehicle Type" value={formatVehicleTypeLabel(user.assignedVehicle.vehicleType)} />
                  <DetailField label="Permit Plate" value={user.assignedVehicle.permitPlateNumber || 'Not linked'} />
                  <DetailField label="Vehicle ID" value={user.assignedVehicle.vehicleId} />
                </div>
              ) : (
                <p className="text-sm text-gray-600">This account is not linked to a driver vehicle assignment.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-200 px-6 py-4 sm:flex-row sm:justify-end">
          <ActionButton onClick={onClose} variant="secondary" size="md">
            Close
          </ActionButton>
          <ActionButton
            onClick={() => onToggleStatus(user)}
            variant={user.isActive ? 'danger' : 'primary'}
            size="md"
            disabled={statusUpdating}
          >
            {statusUpdating ? 'Updating...' : user.isActive ? 'Deactivate Account' : 'Activate Account'}
          </ActionButton>
        </div>
      </div>
    </div>
  )
}
