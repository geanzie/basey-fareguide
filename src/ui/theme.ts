/**
 * Web port of the shared design tokens in mobile/src/ui/theme.ts.
 * Color/spacing/radius/shadow tokens live in tailwind.config.js; this module
 * holds the runtime pieces: the status -> tone map and the hex values needed
 * for SVG strokes and icon chips where Tailwind classes can't reach.
 * Keep the STATUS_TONES keys in sync with mobile's STATUS_COLORS.
 */

export type Tone = 'success' | 'danger' | 'warning' | 'info' | 'purple' | 'muted'

/**
 * Hex values for translucent icon chips (StatTile) only.
 * Everything else must use static Tailwind classes so purge keeps them.
 */
export const TONE_HEX: Record<Tone, string> = {
  success: '#16a34a',
  danger: '#dc2626',
  warning: '#f59e0b',
  info: '#3b82f6',
  purple: '#8b5cf6',
  muted: '#64748b',
}

/** Static class strings per tone — safe for Tailwind purge. */
export const TONE_BADGE_CLASSES: Record<Tone, string> = {
  success: 'bg-primary/10 text-primary-dark',
  danger: 'bg-danger/10 text-danger',
  warning: 'bg-warning/10 text-warning-dark',
  info: 'bg-info/10 text-info',
  purple: 'bg-brandPurple/10 text-brandPurple',
  muted: 'bg-ink-muted/10 text-ink-muted',
}

export const TONE_TEXT_CLASSES: Record<Tone, string> = {
  success: 'text-primary',
  danger: 'text-danger',
  warning: 'text-warning-dark',
  info: 'text-info',
  purple: 'text-brandPurple',
  muted: 'text-ink-muted',
}

/**
 * Single source of truth for status -> tone. Covers permit, incident,
 * payment, scan-disposition and vehicle states. Falls back to muted.
 */
const STATUS_TONES: Record<string, Tone> = {
  // Permit / generic
  ACTIVE: 'success',
  EXPIRED: 'danger',
  SUSPENDED: 'warning',
  REVOKED: 'muted',
  // Incident
  PENDING: 'warning',
  INVESTIGATING: 'info',
  REFERRED_FOR_FRANCHISE_ACTION: 'warning',
  TICKET_ISSUED: 'purple',
  RESOLVED: 'success',
  DISMISSED: 'muted',
  // Ticket payment
  UNPAID: 'danger',
  PAID: 'success',
  WAIVED: 'muted',
  // Scan disposition
  CLEAR: 'success',
  FLAGGED: 'warning',
  BLOCKED: 'danger',
  NOT_FOUND: 'muted',
  // Vehicle
  INACTIVE: 'muted',
}

export function statusTone(key?: string | null): Tone {
  if (!key) return 'muted'
  return STATUS_TONES[key.toUpperCase()] ?? 'muted'
}
