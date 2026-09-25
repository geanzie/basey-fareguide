import type { EncoderActivityGroup } from '@/lib/contracts'

/**
 * Activity-group colors for the encoder charts. The same four hues as the
 * enforcer's violation groups (see `enforcer-operations/palette.ts`, validated
 * for color-vision deficiency), so the two dashboards share one palette.
 * Aqua is under 3:1 on white; every place it appears also carries a label.
 */
export const ACTIVITY_HEX: Record<EncoderActivityGroup, string> = {
  PAYMENTS: '#eb6834',
  PERMITS: '#2a78d6',
  STICKERS: '#4a3aa7',
  REGISTRATIONS: '#1baf7a',
}

const pesos = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 })

export function formatPesos(value: number): string {
  return `₱${pesos.format(value)}`
}
