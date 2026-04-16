import type { AdminUserCreationSource, AdminUserType } from '@/lib/admin/user-management-contract'

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

export function formatAdminUserTypeLabel(userType: AdminUserType | string) {
  return userType
    .split('_')
    .map(capitalize)
    .join(' ')
}

export function formatCreationSourceLabel(source: AdminUserCreationSource) {
  return source === 'ADMIN_CREATED' ? 'Admin created' : 'Self-registered'
}

export function formatVehicleTypeLabel(vehicleType: string) {
  return vehicleType
    .split('_')
    .map(capitalize)
    .join(' ')
}

export function getRoleBadgeClass(userType: AdminUserType | string) {
  switch (userType) {
    case 'ADMIN':
      return 'bg-slate-900 text-white'
    case 'DATA_ENCODER':
      return 'bg-blue-100 text-blue-800'
    case 'ENFORCER':
      return 'bg-amber-100 text-amber-800'
    case 'DRIVER':
      return 'bg-emerald-100 text-emerald-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function getCreationSourceBadgeClass(source: AdminUserCreationSource) {
  return source === 'ADMIN_CREATED' ? 'bg-slate-100 text-slate-700' : 'bg-cyan-100 text-cyan-800'
}
