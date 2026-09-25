import type { ViolationGroup } from '@/lib/contracts'

/**
 * Violation-group colors for the map and charts.
 *
 * Four hues plus a neutral for "Other". Validated with the dataviz palette
 * checker under `--pairs all` (map markers can sit next to any other color):
 * worst CVD ΔE 9.2, normal-vision ΔE 16.3. A fifth hue fails both floors, so
 * "Other" stays gray on purpose. Aqua is under 3:1 on white, so every place it
 * appears also carries a text label (legend, bar label, list row).
 *
 * Red and green are left out: the app uses them for status (danger / success).
 */
export const GROUP_HEX: Record<ViolationGroup, string> = {
  FARE: '#eb6834',
  DRIVING: '#4a3aa7',
  FRANCHISE: '#2a78d6',
  ROUTE: '#1baf7a',
  OTHER: '#94a3b8',
}
