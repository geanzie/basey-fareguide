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

/**
 * The rider dashboard's one figure style and one chip style. Every number on
 * the page reads at the same size and weight; emphasis comes from the chip's
 * contour and tint, never from a bigger font.
 */
export const FIGURE = 'font-brand font-bold tabular-nums text-ink-strong'

export type ChipTone = 'fare' | 'discount' | 'open' | 'closed' | 'neutral'

const CHIP_TONES: Record<ChipTone, string> = {
  fare: 'border-primary/35 bg-surface-tint text-primary-dark',
  discount: 'border-brandPurple/35 bg-brandPurple/5 text-brandPurple',
  open: 'border-warning/45 bg-warning/5 text-warning-dark',
  closed: 'border-primary/35 bg-surface-tint text-primary-dark',
  neutral: 'border-surface-border bg-surface-alt text-ink-muted',
}

export function chipClass(tone: ChipTone): string {
  return `inline-flex min-w-[5.5rem] items-center justify-center rounded-lg border px-2.5 py-1 text-sm font-semibold tabular-nums ${CHIP_TONES[tone]}`
}
