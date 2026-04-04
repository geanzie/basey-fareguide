'use client'

import Link from 'next/link'

import { useAuth } from '@/components/AuthProvider'
import BrandMark from '@/components/BrandMark'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
} from '@/components/dashboardIcons'
import FareRateBanner from '@/components/FareRateBanner'
import TrafficAnnouncementsFeed from '@/components/TrafficAnnouncementsFeed'

export default function HomePage() {
  const { user } = useAuth()
  const isAuthenticated = !!user

  return (
    <div className="app-page-bg">
      <section className="relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white">
        <div className="absolute inset-0 bg-black bg-opacity-10" />
        <div className="relative container mx-auto px-4 py-12 lg:py-16">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-5 flex items-center justify-center gap-3">
              <BrandMark />
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm">
                <DashboardIconSlot icon={DASHBOARD_ICONS.fare} size={DASHBOARD_ICON_POLICY.sizes.button} />
                <span>Official municipal transport guide</span>
              </div>
            </div>

            <h1 className="mb-4 text-3xl font-bold leading-tight lg:text-5xl">
              Basey Fare Check
            </h1>

            <p className="mb-8 text-lg opacity-90 lg:text-xl">
              Official transportation fare calculator for Basey Municipality, Samar
            </p>

            <div className="mx-auto mb-8 flex max-w-2xl flex-wrap items-center justify-center gap-3 text-sm text-white/90">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
                <DashboardIconSlot icon={DASHBOARD_ICONS.routes} size={DASHBOARD_ICON_POLICY.sizes.button} />
                <span>Route-based fare estimates</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
                <DashboardIconSlot icon={DASHBOARD_ICONS.announcements} size={DASHBOARD_ICON_POLICY.sizes.button} />
                <span>Municipal traffic notices</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
                <DashboardIconSlot icon={DASHBOARD_ICONS.incidents} size={DASHBOARD_ICON_POLICY.sizes.button} />
                <span>Incident reporting tools</span>
              </div>
            </div>

            <div className="mx-auto flex max-w-md flex-col justify-center gap-3 sm:flex-row">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="flex items-center justify-center rounded-lg border border-white border-opacity-30 bg-white bg-opacity-20 px-6 py-3 font-semibold backdrop-blur-sm transition-all hover:bg-opacity-30"
                >
                  <DashboardIconSlot icon={DASHBOARD_ICONS.dashboard} size={DASHBOARD_ICON_POLICY.sizes.button} className="mr-2" />
                  Go to Dashboard & Calculator
                </Link>
              ) : (
                <Link
                  href="/auth"
                  className="flex items-center justify-center rounded-lg border border-white border-opacity-30 bg-white bg-opacity-20 px-6 py-3 font-semibold backdrop-blur-sm transition-all hover:bg-opacity-30"
                >
                  <DashboardIconSlot icon={DASHBOARD_ICONS.user} size={DASHBOARD_ICON_POLICY.sizes.button} className="mr-2" />
                  Login to Access Fare Calculator
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {!isAuthenticated && (
        <section className="app-page-bg border-b border-amber-100/70">
          <div className="container mx-auto px-4 py-8">
            <div className="mx-auto max-w-6xl space-y-4">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                  <DashboardIconSlot icon={DASHBOARD_ICONS.announcements} size={16} />
                  <p>Public Announcements</p>
                </div>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  Official municipal updates for Basey riders
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-600">
                  Traffic advisories, fare updates, and ordinance-backed warnings are posted here so commuters
                  can review the newest official notices in one place.
                </p>
              </div>

              <TrafficAnnouncementsFeed
                variant="landing"
                title="Traffic Announcements"
                description="Newest traffic advisories, closures, and transport notices from the municipality."
              />

              <FareRateBanner
                variant="announcement"
                title="Official Fare Announcement"
                description="Current fare rules and the next approved change for Basey municipal transport."
              />

              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
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
                  <div className="app-surface-inner inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-800">
                    <DashboardIconSlot icon={DASHBOARD_ICONS.fare} size={DASHBOARD_ICON_POLICY.sizes.button} />
                    Official municipal penalty schedule
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="app-surface-inner rounded-xl border border-red-200 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-red-600">1st Offense</div>
                    <div className="mt-2 text-2xl font-bold text-red-700">PHP 500</div>
                  </div>
                  <div className="app-surface-inner rounded-xl border border-red-200 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-red-600">2nd Offense</div>
                    <div className="mt-2 text-2xl font-bold text-red-700">PHP 1,000</div>
                  </div>
                  <div className="app-surface-inner rounded-xl border border-red-200 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-red-600">3rd Offense</div>
                    <div className="mt-2 text-2xl font-bold text-red-700">PHP 1,500</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="app-page-bg py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 text-center">
              <h2 className="mb-3 text-2xl font-bold text-gray-900 lg:text-3xl">Key Features</h2>
            </div>

            <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="app-surface-card rounded-2xl p-5 text-center">
                <div className={`mx-auto mb-3 ${getDashboardIconChipClasses('emerald')} h-12 w-12`}>
                  <DashboardIconSlot icon={DASHBOARD_ICONS.user} size={DASHBOARD_ICON_POLICY.sizes.card} />
                </div>
                <h3 className="mb-1 font-semibold text-gray-900">Authenticated Access</h3>
                <p className="text-sm text-gray-600">Login required for calculator</p>
              </div>

              <div className="app-surface-card rounded-2xl p-5 text-center">
                <div className={`mx-auto mb-3 ${getDashboardIconChipClasses('red')} h-12 w-12`}>
                  <DashboardIconSlot icon={DASHBOARD_ICONS.incidents} size={DASHBOARD_ICON_POLICY.sizes.card} />
                </div>
                <h3 className="mb-1 font-semibold text-gray-900">Incident Reports</h3>
                <p className="text-sm text-gray-600">Online violation reporting</p>
              </div>

              <div className="app-surface-card rounded-2xl p-5 text-center">
                <div className={`mx-auto mb-3 ${getDashboardIconChipClasses('blue')} h-12 w-12`}>
                  <DashboardIconSlot icon={DASHBOARD_ICONS.routes} size={DASHBOARD_ICON_POLICY.sizes.card} />
                </div>
                <h3 className="mb-1 font-semibold text-gray-900">95% Accuracy</h3>
                <p className="text-sm text-gray-600">Road-based routing</p>
              </div>

              <div className="app-surface-card rounded-2xl p-5 text-center">
                <div className={`mx-auto mb-3 ${getDashboardIconChipClasses('amber')} h-12 w-12`}>
                  <DashboardIconSlot icon={DASHBOARD_ICONS.safe} size={DASHBOARD_ICON_POLICY.sizes.card} />
                </div>
                <h3 className="mb-1 font-semibold text-gray-900">Data Integrity</h3>
                <p className="text-sm text-gray-600">Legitimate user tracking</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
