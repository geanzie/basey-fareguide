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
  /** Present on a 429 only: seconds until the caller may retry. */
  retryAfter?: number;
}

/**
 * Social sign-in. Mirrors `frontend/src/lib/contracts/oauth.ts` by hand, like
 * the rest of this directory — change one, change the other.
 */
export interface OAuthProvider {
  slug: string;
  label: string;
}

export interface OAuthProvidersResponse {
  providers: OAuthProvider[];
  /**
   * Whether the deep link sent as `?redirect=` would be honoured by /start.
   * Absent on servers predating the check.
   */
  redirectSupported?: boolean;
}

/** The details Google cannot supply, collected on the finish-signup screen. */
export interface SocialSignupFields {
  phoneNumber: string;
  dateOfBirth: string | null;
  barangayResidence: string | null;
  idType: string | null;
  governmentId: string | null;
  privacyNoticeAcknowledged: boolean;
  privacyNoticeVersion: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
