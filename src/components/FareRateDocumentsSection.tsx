'use client'

import Link from 'next/link'
import useSWR from 'swr'

import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
} from '@/components/dashboardIcons'
import type { FareRateDocumentEntryDto, FareRateDocumentsResponseDto } from '@/lib/contracts'
import { isImageFareDocument, isPdfFareDocument } from '@/lib/fare/documentTypes'
import { formatManilaDateTimeLabel } from '@/lib/manilaTime'
import { SWR_KEYS } from '@/lib/swrKeys'

function formatCurrency(value: number) {
  return `PHP ${value.toFixed(2)}`
}

function statusLabel(entry: FareRateDocumentEntryDto) {
  if (entry.isUpcoming) {
    return 'Takes effect soon'
  }

  return entry.isActive ? 'Currently in force' : 'Superseded'
}

/**
 * The municipal issuances behind each fare change, newest first.
 *
 * This is the answer to "where did this number come from?" — a rider comparing a
 * driver's fare against the app can open the resolution that authorized it. The
 * cards deliberately reuse the Ordinance No. 105 card's styling, because on the
 * About page they sit in the same group and are the same kind of thing.
 */
export default function FareRateDocumentsSection() {
  const { data, error, isLoading } = useSWR<FareRateDocumentsResponseDto>(
    SWR_KEYS.fareRateDocuments,
  )

  if (isLoading) {
    return (
      <div className="rounded-card border border-surface-border bg-surface p-5 shadow-card">
        <p className="text-sm text-slate-500">Loading fare rate documents...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-card border border-surface-border bg-surface p-5 shadow-card">
        <p className="text-sm text-slate-500">
          Fare rate documents could not be loaded right now.
        </p>
      </div>
    )
  }

  const documents = data?.documents ?? []

  if (documents.length === 0) {
    return (
      <div className="rounded-card border border-surface-border bg-surface p-5 shadow-card">
        <p className="text-sm text-slate-600">
          No fare rate updates have been issued since Municipal Ordinance No. 105. The rates below
          Ordinance No. 105 remain the ones in force.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {documents.map((entry) => {
        const readable = isPdfFareDocument(entry.document.mimeType) || isImageFareDocument(entry.document.mimeType)

        return (
          <div
            key={entry.versionId}
            className="rounded-card border border-surface-border bg-surface p-5 shadow-card lg:p-6"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                  <DashboardIconSlot icon={DASHBOARD_ICONS.fileText} size={16} />
                  <p>{statusLabel(entry)}</p>
                </div>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">{entry.document.title}</h3>
                {entry.notes && (
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{entry.notes}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                  {entry.document.reference && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                      <DashboardIconSlot icon={DASHBOARD_ICONS.info} size={14} />
                      <span>{entry.document.reference}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                    <DashboardIconSlot icon={DASHBOARD_ICONS.announcements} size={14} />
                    <span>Effective {formatManilaDateTimeLabel(entry.effectiveAt)}</span>
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                    <DashboardIconSlot icon={DASHBOARD_ICONS.fare} size={14} />
                    <span>
                      {formatCurrency(entry.baseFare)} for the first {entry.baseDistanceKm} km,{' '}
                      {formatCurrency(entry.perKmRate)} per km after
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex w-full max-w-sm flex-col gap-3 lg:w-72">
                {readable && (
                  <Link
                    href={`/fare-documents/${entry.versionId}`}
                    aria-label={`Read ${entry.document.title} in the app`}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <DashboardIconSlot
                      icon={DASHBOARD_ICONS.fileText}
                      size={DASHBOARD_ICON_POLICY.sizes.button}
                      className="mr-2"
                    />
                    Read Document
                  </Link>
                )}
                <a
                  href={entry.document.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${entry.document.title} in a new tab`}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <DashboardIconSlot
                    icon={DASHBOARD_ICONS.view}
                    size={DASHBOARD_ICON_POLICY.sizes.button}
                    className="mr-2"
                  />
                  Open Document
                </a>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
