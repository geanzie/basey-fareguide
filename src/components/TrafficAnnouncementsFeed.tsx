'use client'

import useSWR from 'swr'

import type { AnnouncementsResponseDto, PublicAnnouncementDto } from '@/lib/contracts'
import { formatManilaDateTimeLabel } from '@/lib/manilaTime'
import { SWR_KEYS } from '@/lib/swrKeys'

interface TrafficAnnouncementsFeedProps {
  title?: string
  description?: string
  variant?: 'landing' | 'dashboard'
  className?: string
}

function getToneClasses(category: PublicAnnouncementDto['category']) {
  switch (category) {
    case 'EMERGENCY_NOTICE':
      return 'border-red-200 bg-red-50 text-red-950'
    case 'ROAD_CLOSURE':
      return 'border-amber-200 bg-amber-50 text-amber-950'
    case 'ROAD_WORK':
      return 'border-blue-200 bg-blue-50 text-blue-950'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-900'
  }
}

export default function TrafficAnnouncementsFeed({
  title = 'Traffic Announcements',
  description = 'Current road, traffic, and municipal transport advisories from Basey.',
  variant = 'dashboard',
  className = '',
}: TrafficAnnouncementsFeedProps) {
  const { data, error, isLoading } = useSWR<AnnouncementsResponseDto>(SWR_KEYS.announcements)

  if (error || (isLoading && !data) || !data?.announcements.length) {
    return null
  }

  const wrapperClasses =
    variant === 'landing'
      ? 'app-surface-card-strong rounded-2xl p-5'
      : 'app-surface-card rounded-2xl p-5'

  return (
    <section className={`${wrapperClasses} ${className}`.trim()}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <div className="app-surface-inner rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
          Latest active advisories
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        {data.announcements.map((announcement) => (
          <article
            key={announcement.id}
            className={`rounded-2xl border p-4 ${getToneClasses(announcement.category)}`}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-current/15 bg-white/70 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide">
                    {announcement.categoryLabel}
                  </span>
                  <span className="text-xs opacity-75">
                    Posted {formatManilaDateTimeLabel(announcement.startsAt)}
                  </span>
                </div>
                <h4 className="mt-3 text-xl font-bold">{announcement.title}</h4>
                <p className="mt-2 whitespace-pre-line text-sm opacity-90">{announcement.body}</p>
              </div>

              {announcement.endsAt && (
                <div className="rounded-xl border border-current/15 bg-white/70 px-4 py-3 text-sm font-medium">
                  Until {formatManilaDateTimeLabel(announcement.endsAt)}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
