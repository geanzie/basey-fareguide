import { describe, expect, it } from 'vitest'

import {
  getAuthenticatedNavigationConfig,
  getAuthenticatedMobilePrimaryActionCount,
  getAuthenticatedNavigationTitle,
  isAuthenticatedNavigationItemActive,
  isAuthenticatedProfileSheetActive,
} from '@/lib/navigation/authenticatedNavigation'

describe('authenticated navigation registry', () => {
  it('keeps the mobile tab count strict for each role', () => {
    expect(getAuthenticatedNavigationConfig('PUBLIC').tabs).toHaveLength(4)
    expect(getAuthenticatedNavigationConfig('ADMIN').tabs).toHaveLength(4)
    expect(getAuthenticatedNavigationConfig('DATA_ENCODER').tabs).toHaveLength(4)
    expect(getAuthenticatedNavigationConfig('ENFORCER').tabs).toHaveLength(2)
    expect(getAuthenticatedNavigationConfig('DRIVER').tabs).toHaveLength(1)
  })

  it('derives mobile primary actions from the active role navigation', () => {
    expect(getAuthenticatedMobilePrimaryActionCount('PUBLIC')).toBe(5)
    expect(getAuthenticatedMobilePrimaryActionCount('ADMIN')).toBe(5)
    expect(getAuthenticatedMobilePrimaryActionCount('DATA_ENCODER')).toBe(5)
    expect(getAuthenticatedMobilePrimaryActionCount('ENFORCER')).toBe(3)
    expect(getAuthenticatedMobilePrimaryActionCount('DRIVER')).toBe(2)
  })

  it('matches legacy public calculator and report aliases to the new tabs', () => {
    const publicNavigation = getAuthenticatedNavigationConfig('PUBLIC')
    const calculatorTab = publicNavigation.tabs.find((item) => item.id === 'calculator')
    const reportTab = publicNavigation.tabs.find((item) => item.id === 'report')

    expect(calculatorTab).toBeDefined()
    expect(reportTab).toBeDefined()
    expect(isAuthenticatedNavigationItemActive('/dashboard/calculator', calculatorTab!)).toBe(true)
    expect(isAuthenticatedNavigationItemActive('/dashboard/report', reportTab!)).toBe(true)
  })

  it('treats secondary destinations as profile-sheet routes', () => {
    expect(isAuthenticatedProfileSheetActive('/profile/discount', 'PUBLIC')).toBe(true)
    expect(isAuthenticatedProfileSheetActive('/admin/users', 'ADMIN')).toBe(true)
    expect(isAuthenticatedProfileSheetActive('/admin/ticket-payments', 'ADMIN')).toBe(true)
    expect(isAuthenticatedProfileSheetActive('/profile', 'DRIVER')).toBe(true)
    expect(isAuthenticatedProfileSheetActive('/encoder', 'DATA_ENCODER')).toBe(false)
  })

  it('derives page titles from the active registry item', () => {
    expect(getAuthenticatedNavigationTitle('/calculator', 'PUBLIC')).toBe('Fare Calculator')
    expect(getAuthenticatedNavigationTitle('/admin/reports', 'ADMIN')).toBe('System Reports')
    expect(getAuthenticatedNavigationTitle('/admin/ticket-payments', 'ADMIN')).toBe('Ticket Payments')
    expect(getAuthenticatedNavigationTitle('/encoder/ticket-payments', 'DATA_ENCODER')).toBe('Ticket Payments')
    expect(getAuthenticatedNavigationTitle('/profile', 'ENFORCER')).toBe('My Profile')
    expect(getAuthenticatedNavigationTitle('/driver', 'DRIVER')).toBe('Driver Portal')
  })
})