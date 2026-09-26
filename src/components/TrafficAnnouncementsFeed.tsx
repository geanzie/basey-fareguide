'use client'

import useSWR from 'swr'

import type { AnnouncementsResponseDto, PublicAnnouncementDto } from '@/lib/contracts'
import { formatManilaDateTimeLabel } from '@/lib/manilaTime'
import { SWR_KEYS } from '@/lib/swrKeys'

interface TrafficAnnouncementsFeedProps {
  title?: string
  description?: string
  className?: string
}

function getToneClasses(category: PublicAnnouncementDto['category']) {
  switch (category) {
    case 'EMERGENCY_NOTICE':
      return 'border-danger/45 bg-danger/5 text-danger'
    case 'ROAD_CLOSURE':
      return 'border-warning/60 bg-warning/5 text-warning-dark'
    case 'ROAD_WORK':
      return 'border-info/45 bg-info/5 text-info'
    default:
      return 'border-surface-border bg-surface-alt text-ink-muted'
  }
}

export default function TrafficAnnouncementsFeed({
  title = 'Traffic Announcements',
  description = 'Current road, traffic, and municipal transport advisories from Basey.',
  className = '',
}: TrafficAnnouncementsFeedProps) {
  const { data, error, isLoading } = useSWR<AnnouncementsResponseDto>(SWR_KEYS.announcements)

  if (error || (isLoading && !data) || !data?.announcements.length) {
    return null
  }

  return (
    <section
      className={`rounded-card border border-surface-border bg-surface p-4 shadow-card ${className}`.trim()}
    >
      <header className="min-w-0">
        <h2 className="font-brand text-lg font-bold text-ink-strong">{title}</h2>
        <p className="text-xs text-ink-muted">{description}</p>
      </header>

      <ol className="mt-4 flex flex-col gap-3">
        {data.announcements.map((announcement) => (
          <li key={announcement.id} className="rounded-xl border border-surface-border p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {/* The category is the one colored mark: how serious the advisory is. */}
              <span
                className={`rounded-lg border px-2 py-0.5 text-xs font-semibold ${getToneClasses(announcement.category)}`}
              >
                {announcement.categoryLabel}
              </span>
              <span className="text-xs text-ink-muted">
                Posted {formatManilaDateTimeLabel(announcement.startsAt)}
                {announcement.endsAt ? `, until ${formatManilaDateTimeLabel(announcement.endsAt)}` : ''}
              </span>
            </div>
            <h3 className="mt-2 text-sm font-semibold text-ink-strong">{announcement.title}</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-body">{announcement.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
