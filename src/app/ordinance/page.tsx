import type { Metadata } from 'next'
import Link from 'next/link'

import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
} from '@/components/dashboardIcons'
import OrdinancePdfPreviewShell from '@/components/OrdinancePdfPreviewShell'
import { ordinanceResource } from '@/lib/ordinanceResource'

export const metadata: Metadata = {
  title: `${ordinanceResource.shortTitle} | Basey FareCheck`,
  description: ordinanceResource.summary,
  keywords: [
    'Basey ordinance',
    'Municipal Ordinance No. 105',
    'Basey transport rules',
    'Basey fare ordinance',
  ],
  robots: {
    index: true,
    follow: true,
  },
}

export default function OrdinancePage() {
  return (
    <div className="app-page-bg min-h-screen py-10 lg:py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="app-surface-card rounded-3xl p-6 shadow-sm lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  <DashboardIconSlot icon={DASHBOARD_ICONS.fileText} size={16} />
                  <p>Public Legal Reference</p>
                </div>
                <h1 className="mt-3 text-3xl font-bold text-slate-900 lg:text-4xl">
                  {ordinanceResource.shortTitle}
                </h1>
                <p className="mt-3 text-base text-slate-700">{ordinanceResource.title}</p>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                  {ordinanceResource.summary} Review the ordinance inline when your browser supports PDF previews,
                  or open the original PDF in a new tab for the full official document.
                </p>

                <div className="mt-5 flex flex-wrap gap-2 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                    <DashboardIconSlot icon={DASHBOARD_ICONS.info} size={16} />
                    <span>{ordinanceResource.effectiveLabel}</span>
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                    <DashboardIconSlot icon={DASHBOARD_ICONS.file} size={16} />
                    <span>PDF document</span>
                  </span>
                </div>
              </div>

              <div className="flex w-full max-w-sm flex-col gap-3 lg:w-80">
                <a
                  href={ordinanceResource.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${ordinanceResource.shortTitle} PDF in a new tab`}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <DashboardIconSlot
                    icon={DASHBOARD_ICONS.view}
                    size={DASHBOARD_ICON_POLICY.sizes.button}
                    className="mr-2"
                  />
                  Open PDF
                </a>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <DashboardIconSlot
                    icon={DASHBOARD_ICONS.back}
                    size={DASHBOARD_ICON_POLICY.sizes.button}
                    className="mr-2"
                  />
                  Back to Home
                </Link>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm lg:p-5">
            <div className="flex items-start gap-3">
              <div className={getDashboardIconChipClasses('amber')}>
                <DashboardIconSlot icon={DASHBOARD_ICONS.info} size={DASHBOARD_ICON_POLICY.sizes.card} />
              </div>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
                  Viewer Fallback
                </h2>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  If the inline preview does not appear on your browser or device, use the Open PDF action above.
                  The ordinance remains fully available through the original PDF even when inline viewing is not
                  supported.
                </p>
              </div>
            </div>
          </section>

          <section className="app-surface-card overflow-hidden rounded-3xl shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 lg:px-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <DashboardIconSlot icon={DASHBOARD_ICONS.fileText} size={DASHBOARD_ICON_POLICY.sizes.button} />
                <span>Inline Ordinance Preview</span>
              </div>
            </div>

            <OrdinancePdfPreviewShell pdfUrl={ordinanceResource.pdfUrl} />
          </section>
        </div>
      </div>
    </div>
  )
}