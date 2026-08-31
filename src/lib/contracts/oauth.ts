import type { SessionUserDto } from "./session";

/** A social provider this deployment has credentials configured for. */
export interface OAuthProviderDto {
  slug: string;
  label: string;
}

export interface OAuthProvidersResponseDto {
  providers: OAuthProviderDto[];
}

/** Body of POST /api/auth/oauth/native/exchange. */
export interface OAuthNativeExchangeRequestDto {
  /** The short-lived handoff ticket the OAuth callback deep-linked back with. */
  ticket: string;
}

/** Body of POST /api/auth/oauth/complete. */
export interface OAuthCompleteRequestDto {
  phoneNumber: string;
  dateOfBirth: string | null;
  barangayResidence: string | null;
  idType: string | null;
  governmentId: string | null;
  privacyNoticeAcknowledged: boolean;
  privacyNoticeVersion: string;
  /**
   * Native clients only. The browser flow carries the sign-up ticket in an
   * httpOnly cookie; the app has no cookie jar and posts it here instead.
   */
  signupTicket?: string;
}

/**
 * What both token-returning OAuth endpoints answer with — the same shape as
 * /api/auth/login, so a native client can consume either interchangeably.
 */
export interface OAuthSessionResponseDto {
  user: SessionUserDto;
  token: string;
}
