import Link from 'next/link'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
  type DashboardIcon,
  type DashboardIconTone,
} from '@/components/dashboardIcons'

interface Props {
  href: string
  title: string
  /** One line on what the destination is for. Omit when the title says it all. */
  description?: string
  icon?: DashboardIcon
  /** Tone of the icon chip. Defaults to the app green. */
  tone?: DashboardIconTone
}

/**
 * The one navigational card. A dashboard surface whose whole body is the link.
 *
 * The trailing arrow is rendered at rest, not on hover: a card that only admits
 * to being clickable once a pointer is over it admits nothing at all on a phone,
 * and this app is used on phones. Static surfaces (ui/Card, a StatTile with no
 * href) carry no arrow, so the arrow's *absence* is what marks them inert.
 *
 * Use it only for destinations that are not already a mobile primary tab —
 * see docs/adr/0004-dashboard-cards-are-not-a-second-navigation.md.
 */
export default function NavCard({ href, title, description, icon, tone = 'emerald' }: Props) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-card border border-surface-border bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
    >
      {icon ? (
        <span className={getDashboardIconChipClasses(tone)}>
          <DashboardIconSlot icon={icon} size={DASHBOARD_ICON_POLICY.sizes.card} />
        </span>
      ) : null}

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-ink-strong">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-snug text-ink-muted">{description}</span>
        ) : null}
      </span>

      <DashboardIconSlot
        icon={DASHBOARD_ICONS.arrowRight}
        size={DASHBOARD_ICON_POLICY.sizes.card}
        className="mt-0.5 text-ink-faint transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
      />
    </Link>
  )
}
