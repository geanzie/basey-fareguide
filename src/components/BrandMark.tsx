import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
} from '@/components/dashboardIcons'

export default function BrandMark({
  size = 'md',
}: {
  size?: 'sm' | 'md'
}) {
  const sizeClasses = size === 'sm' ? 'h-9 w-9 rounded-lg' : 'h-10 w-10 rounded-xl'

  return (
    <div
      className={`inline-flex items-center justify-center bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-sm ${sizeClasses}`}
    >
      <DashboardIconSlot
        icon={DASHBOARD_ICONS.brand}
        size={DASHBOARD_ICON_POLICY.sizes.brand}
        className="text-white"
      />
    </div>
  )
}
