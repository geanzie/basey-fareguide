/**
 * Shared design tokens for the mobile app.
 *
 * Consolidates the colors that were previously copy-pasted as inline hex
 * literals across every screen (STATUS_COLORS / PAYMENT_STATUS_COLORS /
 * DISPOSITION_CONFIG, card/badge/button styles). Import from here instead of
 * hardcoding values so the look stays consistent.
 */

export const colors = {
  primary: '#16a34a',
  primaryDark: '#15803d',
  danger: '#dc2626',
  dangerSoftBg: '#fef2f2',
  dangerSoftBorder: '#fecaca',
  warning: '#f59e0b',
  warningDark: '#b45309',
  info: '#3b82f6',
  purple: '#8b5cf6',

  // Text
  textStrong: '#0f172a',
  textBody: '#374151',
  textMuted: '#64748b',
  textFaint: '#94a3b8',

  // Surfaces
  bg: '#f1f5f9',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  border: '#e2e8f0',
  onPrimary: '#ffffff',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  pill: 20,
} as const;

export const text = {
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.textStrong },
  heading: { fontSize: 17, fontWeight: '700' as const, color: colors.textStrong },
  body: { fontSize: 14, color: colors.textBody },
  meta: { fontSize: 12, color: colors.textFaint },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.textBody },
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  raised: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;

/**
 * Single source of truth for status → color. Covers permit, incident,
 * payment, scan-disposition and vehicle states. Falls back to a neutral slate.
 */
const STATUS_COLORS: Record<string, string> = {
  // Permit / generic
  ACTIVE: colors.primary,
  EXPIRED: colors.danger,
  SUSPENDED: colors.warning,
  REVOKED: colors.textMuted,
  // Incident
  PENDING: colors.warning,
  INVESTIGATING: colors.info,
  TICKET_ISSUED: colors.purple,
  RESOLVED: colors.primary,
  DISMISSED: colors.textMuted,
  // Ticket payment
  UNPAID: colors.danger,
  PAID: colors.primary,
  WAIVED: colors.textMuted,
  // Scan disposition
  CLEAR: colors.primaryDark,
  FLAGGED: colors.warningDark,
  BLOCKED: colors.danger,
  NOT_FOUND: colors.textMuted,
  // Vehicle
  INACTIVE: colors.textMuted,
};

export function statusColor(key?: string | null): string {
  if (!key) return colors.textMuted;
  return STATUS_COLORS[key.toUpperCase()] ?? colors.textMuted;
}
