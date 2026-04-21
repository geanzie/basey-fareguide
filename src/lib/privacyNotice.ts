/**
 * Canonical current Privacy Notice version identifier.
 *
 * This is the single source of truth for the active notice version.
 * Import this constant in:
 *  - the registration form (sent in request payload)
 *  - the registration API route (validated and persisted server-side)
 *  - the privacy policy page (displayed to users)
 *
 * Update this value whenever the Privacy Notice is materially revised.
 * A version mismatch between the client payload and this constant will
 * cause the registration API to reject the request.
 */
export const CURRENT_PRIVACY_NOTICE_VERSION = "2026-04-21";
