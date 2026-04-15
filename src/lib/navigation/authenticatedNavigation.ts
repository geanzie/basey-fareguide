import {
  DASHBOARD_ICONS,
  type DashboardIcon,
} from '@/components/dashboardIcons'
import type { UserRole } from '@/lib/contracts/common'

type NavigationMatchStrategy = 'exact' | 'prefix'

interface NavigationMatcher {
  path: string
  strategy?: NavigationMatchStrategy
}

export interface AuthenticatedNavigationItem {
  id: string
  label: string
  shortLabel: string
  icon: DashboardIcon
  href: string
  matchers: readonly NavigationMatcher[]
}

export interface AuthenticatedNavigationConfig {
  tabs: readonly AuthenticatedNavigationItem[]
  secondaryActions: readonly AuthenticatedNavigationItem[]
}

export const MOBILE_PROFILE_LAUNCHER = {
  label: 'Profile',
  shortLabel: 'Profile',
  icon: DASHBOARD_ICONS.user,
} as const

function exact(path: string): NavigationMatcher {
  return { path, strategy: 'exact' }
}

function prefix(path: string): NavigationMatcher {
  return { path, strategy: 'prefix' }
}

const authenticatedNavigationRegistry: Record<UserRole, AuthenticatedNavigationConfig> = {
  PUBLIC: {
    tabs: [
      {
        id: 'dashboard',
        label: 'My Dashboard',
        shortLabel: 'Home',
        icon: DASHBOARD_ICONS.dashboard,
        href: '/dashboard',
        matchers: [exact('/dashboard')],
      },
      {
        id: 'calculator',
        label: 'Fare Calculator',
        shortLabel: 'Calculator',
        icon: DASHBOARD_ICONS.calculator,
        href: '/calculator',
        matchers: [exact('/calculator'), exact('/dashboard/calculator')],
      },
      {
        id: 'history',
        label: 'My History',
        shortLabel: 'History',
        icon: DASHBOARD_ICONS.history,
        href: '/history',
        matchers: [prefix('/history'), exact('/dashboard/incidents')],
      },
      {
        id: 'report',
        label: 'Report Incident',
        shortLabel: 'Report',
        icon: DASHBOARD_ICONS.incidents,
        href: '/report',
        matchers: [prefix('/report'), exact('/dashboard/report')],
      },
    ],
    secondaryActions: [
      {
        id: 'profile',
        label: 'My Profile',
        shortLabel: 'Profile',
        icon: DASHBOARD_ICONS.user,
        href: '/profile',
        matchers: [exact('/profile'), exact('/dashboard/profile')],
      },
      {
        id: 'discount-card',
        label: 'Discount Card',
        shortLabel: 'Discount',
        icon: DASHBOARD_ICONS.discount,
        href: '/profile/discount',
        matchers: [prefix('/profile/discount')],
      },
    ],
  },
  ADMIN: {
    tabs: [
      {
        id: 'dashboard',
        label: 'Admin Dashboard',
        shortLabel: 'Home',
        icon: DASHBOARD_ICONS.dashboard,
        href: '/admin',
        matchers: [exact('/admin')],
      },
      {
        id: 'incidents',
        label: 'All Incidents',
        shortLabel: 'Incidents',
        icon: DASHBOARD_ICONS.incidents,
        href: '/admin/incidents',
        matchers: [prefix('/admin/incidents')],
      },
      {
        id: 'reports',
        label: 'System Reports',
        shortLabel: 'Reports',
        icon: DASHBOARD_ICONS.reports,
        href: '/admin/reports',
        matchers: [prefix('/admin/reports')],
      },
      {
        id: 'announcements',
        label: 'Announcements',
        shortLabel: 'Alerts',
        icon: DASHBOARD_ICONS.announcements,
        href: '/admin/announcements',
        matchers: [prefix('/admin/announcements')],
      },
    ],
    secondaryActions: [
      {
        id: 'profile',
        label: 'My Profile',
        shortLabel: 'Profile',
        icon: DASHBOARD_ICONS.user,
        href: '/profile',
        matchers: [exact('/profile')],
      },
      {
        id: 'users',
        label: 'User Management',
        shortLabel: 'Users',
        icon: DASHBOARD_ICONS.users,
        href: '/admin/users',
        matchers: [prefix('/admin/users')],
      },
      {
        id: 'ticket-payments',
        label: 'Ticket Payments',
        shortLabel: 'Payments',
        icon: DASHBOARD_ICONS.ticket,
        href: '/admin/ticket-payments',
        matchers: [prefix('/admin/ticket-payments')],
      },
      {
        id: 'fare-rates',
        label: 'Fare Rates',
        shortLabel: 'Fares',
        icon: DASHBOARD_ICONS.fare,
        href: '/admin/fare-rates',
        matchers: [prefix('/admin/fare-rates')],
      },
      {
        id: 'discount-cards',
        label: 'Discount Cards',
        shortLabel: 'Discounts',
        icon: DASHBOARD_ICONS.discount,
        href: '/admin/discount-cards',
        matchers: [prefix('/admin/discount-cards')],
      },
    ],
  },
  DATA_ENCODER: {
    tabs: [
      {
        id: 'dashboard',
        label: 'Encoder Dashboard',
        shortLabel: 'Home',
        icon: DASHBOARD_ICONS.dashboard,
        href: '/encoder',
        matchers: [exact('/encoder')],
      },
      {
        id: 'permits',
        label: 'Permit Management',
        shortLabel: 'Permits',
        icon: DASHBOARD_ICONS.fileText,
        href: '/encoder/permits',
        matchers: [prefix('/encoder/permits')],
      },
      {
        id: 'vehicles',
        label: 'Vehicle Registry',
        shortLabel: 'Vehicles',
        icon: DASHBOARD_ICONS.vehicle,
        href: '/encoder/vehicles',
        matchers: [prefix('/encoder/vehicles')],
      },
      {
        id: 'ticket-payments',
        label: 'Ticket Payments',
        shortLabel: 'Payments',
        icon: DASHBOARD_ICONS.ticket,
        href: '/encoder/ticket-payments',
        matchers: [prefix('/encoder/ticket-payments')],
      },
    ],
    secondaryActions: [
      {
        id: 'profile',
        label: 'My Profile',
        shortLabel: 'Profile',
        icon: DASHBOARD_ICONS.user,
        href: '/profile',
        matchers: [exact('/profile')],
      },
    ],
  },
  ENFORCER: {
    tabs: [
      {
        id: 'dashboard',
        label: 'Enforcement Dashboard',
        shortLabel: 'Home',
        icon: DASHBOARD_ICONS.dashboard,
        href: '/enforcer',
        matchers: [exact('/enforcer')],
      },
      {
        id: 'incidents',
        label: 'Incident Queue',
        shortLabel: 'Queue',
        icon: DASHBOARD_ICONS.incidents,
        href: '/enforcer/incidents',
        matchers: [prefix('/enforcer/incidents')],
      },
    ],
    secondaryActions: [
      {
        id: 'profile',
        label: 'My Profile',
        shortLabel: 'Profile',
        icon: DASHBOARD_ICONS.user,
        href: '/profile',
        matchers: [exact('/profile')],
      },
      {
        id: 'reports',
        label: 'Enforcer Reports',
        shortLabel: 'Reports',
        icon: DASHBOARD_ICONS.reports,
        href: '/enforcer/reports',
        matchers: [prefix('/enforcer/reports')],
      },
    ],
  },
  DRIVER: {
    tabs: [
      {
        id: 'dashboard',
        label: 'Trip Session',
        shortLabel: 'Trip',
        icon: DASHBOARD_ICONS.dashboard,
        href: '/driver',
        matchers: [exact('/driver')],
      },
    ],
    secondaryActions: [
      {
        id: 'profile',
        label: 'My Profile',
        shortLabel: 'Profile',
        icon: DASHBOARD_ICONS.user,
        href: '/profile',
        matchers: [exact('/profile')],
      },
    ],
  },
}

