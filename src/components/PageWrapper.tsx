'use client'

import { ReactNode, useEffect } from 'react'

interface PageWrapperProps {
  children: ReactNode
  title?: string
  subtitle?: string
  headerContent?: ReactNode
  className?: string
}

// Global state to communicate with UnifiedLayout
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
  pageDataListeners.forEach(callback => callback())
}

export default function PageWrapper({ 
  children, 
  title, 
  subtitle, 
  headerContent, 
  className = '' 
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
    <div className={`${className}`}>
      {/* Page Content - Title and headerContent are now handled by UnifiedLayout */}
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  )
}

// Utility components for consistent layouts
export function PageSection({ 
  title, 
  children, 
  className = '',
  headerContent
}: {
  title?: string
  children: ReactNode
  className?: string
  headerContent?: ReactNode
}) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      {(title || headerContent) && (
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            {title && (
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            )}
            {headerContent && (
              <div>{headerContent}</div>
            )}
          </div>
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  )
}

export function StatsGrid({ 
  children, 
  className = '' 
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
  color = 'emerald'
}: {
  title: string
  value: string | number
  icon: string
  trend?: string
  trendDirection?: 'up' | 'down' | 'neutral'
  color?: 'emerald' | 'blue' | 'orange' | 'red' | 'purple'
}) {
  const colorClasses = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700'
  }

  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-500'
  }

  return (
    <div className={`rounded-lg border p-6 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {trend && trendDirection && (
            <p className={`text-sm mt-1 ${trendColors[trendDirection]}`}>
              {trendDirection === 'up' && '↗️'}
              {trendDirection === 'down' && '↘️'}
              {trendDirection === 'neutral' && '→'}
              {trend}
            </p>
          )}
        </div>
        <div className="text-3xl opacity-75">
          {icon}
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
  className = ''
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
    secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm focus:ring-emerald-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm focus:ring-red-500',
    success: 'bg-green-600 hover:bg-green-700 text-white shadow-sm focus:ring-green-500'
  }
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
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