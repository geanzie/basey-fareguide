import type { PaginationMetadata } from '@/lib/api/pagination'

export type AdminUserType = 'ADMIN' | 'DATA_ENCODER' | 'ENFORCER' | 'DRIVER' | 'PUBLIC'
export type AdminUserCreationSource = 'ADMIN_CREATED' | 'SELF_REGISTERED'

export interface AdminAssignedVehicleDto {
  vehicleId: string
  plateNumber: string
  vehicleType: string
  permitPlateNumber: string | null
}

export interface AdminUserDto {
  id: string
  username: string
  firstName: string
  lastName: string
  fullName: string
  userType: AdminUserType
  creationSource: AdminUserCreationSource
  isActive: boolean
  createdAt: string
  phoneNumber: string | null
  governmentId: string | null
  barangayResidence: string | null
  reasonForRegistration: string | null
  assignedVehicle: AdminAssignedVehicleDto | null
}

export interface AdminUsersSummaryDto {
  total: number
  active: number
  inactive: number
  adminCreated: number
  selfRegistered: number
  byType: Partial<Record<AdminUserType, number>>
}

export interface AdminUsersListData {
  users: AdminUserDto[]
  pagination: PaginationMetadata
  summary: AdminUsersSummaryDto
}

export interface AdminDriverOptionDto {
  vehicleId: string
  driverName: string
  driverLicense: string | null
  username: string
  plateNumber: string
  vehicleType: string
  permitPlateNumber: string | null
}

export interface AdminDriverOptionsData {
  drivers: AdminDriverOptionDto[]
}

export interface AdminUserCreateData {
  user: AdminUserDto
  tempPassword: string | null
}

export interface AdminToggleUserStatusData {
  userId: string
  isActive: boolean
}

export type AdminPasswordResetAction = 'generate-token' | 'set-password'

export interface AdminPasswordResetResultUser {
  id: string
  username: string
  firstName: string
  lastName: string
  fullName: string
  userType: AdminUserType
  isActive: boolean
}

export interface AdminPasswordResetData {
  action: AdminPasswordResetAction
  token: string | null
  expiresAt: string | null
  user: AdminPasswordResetResultUser
}

export interface AdminApiSuccess<T> {
  success: true
  data: T
  message?: string
}

export interface AdminApiFailure {
  success: false
  error: string
}

interface AdminAssignedVehicleSource {
  id: string
  plateNumber: string
  vehicleType: string
  permit?: {
    permitPlateNumber: string | null
  } | null
}

interface AdminUserSource {
  id: string
  username: string
  firstName: string
  lastName: string
  userType: string
  isActive: boolean
  createdAt: string | Date
  phoneNumber?: string | null
  governmentId?: string | null
  barangayResidence?: string | null
  reasonForRegistration?: string | null
  assignedVehicle?: AdminAssignedVehicleSource | null
}

export function buildAdminUserFullName(firstName: string, lastName: string): string {
  return [firstName, lastName].filter(Boolean).join(' ').trim()
}

export function getAdminUserCreationSource(userType: string): AdminUserCreationSource {
  return userType === 'PUBLIC' ? 'SELF_REGISTERED' : 'ADMIN_CREATED'
}

export function toAdminUserDto(user: AdminUserSource): AdminUserDto {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: buildAdminUserFullName(user.firstName, user.lastName),
    userType: user.userType as AdminUserType,
    creationSource: getAdminUserCreationSource(user.userType),
    isActive: user.isActive,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
    phoneNumber: user.phoneNumber ?? null,
    governmentId: user.governmentId ?? null,
    barangayResidence: user.barangayResidence ?? null,
    reasonForRegistration: user.reasonForRegistration ?? null,
    assignedVehicle: user.assignedVehicle
      ? {
          vehicleId: user.assignedVehicle.id,
          plateNumber: user.assignedVehicle.plateNumber,
          vehicleType: user.assignedVehicle.vehicleType,
          permitPlateNumber: user.assignedVehicle.permit?.permitPlateNumber ?? null,
        }
      : null,
  }
}
