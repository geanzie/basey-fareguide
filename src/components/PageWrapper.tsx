'use client'

import { ReactNode, useEffect } from 'react'

import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
  type DashboardIcon,
  type DashboardIconTone,
} from '@/components/dashboardIcons'

interface PageWrapperProps {
  children: ReactNode
  title?: string
  subtitle?: string
  headerContent?: ReactNode
  className?: string
}

let currentPageData: { title?: string; subtitle?: string; headerContent?: ReactNode } = {}
const pageDataListeners: Array<() => void> = []

export function getCurrentPageData() {
  return currentPageData
}

export function subscribeToPageData(callback: () => void) {
  pageDataListeners.push(callback)
  return () => {
    const index = pageDataListeners.indexOf(callback)
    if (index > -1) {
      pageDataListeners.splice(index, 1)
    }
  }
}

function notifyPageDataChange() {
  pageDataListeners.forEach((callback) => callback())
}

export default function PageWrapper({
  children,
  title,
  subtitle,
  headerContent,
  className = '',
}: PageWrapperProps) {
  useEffect(() => {
    currentPageData = { title, subtitle, headerContent }
    notifyPageDataChange()

    return () => {
      currentPageData = {}
      notifyPageDataChange()
    }
  }, [title, subtitle, headerContent])

  return (
    <div className={`app-page-bg ${className}`.trim()}>
      <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
    </div>
  )
}

export function PageSection({
  title,
  children,
  className = '',
  headerContent,
}: {
  title?: string
  children: ReactNode
  className?: string
  headerContent?: ReactNode
}) {
  return (
    <div className={`app-surface-card overflow-hidden rounded-2xl ${className}`.trim()}>
      {(title || headerContent) && (
        <div className="app-surface-inner border-b border-slate-200/70 px-6 py-4">
          <div className="flex items-center justify-between">
            {title ? <h2 className="text-lg font-semibold text-gray-900">{title}</h2> : null}
            {headerContent ? <div>{headerContent}</div> : null}
          </div>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  )
}

export function StatsGrid({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {children}
    </div>
  )
}

export function StatCard({
  title,
  value,
  icon,
  trend,
  trendDirection,
  color = 'emerald',
}: {
  title: string
  value: string | number
  icon: DashboardIcon
  trend?: string
  trendDirection?: 'up' | 'down' | 'neutral'
  color?: 'emerald' | 'blue' | 'orange' | 'red' | 'purple'
}) {
  const colorClasses = {
    emerald: 'border-emerald-200/80',
    blue: 'border-blue-200/80',
    orange: 'border-orange-200/80',
    red: 'border-red-200/80',
    purple: 'border-purple-200/80',
  }
  const colorTones: Record<typeof color, DashboardIconTone> = {
    emerald: 'emerald',
    blue: 'blue',
    orange: 'amber',
    red: 'red',
    purple: 'purple',
  }

  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-500',
  }

  const trendTransforms = {
    up: '-rotate-45',
    down: 'rotate-45',
    neutral: 'rotate-0',
  }

  return (
    <div className={`app-surface-card-strong rounded-2xl p-6 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          {trend && trendDirection ? (
            <p className={`inline-flex items-center gap-1 text-sm mt-1 ${trendColors[trendDirection]}`}>
              <DashboardIconSlot
                icon={DASHBOARD_ICONS.arrowRight}
                size={DASHBOARD_ICON_POLICY.sizes.button}
                className={trendTransforms[trendDirection]}
              />
              <span>{trend}</span>
            </p>
          ) : null}
        </div>
        <div className={getDashboardIconChipClasses(colorTones[color])}>
          <DashboardIconSlot icon={icon} size={DASHBOARD_ICON_POLICY.sizes.card} />
        </div>
      </div>
    </div>
  )
}

export function ActionButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
}) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2'

  const variantClasses = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm focus:ring-emerald-500',
    secondary: 'app-surface-inner hover:bg-white/80 text-gray-700 border border-gray-300/80 shadow-sm focus:ring-emerald-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm focus:ring-red-500',
    success: 'bg-green-600 hover:bg-green-700 text-white shadow-sm focus:ring-green-500',
  }

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`}
    >
      {children}
    </button>
  )
}