function normalizePathname(pathname: string): string {
  return pathname.split('?')[0] || '/'
}

function matchesPathname(pathname: string, matcher: NavigationMatcher): boolean {
  const currentPath = normalizePathname(pathname)
  const targetPath = normalizePathname(matcher.path)

  if ((matcher.strategy ?? 'prefix') === 'exact') {
    return currentPath === targetPath
  }

  if (targetPath === '/') {
    return currentPath === '/'
  }

  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)
}

export function getAuthenticatedNavigationConfig(userRole: UserRole): AuthenticatedNavigationConfig {
  return authenticatedNavigationRegistry[userRole]
}

export function getAuthenticatedMobilePrimaryActionCount(userRole: UserRole): number {
  return getAuthenticatedNavigationConfig(userRole).tabs.length + 1
}

export function isAuthenticatedNavigationItemActive(
  pathname: string,
  item: AuthenticatedNavigationItem,
): boolean {
  return item.matchers.some((matcher) => matchesPathname(pathname, matcher))
}

export function isAuthenticatedProfileSheetActive(pathname: string, userRole: UserRole): boolean {
  return getAuthenticatedNavigationConfig(userRole).secondaryActions.some((item) =>
    isAuthenticatedNavigationItemActive(pathname, item),
  )
}

export function getAuthenticatedNavigationTitle(pathname: string, userRole: UserRole): string | null {
  const { tabs, secondaryActions } = getAuthenticatedNavigationConfig(userRole)
  const activeItem = [...tabs, ...secondaryActions].find((item) =>
    isAuthenticatedNavigationItemActive(pathname, item),
  )

  return activeItem?.label ?? null
}