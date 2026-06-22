export type UserRole = 'ADMIN' | 'DATA_ENCODER' | 'ENFORCER' | 'DRIVER' | 'PUBLIC';

export interface SessionUser {
  id: string;
  username: string;
  userType: UserRole;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isVerified: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: SessionUser;
  token: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  dateOfBirth: string | null;
  governmentId: string;
  idType: string;
  barangayResidence: string;
  username: string;
  password: string;
  userType: UserRole;
  privacyNoticeAcknowledged: boolean;
  privacyNoticeVersion: string;
}

export interface RegisterResponse {
  user?: SessionUser;
  token?: string;
  message?: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
