import { describe, expect, it } from 'vitest'

import {
  getAuthenticatedNavigationConfig,
  getAuthenticatedMobilePrimaryActionCount,
  getAuthenticatedMobileSheetItems,
  getAuthenticatedMobileTabs,
  getAuthenticatedNavigationTitle,
  isAuthenticatedNavigationItemActive,
  isAuthenticatedProfileSheetActive,
} from '@/lib/navigation/authenticatedNavigation'

describe('authenticated navigation registry', () => {
  // Desktop sidebar list; the smaller mobile subset is asserted separately below.
  it('keeps the sidebar tab count strict for each role', () => {
    expect(getAuthenticatedNavigationConfig('PUBLIC').tabs).toHaveLength(4)
    expect(getAuthenticatedNavigationConfig('ADMIN').tabs).toHaveLength(4)
    expect(getAuthenticatedNavigationConfig('DATA_ENCODER').tabs).toHaveLength(4)
    expect(getAuthenticatedNavigationConfig('ENFORCER').tabs).toHaveLength(2)
    expect(getAuthenticatedNavigationConfig('DRIVER').tabs).toHaveLength(3)
  })

  it('keeps the driver tabs on the trip, history, and incidents destinations', () => {
    // A bare length check let the incidents tab land unnoticed; assert the ids
    // so the next change to this row has to say what it is adding.
    expect(getAuthenticatedNavigationConfig('DRIVER').tabs.map((tab) => tab.id)).toEqual([
      'dashboard',
      'history',
      'incidents',
    ])
  })

  it('keeps public history and report off the mobile tab bar', () => {
    expect(getAuthenticatedMobileTabs('PUBLIC').map((tab) => tab.id)).toEqual([
      'dashboard',
      'calculator',
    ])
    expect(getAuthenticatedMobileSheetItems('PUBLIC').map((item) => item.id)).toEqual([
      'history',
      'report',
      'profile',
      'about',
      'feedback',
      'discount-card',
    ])
  })

  it('leaves roles without the flag on the full tab bar', () => {
    expect(getAuthenticatedMobileTabs('DRIVER').map((tab) => tab.id)).toEqual([
      'dashboard',
      'history',
      'incidents',
    ])
    expect(getAuthenticatedMobileSheetItems('DRIVER').map((item) => item.id)).toEqual([
      'profile',
      'about',
      'feedback',
    ])
  })

  it('derives mobile primary actions from the active role navigation', () => {
    expect(getAuthenticatedMobilePrimaryActionCount('PUBLIC')).toBe(3)
    expect(getAuthenticatedMobilePrimaryActionCount('ADMIN')).toBe(5)
    expect(getAuthenticatedMobilePrimaryActionCount('DATA_ENCODER')).toBe(5)
    expect(getAuthenticatedMobilePrimaryActionCount('ENFORCER')).toBe(3)
    expect(getAuthenticatedMobilePrimaryActionCount('DRIVER')).toBe(4)
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

  it('offers Send Feedback to every role, and the admin review screen to admins', () => {
    for (const role of ['PUBLIC', 'ADMIN', 'DATA_ENCODER', 'ENFORCER', 'DRIVER'] as const) {
      expect(getAuthenticatedMobileSheetItems(role).map((item) => item.id)).toContain('feedback')
    }

    expect(getAuthenticatedMobileSheetItems('ADMIN').map((item) => item.id)).toContain(
      'admin-feedback',
    )
    expect(getAuthenticatedMobileSheetItems('PUBLIC').map((item) => item.id)).not.toContain(
      'admin-feedback',
    )
  })

  it('treats secondary destinations as profile-sheet routes', () => {
    expect(isAuthenticatedProfileSheetActive('/profile/feedback', 'PUBLIC')).toBe(true)
    expect(isAuthenticatedProfileSheetActive('/admin/feedback', 'ADMIN')).toBe(true)
    expect(isAuthenticatedProfileSheetActive('/profile/discount', 'PUBLIC')).toBe(true)
    expect(isAuthenticatedProfileSheetActive('/history', 'PUBLIC')).toBe(true)
    expect(isAuthenticatedProfileSheetActive('/report', 'PUBLIC')).toBe(true)
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
    expect(getAuthenticatedNavigationTitle('/driver', 'DRIVER')).toBe('Trip Session')
    expect(getAuthenticatedNavigationTitle('/driver/history', 'DRIVER')).toBe('Trip History')
  })
})