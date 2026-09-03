'use client'

import Link from 'next/link'
import { use } from 'react'
import useSWR from 'swr'

import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
} from '@/components/dashboardIcons'
import OrdinancePdfPreviewShell from '@/components/OrdinancePdfPreviewShell'
import RoleGuard from '@/components/RoleGuard'
import { AUTHENTICATED_ROLES } from '@/lib/authRoutes'
import type { FareRateDocumentsResponseDto } from '@/lib/contracts'
import { isImageFareDocument, isPdfFareDocument } from '@/lib/fare/documentTypes'
import { formatManilaDateTimeLabel } from '@/lib/manilaTime'
import { SWR_KEYS } from '@/lib/swrKeys'
import PageShell from '@/ui/PageShell'

function formatCurrency(value: number) {
  return `PHP ${value.toFixed(2)}`
}

/**
 * Reader for one fare rate supporting document.
 *
 * A client component on purpose: the document route is cookie-authenticated and
 * RoleGuard runs in the browser, so there is nothing to render on the server.
 *
 * The inline preview reads `?inline=1`, which streams the bytes from our own
 * origin. The plain download link keeps the presigned redirect — pdf.js fetches
 * over XHR and would need a CORS rule on the object store, an `<a>` and an
 * `<img>` do not.
 */
export default function FareDocumentPage({
  params,
}: {
  params: Promise<{ versionId: string }>
}) {
  const { versionId } = use(params)
  const { data, error, isLoading } = useSWR<FareRateDocumentsResponseDto>(
    SWR_KEYS.fareRateDocuments,
  )

  const entry = data?.documents.find((item) => item.versionId === versionId) ?? null
  const downloadUrl = `/api/fare-rates/${versionId}/document`

  return (
    <RoleGuard allowedRoles={AUTHENTICATED_ROLES}>
      <PageShell
        title={entry?.document.title ?? 'Fare rate document'}
        subtitle="The municipal issuance behind this fare rate"
        backHref="/profile/about"
      >
        <div className="space-y-6">
          {isLoading && (
            <div className="rounded-card border border-surface-border bg-surface p-5 shadow-card">
              <p className="text-sm text-slate-500">Loading fare rate document...</p>
            </div>
          )}

          {!isLoading && (error || !entry) && (
            <div className="rounded-card border border-surface-border bg-surface p-5 shadow-card">
              <h2 className="text-lg font-semibold text-slate-900">Document not available</h2>
              <p className="mt-2 text-sm text-slate-600">
                This fare rate version has no supporting document, or it is no longer published.
              </p>
              <Link
                href="/profile/about"
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Back to About FareCheck
              </Link>
            </div>
          )}

          {entry && (
            <>
              <section className="rounded-card border border-surface-border bg-surface p-5 shadow-card lg:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                      <DashboardIconSlot icon={DASHBOARD_ICONS.fileText} size={16} />
                      <p>
                        {entry.isUpcoming
                          ? 'Takes effect soon'
                          : entry.isActive
                            ? 'Currently in force'
                            : 'Superseded'}
                      </p>
                    </div>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">
                      {entry.document.title}
                    </h2>
                    {entry.notes && (
                      <p className="mt-2 text-sm leading-6 text-slate-600">{entry.notes}</p>
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
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${entry.document.title} in a new tab`}
                      className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      <DashboardIconSlot
                        icon={DASHBOARD_ICONS.view}
                        size={DASHBOARD_ICON_POLICY.sizes.button}
                        className="mr-2"
                      />
                      Open Document
                    </a>
                    <Link
                      href="/profile/about"
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      All fare rate documents
                    </Link>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm lg:p-5">
                <div className="flex items-start gap-3">
                  <div className={getDashboardIconChipClasses('amber')}>
                    <DashboardIconSlot
                      icon={DASHBOARD_ICONS.info}
                      size={DASHBOARD_ICON_POLICY.sizes.card}
                    />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
                      Viewer Fallback
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-amber-900">
                      If the inline preview does not appear on your browser or device, use the Open
                      Document action above. The full document remains available even when inline
                      viewing is not supported.
                    </p>
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-card border border-surface-border bg-surface shadow-card">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 lg:px-6">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <DashboardIconSlot
                      icon={DASHBOARD_ICONS.fileText}
                      size={DASHBOARD_ICON_POLICY.sizes.button}
                    />
                    <span>Inline Document Preview</span>
                  </div>
                </div>

                {isPdfFareDocument(entry.document.mimeType) ? (
                  <OrdinancePdfPreviewShell pdfUrl={`${downloadUrl}?inline=1`} />
                ) : isImageFareDocument(entry.document.mimeType) ? (
                  <div className="bg-slate-100/60 p-4 lg:p-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={downloadUrl}
                      alt={entry.document.title}
                      className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white"
                    />
                  </div>
                ) : (
                  <div className="p-5 text-sm text-slate-600 lg:p-6">
                    This document cannot be previewed in the app. Use the Open Document action above.
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </PageShell>
    </RoleGuard>
  )
}
