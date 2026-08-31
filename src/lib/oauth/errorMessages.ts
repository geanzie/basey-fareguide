/**
 * Messages for the `?error=` codes the OAuth callback redirects with.
 * Kept free of server-only imports so both pages and client components can use it.
 */
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: 'Sign-in was cancelled. You can try again or use your username and password.',
  oauth_state: 'That sign-in link expired. Please try signing in again.',
  oauth_rate_limited: 'Too many sign-in attempts. Please wait a few minutes and try again.',
  oauth_no_email:
    'Your account did not share an email address with us. Please register with the form below.',
  oauth_unverified_email:
    'That email address is not verified with your provider, so we cannot link it to your existing account. Please log in with your password.',
  oauth_staff_account:
    'This email belongs to a staff account. Please sign in with your username and password.',
  oauth_inactive: 'Your account is not yet approved. Please wait for admin approval.',
  oauth_failed: 'Sign-in failed. Please try again or use your username and password.',
  oauth_ticket_expired: 'Your sign-in session expired. Please sign in again.',
  // The app asked us to return to a deep link this server will not honour.
  oauth_bad_redirect:
    'Social sign-in is not available on this server. Please sign in with your username and password.',
}

/** Resolves a code to a message; non-OAuth values pass through unchanged. */
export function resolveAuthErrorMessage(value: string): string {
  return OAUTH_ERROR_MESSAGES[value] ?? value
}
