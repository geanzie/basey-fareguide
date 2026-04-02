import type { UserRole } from "./common";

export interface SessionUserDto {
  id: string;
  username: string;
  userType: UserRole;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  phoneNumber: string | null;
  governmentId: string | null;
  idType: string | null;
  employeeId?: string | null;
  isActive: boolean;
  isVerified: boolean;
}

export interface UserProfileDto extends SessionUserDto {
  email: string | null;
  barangayResidence: string | null;
  createdAt: string;
}

export interface UserProfileResponseDto {
  user: UserProfileDto;
}
