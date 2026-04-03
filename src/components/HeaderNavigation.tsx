'use client'

import { useState } from 'react'

import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  type DashboardIcon,
} from '@/components/dashboardIcons'

interface User {
  id: string
  userType: string
  firstName: string
  lastName: string
  email: string
}

interface HeaderNavigationProps {
  user: User
  logout: () => void
}

interface HeaderLink {
  href: string
  label: string
  icon: DashboardIcon
}

const HeaderNavigation: React.FC<HeaderNavigationProps> = ({ user, logout }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const getNavigationLinks = (): HeaderLink[] => {
    switch (user.userType) {
      case 'PUBLIC':
        return [
          { href: '/dashboard', label: 'Dashboard', icon: DASHBOARD_ICONS.dashboard },
          { href: '/calculator', label: 'Fare Calculator', icon: DASHBOARD_ICONS.calculator },
          { href: '/report', label: 'Report Incident', icon: DASHBOARD_ICONS.incidents },
        ]
      default:
        return []
    }
  }

  const navigationLinks = getNavigationLinks()

  if (navigationLinks.length === 0) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center space-x-2 text-gray-700 hover:text-emerald-600 transition-colors focus:outline-none"
        >
          <DashboardIconSlot icon={DASHBOARD_ICONS.user} size={DASHBOARD_ICON_POLICY.sizes.button} />
          <span className="hidden sm:inline font-medium">{user.firstName || user.email}</span>
          <DashboardIconSlot
            icon={DASHBOARD_ICONS.chevronDown}
            size={16}
            className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
            <div className="px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
              <div className="font-medium">{user.firstName} {user.lastName}</div>
              <div className="text-xs text-gray-400">{user.email}</div>
              <div className="text-xs text-emerald-600 font-medium">{user.userType}</div>
            </div>
            <button
              onClick={logout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors inline-flex items-center gap-2"
            >
              <DashboardIconSlot icon={DASHBOARD_ICONS.logout} size={DASHBOARD_ICON_POLICY.sizes.button} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-6">
      <div className="hidden lg:flex items-center space-x-4">
        {navigationLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="flex items-center space-x-2 text-gray-600 hover:text-emerald-600 transition-colors px-3 py-2 rounded-md hover:bg-emerald-50"
          >
            <DashboardIconSlot icon={link.icon} size={DASHBOARD_ICON_POLICY.sizes.button} />
            <span>{link.label}</span>
          </a>
        ))}
      </div>

      <div className="lg:hidden relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center space-x-2 text-gray-700 hover:text-emerald-600 transition-colors focus:outline-none"
        >
          <DashboardIconSlot icon={DASHBOARD_ICONS.menu} size={20} />
          <span className="hidden sm:inline">Menu</span>
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
            <div className="px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
              <div className="font-medium">{user.firstName} {user.lastName}</div>
              <div className="text-xs text-gray-400">{user.email}</div>
              <div className="text-xs text-emerald-600 font-medium">{user.userType}</div>
            </div>
            {navigationLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                onClick={() => setIsDropdownOpen(false)}
              >
                <DashboardIconSlot icon={link.icon} size={DASHBOARD_ICON_POLICY.sizes.button} />
                <span>{link.label}</span>
              </a>
            ))}
            <div className="border-t border-gray-100 mt-2 pt-2">
              <button
                onClick={logout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center space-x-3"
              >
                <DashboardIconSlot icon={DASHBOARD_ICONS.logout} size={DASHBOARD_ICON_POLICY.sizes.button} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="hidden lg:block relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center space-x-2 text-gray-700 hover:text-emerald-600 transition-colors focus:outline-none"
        >
          <DashboardIconSlot icon={DASHBOARD_ICONS.user} size={DASHBOARD_ICON_POLICY.sizes.button} />
          <span className="hidden sm:inline font-medium">{user.firstName || user.email}</span>
          <DashboardIconSlot
            icon={DASHBOARD_ICONS.chevronDown}
            size={16}
            className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
            <div className="px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
              <div className="font-medium">{user.firstName} {user.lastName}</div>
              <div className="text-xs text-gray-400">{user.email}</div>
              <div className="text-xs text-emerald-600 font-medium">{user.userType}</div>
            </div>
            <a
              href="/dashboard/profile"
              className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
            >
              <DashboardIconSlot icon={DASHBOARD_ICONS.user} size={DASHBOARD_ICON_POLICY.sizes.button} />
              <span>Profile</span>
            </a>
            <button
              onClick={logout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center space-x-3"
            >
              <DashboardIconSlot icon={DASHBOARD_ICONS.logout} size={DASHBOARD_ICON_POLICY.sizes.button} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default HeaderNavigation
