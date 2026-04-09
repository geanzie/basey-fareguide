import type { SessionUserDto, UserProfileDto } from "@/lib/contracts";

function toDateOnly(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().split("T")[0];
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function serializeSessionUser(user: {
  id: string;
  username: string;
  userType: SessionUserDto["userType"];
  firstName: string;
  lastName: string;
  isActive: boolean;
  isVerified: boolean;
}): SessionUserDto {
  return {
    id: user.id,
    username: user.username,
    userType: user.userType,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    isVerified: user.isVerified,
  };
}

export function serializeUserProfile(user: {
  id: string;
  username: string;
  userType: UserProfileDto["userType"];
  firstName: string;
  lastName: string;
  email?: string | null;
  phoneNumber?: string | null;
  dateOfBirth?: Date | string | null;
  governmentId?: string | null;
  idType?: string | null;
  barangayResidence?: string | null;
  employeeId?: string | null;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date | string;
}): UserProfileDto {
  return {
    ...serializeSessionUser(user),
    email: user.email ?? null,
    phoneNumber: user.phoneNumber ?? null,
    dateOfBirth: toDateOnly(user.dateOfBirth),
    governmentId: user.governmentId ?? null,
    idType: user.idType ?? null,
    barangayResidence: user.barangayResidence ?? null,
    employeeId: user.employeeId ?? null,
    createdAt: toIsoString(user.createdAt) ?? new Date(0).toISOString(),
  };
}
