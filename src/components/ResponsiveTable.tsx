'use client'

import { ReactNode, memo } from 'react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { DASHBOARD_ICONS, DashboardIconSlot } from '@/components/dashboardIcons'

interface TableColumn {
  key: string
  label: string
  render?: (value: any, row: any) => ReactNode
  className?: string
  mobileLabel?: string // Custom label for mobile view
}

interface ResponsiveTableProps {
  columns: TableColumn[]
  data: any[]
  loading?: boolean
  emptyMessage?: string
  className?: string
  mobileCardClassName?: string
  getRowKey?: (row: any, index: number) => string
}

function ResponsiveTable({ 
  columns, 
  data, 
  loading = false,
  emptyMessage = "No data available",
  className = "",
  mobileCardClassName = "",
  getRowKey,
}: ResponsiveTableProps) {
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <LoadingSpinner className="justify-center text-emerald-600" size={28} />
          <p className="text-gray-600 mt-2">Loading...</p>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <DashboardIconSlot icon={DASHBOARD_ICONS.file} size={28} />
        </div>
        <p className="text-gray-500 text-lg">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={`overflow-hidden ${className}`}>
      {/* Desktop Table Layout */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="app-surface-inner">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.className || ''}`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white/90">
              {data.map((row, rowIndex) => (
                <tr key={getRowKey ? getRowKey(row, rowIndex) : rowIndex} className="transition-colors hover:bg-slate-50/80">
                  {columns.map((column) => (
                    <td key={column.key} className={`px-6 py-4 whitespace-nowrap text-sm ${column.className || ''}`}>
                      {column.render ? column.render(row[column.key], row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Stacked Card Layout */}
      <div className="md:hidden space-y-4">
        {data.map((row, rowIndex) => (
          <div key={getRowKey ? getRowKey(row, rowIndex) : rowIndex} className={`app-surface-inner rounded-lg p-4 ${mobileCardClassName}`.trim()}>
            {columns.map((column) => {
              const value = column.render ? column.render(row[column.key], row) : row[column.key]
              
              // Skip rendering if value is empty/null
              if (!value && value !== 0) return null
              
              return (
                <div key={column.key} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex-shrink-0 w-1/3">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {column.mobileLabel || column.label}
                    </span>
                  </div>
                  <div className="flex-1 text-right">
                    <div className={`text-sm text-gray-900 ${column.className || ''}`}>
                      {value}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// Status Badge Component for common use in tables
export function StatusBadge({ status, className = "" }: { status: string, className?: string }) {
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'approved':
      case 'resolved':
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'pending':
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800'
      case 'rejected':
      case 'cancelled':
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'inactive':
      case 'suspended':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)} ${className}`}>
      {status}
    </span>
  )
}

// Action Button Component for table actions
export function ActionButton({ 
  children, 
  onClick, 
  variant = 'primary',
  size = 'sm',
  className = "",
  disabled = false,
}: { 
  children: ReactNode
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'xs' | 'sm' | 'md'
  className?: string
  disabled?: boolean
}) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white'
      case 'secondary':
        return 'app-surface-inner hover:bg-white/80 text-gray-700 border border-gray-300/80'
      default:
        return 'bg-emerald-600 hover:bg-emerald-700 text-white'
    }
  }

  const getSizeClasses = () => {
    switch (size) {
      case 'xs':
        return 'px-2 py-1 text-xs'
      case 'md':
        return 'px-4 py-2 text-sm'
      default:
        return 'px-3 py-1.5 text-xs'
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center rounded-md font-medium transition-colors
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500
        disabled:cursor-not-allowed disabled:opacity-60
        ${getVariantClasses()} ${getSizeClasses()} ${className}
      `}
    >
      {children}
    </button>
  )
}

// Memoize to avoid unnecessary re-renders when props are unchanged
export default memo(ResponsiveTable)
