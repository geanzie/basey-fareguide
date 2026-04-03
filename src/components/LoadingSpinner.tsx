import {
  DASHBOARD_ICONS,
  DashboardIconSlot,
} from '@/components/dashboardIcons'

export default function LoadingSpinner({
  className = '',
  label,
  size = 20,
  textClassName = '',
}: {
  className?: string
  label?: string
  size?: number
  textClassName?: string
}) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <DashboardIconSlot
        icon={DASHBOARD_ICONS.loader}
        size={size}
        className="animate-spin"
      />
      {label ? (
        <span className={textClassName}>{label}</span>
      ) : null}
    </span>
  )
}
