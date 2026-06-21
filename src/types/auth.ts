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

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
