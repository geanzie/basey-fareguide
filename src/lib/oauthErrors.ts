/**
 * Messages for the `oauth_*` codes the server deep-links back with.
 *
 * Hand-mirrored from `../../frontend/src/lib/oauth/errorMessages.ts` so both
 * clients say the same thing; the wording there is the source of truth.
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
  // Reached when the server will not return to this build's deep link — Expo
  // Go against a deployed server, most often. The app is fine; the server is
  // the one refusing, so the wording must not send the user off to update it.
  oauth_bad_redirect:
    'Social sign-in is not available on this server. Please sign in with your username and password.',
};

export function resolveOAuthErrorMessage(code: string): string {
  return OAUTH_ERROR_MESSAGES[code] ?? OAUTH_ERROR_MESSAGES.oauth_failed;
}
