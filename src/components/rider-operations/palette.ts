import type { RiderFareGroup } from '@/lib/contracts'
import { TONE_HEX } from '@/ui/theme'

/**
 * Fare-group colors for the rider charts, from the palette the enforcer and
 * encoder dashboards share (see `enforcer-operations/palette.ts`). Discounted
 * fares take the purple the app already uses for discount cards.
 */
export const FARE_HEX: Record<RiderFareGroup, string> = {
  FULL: '#2a78d6',
  DISCOUNTED: '#4a3aa7',
}

export const SAVINGS_HEX = { SAVED: TONE_HEX.purple }

const whole = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 })
const cents = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** ₱15 for whole pesos, ₱13.60 when there are centavos (discounted fares). */
export function formatPesos(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return `₱${Number.isInteger(rounded) ? whole.format(rounded) : cents.format(rounded)}`
}

const km = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 1 })

export function formatKm(value: number): string {
  return `${km.format(value)} km`
}
