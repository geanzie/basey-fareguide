import { afterEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_PG_CONNECTION_TIMEOUT_MS,
  getPgConnectionTimeoutMs,
} from '@/lib/databaseConfig'

describe('databaseConfig', () => {
  afterEach(() => {
    delete process.env.PG_CONNECTION_TIMEOUT_MS
  })

  it('uses the default connection timeout when unset', () => {
    expect(getPgConnectionTimeoutMs()).toBe(DEFAULT_PG_CONNECTION_TIMEOUT_MS)
  })

  it('uses the default connection timeout when the env value is invalid', () => {
    expect(getPgConnectionTimeoutMs('abc')).toBe(DEFAULT_PG_CONNECTION_TIMEOUT_MS)
    expect(getPgConnectionTimeoutMs('0')).toBe(DEFAULT_PG_CONNECTION_TIMEOUT_MS)
    expect(getPgConnectionTimeoutMs('-10')).toBe(DEFAULT_PG_CONNECTION_TIMEOUT_MS)
  })

  it('accepts a positive integer override', () => {
    expect(getPgConnectionTimeoutMs('2500')).toBe(2500)
  })
})