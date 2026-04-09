import type { UserRole } from "./common";

export interface SessionUserDto {
  id: string;
  username: string;
  userType: UserRole;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isVerified: boolean;
}

export interface SessionResponseDto {
  user: SessionUserDto;
}

export interface UserProfileDto extends SessionUserDto {
  email: string | null;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  governmentId: string | null;
  idType: string | null;
  barangayResidence: string | null;
  employeeId?: string | null;
  createdAt: string;
}

export interface UserProfileResponseDto {
  user: UserProfileDto;
}
