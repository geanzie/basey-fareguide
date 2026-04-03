'use client'

import { useState } from 'react'
import Link from 'next/link'

import { LOGIN_ROUTE } from '@/lib/authRoutes'

import { useAuth } from './AuthProvider'
import BrandMark from './BrandMark'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  type DashboardIcon,
} from '@/components/dashboardIcons'

interface NavLinkItem {
  href: string
  label: string
  icon?: DashboardIcon
}

export default function Navigation() {
  const { user, loading, logout, status } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    if (status === 'logging_out') {
      return
    }

    setMobileMenuOpen(false)
    await logout()
  }

  const getDashboardUrl = (userType: string) => {
    switch (userType) {
      case 'ADMIN':
        return '/admin'
      case 'DATA_ENCODER':
        return '/encoder'
      case 'ENFORCER':
        return '/enforcer'
      case 'PUBLIC':
        return '/dashboard'
      default:
        return '/dashboard'
    }
  }

  const getDashboardLabel = (userType: string) => {
    switch (userType) {
      case 'ADMIN':
        return 'Admin Panel'
      case 'DATA_ENCODER':
        return 'Data Encoder'
      case 'ENFORCER':
        return 'Enforcement Dashboard'
      case 'PUBLIC':
        return 'My Dashboard'
      default:
        return 'Dashboard'
    }
  }

  const buildRoleBasedNavigation = (userType: string): NavLinkItem[] => {
    const dashboardLink: NavLinkItem = {
      href: getDashboardUrl(userType),
      label: getDashboardLabel(userType),
      icon: DASHBOARD_ICONS.dashboard,
    }

    switch (userType) {
      case 'DATA_ENCODER':
        return [dashboardLink]

      case 'PUBLIC':
      default:
        return [
          dashboardLink,
          { href: '/calculator', label: 'Fare Calculator', icon: DASHBOARD_ICONS.calculator },
          { href: '/report', label: 'Report Issue', icon: DASHBOARD_ICONS.incidents },
          { href: '/features', label: 'Features', icon: DASHBOARD_ICONS.list },
        ]
    }
  }

  const renderNavLink = (item: NavLinkItem, isMobile = false) => {
    const className = isMobile
      ? 'flex items-center gap-2 text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium'
      : 'flex items-center gap-2 text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium'

    return (
      <Link
        href={item.href}
        className={className}
        onClick={isMobile ? () => setMobileMenuOpen(false) : undefined}
        key={item.href}
      >
        {item.icon ? (
          <DashboardIconSlot
            icon={item.icon}
            size={DASHBOARD_ICON_POLICY.sizes.button}
          />
        ) : null}
        <span>{item.label}</span>
      </Link>
    )
  }

  const renderRoleBasedNavigation = (userType: string, isMobile = false) => {
    return buildRoleBasedNavigation(userType).map((item) => renderNavLink(item, isMobile))
  }

  return (
    <nav className="bg-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark size="sm" />
            <span className="text-xl font-bold text-gray-800">Basey Fare Guide</span>
          </div>

          <div className="hidden md:flex space-x-6">
            <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium">
              <DashboardIconSlot icon={DASHBOARD_ICONS.home} size={DASHBOARD_ICON_POLICY.sizes.button} />
              <span>Home</span>
            </Link>

            {!user && !loading ? (
              <Link href={LOGIN_ROUTE} className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium">
                <DashboardIconSlot icon={DASHBOARD_ICONS.user} size={DASHBOARD_ICON_POLICY.sizes.button} />
                <span>Login</span>
              </Link>
            ) : user ? (
              <>
                {renderRoleBasedNavigation(user.userType, false)}
                <Link href="/report" className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium">
                  <DashboardIconSlot icon={DASHBOARD_ICONS.incidents} size={DASHBOARD_ICON_POLICY.sizes.button} />
                  <span>Report Issue</span>
                </Link>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Hi, {user.firstName}</span>
                  <button
                    onClick={handleLogout}
                    disabled={status === 'logging_out'}
                    className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-800 px-3 py-2 disabled:opacity-60"
                  >
                    <DashboardIconSlot icon={DASHBOARD_ICONS.logout} size={DASHBOARD_ICON_POLICY.sizes.button} />
                    <span>{status === 'logging_out' ? 'Signing out...' : 'Logout'}</span>
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-600 hover:text-emerald-600 p-2"
            >
              <DashboardIconSlot icon={DASHBOARD_ICONS.menu} size={24} />
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="md:hidden bg-white border-t">
          <div className="px-4 py-2 space-y-1">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              <DashboardIconSlot icon={DASHBOARD_ICONS.home} size={DASHBOARD_ICON_POLICY.sizes.button} />
              <span>Home</span>
            </Link>

            {!user && !loading ? (
              <Link
                href={LOGIN_ROUTE}
                className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                <DashboardIconSlot icon={DASHBOARD_ICONS.user} size={DASHBOARD_ICON_POLICY.sizes.button} />
                <span>Login</span>
              </Link>
            ) : user ? (
              <>
                {renderRoleBasedNavigation(user.userType, true)}
                <Link
                  href="/report"
                  className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <DashboardIconSlot icon={DASHBOARD_ICONS.incidents} size={DASHBOARD_ICON_POLICY.sizes.button} />
                  <span>Report Issue</span>
                </Link>
                <div className="px-3 py-2 border-t border-gray-200">
                  <div className="text-sm text-gray-600 mb-2">Hi, {user.firstName}</div>
                  <button
                    onClick={handleLogout}
                    disabled={status === 'logging_out'}
                    className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-800 disabled:opacity-60"
                  >
                    <DashboardIconSlot icon={DASHBOARD_ICONS.logout} size={DASHBOARD_ICON_POLICY.sizes.button} />
                    <span>{status === 'logging_out' ? 'Signing out...' : 'Logout'}</span>
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </nav>
  )
}
