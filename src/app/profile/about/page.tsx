'use client'

import Link from 'next/link'

import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
} from '@/components/dashboardIcons'
import FareRateBanner from '@/components/FareRateBanner'
import FareRateDocumentsSection from '@/components/FareRateDocumentsSection'
import RoleGuard from '@/components/RoleGuard'
import TrafficAnnouncementsFeed from '@/components/TrafficAnnouncementsFeed'
import { AUTHENTICATED_ROLES } from '@/lib/authRoutes'
import { PUBLIC_PENALTY_SCHEDULE } from '@/lib/incidents/penaltyRules'
import { ordinanceResource } from '@/lib/ordinanceResource'
import PageShell from '@/ui/PageShell'

export default function AboutPage() {
  return (
    <RoleGuard allowedRoles={AUTHENTICATED_ROLES}>
      <PageShell
        title="About Basey FareCheck"
        subtitle="How fares work, municipal notices, and the governing ordinance"
        backHref="/profile"
      >
        <div className="space-y-6">
          <div className="rounded-card border border-surface-border bg-surface p-5 shadow-card">
            <p className="text-sm leading-6 text-slate-600">
              Basey Fare Check is the fare and distance guide for commuters in Basey, Samar. It
              publishes the fares approved by the municipality, the traffic notices in force, and
              the ordinance those rules come from.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-700">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
                <DashboardIconSlot icon={DASHBOARD_ICONS.routes} size={DASHBOARD_ICON_POLICY.sizes.button} />
                <span>Route-based fare estimates</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
                <DashboardIconSlot icon={DASHBOARD_ICONS.announcements} size={DASHBOARD_ICON_POLICY.sizes.button} />
                <span>Municipal traffic notices</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
                <DashboardIconSlot icon={DASHBOARD_ICONS.incidents} size={DASHBOARD_ICON_POLICY.sizes.button} />
                <span>Incident reporting tools</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                <DashboardIconSlot icon={DASHBOARD_ICONS.announcements} size={16} />
                <p>Public Announcements</p>
              </div>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Municipal updates for Basey riders
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Traffic advisories, fare updates, and ordinance-backed warnings are posted here so commuters
                can review the newest official notices in one place.
              </p>
            </div>

            <TrafficAnnouncementsFeed
              title="Traffic Announcements"
              description="Newest traffic advisories, closures, and transport notices from the municipality."
            />

            <FareRateBanner
              variant="announcement"
              title="Fare Announcement"
              description="Current fare rules and the next approved change for Basey municipal transport."
            />

            <div className="rounded-card border border-red-200 bg-red-50 p-6 shadow-card">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-700">
                    <DashboardIconSlot icon={DASHBOARD_ICONS.reports} size={16} />
                    <p>Public Warning</p>
                  </div>
                  <h3 className="mt-2 text-2xl font-bold text-red-950">Violation penalties remain in force</h3>
                  <p className="mt-2 max-w-3xl text-sm text-red-900">
                    Overcharging, fare manipulation, and other ordinance violations still carry penalties even when
                    fare changes are announced. Riders and operators should follow the published municipal rates.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-card border border-danger-softBorder bg-surface px-4 py-3 text-sm font-medium text-danger">
                  <DashboardIconSlot icon={DASHBOARD_ICONS.fare} size={DASHBOARD_ICON_POLICY.sizes.button} />
                  Official municipal penalty schedule
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {PUBLIC_PENALTY_SCHEDULE.map((penaltyTier) => (
                  <div key={penaltyTier.offenseTier} className="rounded-card border border-danger-softBorder bg-surface p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-red-600">{penaltyTier.label}</div>
                    <div className="mt-2 text-2xl font-bold text-red-700">
                      PHP {penaltyTier.penaltyAmount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">
                <DashboardIconSlot icon={DASHBOARD_ICONS.fileText} size={16} />
                <p>Official Documents</p>
              </div>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                The issuances behind every published fare
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Each fare change is approved by the Sangguniang Bayan. The resolution or ordinance
                behind it is published here, newest first, so any rate shown in the app can be
                checked against the document that authorized it.
              </p>
            </div>

            <FareRateDocumentsSection />

            <div className="rounded-card border border-surface-border bg-surface p-5 shadow-card lg:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                    <DashboardIconSlot icon={DASHBOARD_ICONS.fileText} size={16} />
                    <p>Original Ordinance</p>
                  </div>
                  <h3 className="mt-2 text-2xl font-bold text-slate-900">
                    {ordinanceResource.shortTitle}
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    {ordinanceResource.summary}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                      <DashboardIconSlot icon={DASHBOARD_ICONS.info} size={14} />
                      <span>{ordinanceResource.effectiveLabel}</span>
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                      <DashboardIconSlot icon={DASHBOARD_ICONS.file} size={14} />
                      <span>PDF document</span>
                    </span>
                  </div>
                </div>

                <div className="flex w-full max-w-sm flex-col gap-3 lg:w-72">
                  <Link
                    href="/ordinance"
                    aria-label={`Read ${ordinanceResource.shortTitle} details and preview page`}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <DashboardIconSlot
                      icon={DASHBOARD_ICONS.fileText}
                      size={DASHBOARD_ICON_POLICY.sizes.button}
                      className="mr-2"
                    />
                    Read Ordinance
                  </Link>
                  <a
                    href={ordinanceResource.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${ordinanceResource.shortTitle} PDF in a new tab`}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <DashboardIconSlot
                      icon={DASHBOARD_ICONS.view}
                      size={DASHBOARD_ICON_POLICY.sizes.button}
                      className="mr-2"
                    />
                    Open PDF
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageShell>
    </RoleGuard>
  )
}
