import { describe, expect, it } from 'vitest'

import { formatPinCoordinateLabel, resolvePinLabel } from '@/lib/locations/pinLabelResolver'

describe('formatPinCoordinateLabel', () => {
  it('uses a fixed 6-decimal fallback format', () => {
    expect(formatPinCoordinateLabel(11.2788234, 125.0011944)).toBe('11.278823, 125.001194')
  })
})

describe('resolvePinLabel', () => {
  it('returns a consistent resolved-label shape', () => {
    const result = resolvePinLabel(11.278823, 125.001194)

    expect(result.rawCoordinates).toBe('11.278823, 125.001194')
    expect(typeof result.displayLabel).toBe('string')
    expect(typeof result.isFallback).toBe('boolean')
    expect(result.barangayName === null || result.barangayName === result.displayLabel).toBe(true)
  })

  it('falls back to coordinates when no polygon match is found', () => {
    const result = resolvePinLabel(0, 0)

    expect(result).toEqual({
      displayLabel: '0.000000, 0.000000',
      barangayName: null,
      rawCoordinates: '0.000000, 0.000000',
      isFallback: true,
    })
  })
})