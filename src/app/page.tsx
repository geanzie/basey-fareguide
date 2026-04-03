'use client'

import Link from 'next/link'

import { useAuth } from '@/components/AuthProvider'
import FareRateBanner from '@/components/FareRateBanner'
import TrafficAnnouncementsFeed from '@/components/TrafficAnnouncementsFeed'

export default function HomePage() {
  const { user } = useAuth()
  const isAuthenticated = !!user

  return (
    <>
      <section className="relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white">
        <div className="absolute inset-0 bg-black bg-opacity-10" />
        <div className="relative container mx-auto px-4 py-12 lg:py-16">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-4 text-3xl font-bold leading-tight lg:text-5xl">
              Basey Fare Guide
            </h1>

            <p className="mb-8 text-lg opacity-90 lg:text-xl">
              Official transportation fare calculator for Basey Municipality, Samar
            </p>

            <div className="mx-auto flex max-w-md flex-col justify-center gap-3 sm:flex-row">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="flex items-center justify-center rounded-lg border border-white border-opacity-30 bg-white bg-opacity-20 px-6 py-3 font-semibold backdrop-blur-sm transition-all hover:bg-opacity-30"
                >
                  Go to Dashboard & Calculator
                </Link>
              ) : (
                <Link
                  href="/auth"
                  className="flex items-center justify-center rounded-lg border border-white border-opacity-30 bg-white bg-opacity-20 px-6 py-3 font-semibold backdrop-blur-sm transition-all hover:bg-opacity-30"
                >
                  Login to Access Fare Calculator
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {!isAuthenticated && (
        <section className="border-b border-amber-100 bg-white">
          <div className="container mx-auto px-4 py-8">
            <div className="mx-auto max-w-6xl space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                  Public Announcements
                </p>
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
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">
                      Public Warning
                    </p>
                    <h3 className="mt-2 text-2xl font-bold text-red-950">Violation penalties remain in force</h3>
                    <p className="mt-2 max-w-3xl text-sm text-red-900">
                      Overcharging, fare manipulation, and other ordinance violations still carry penalties even when
                      fare changes are announced. Riders and operators should follow the published municipal rates.
                    </p>
                  </div>
                  <div className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-medium text-red-800">
                    Official municipal penalty schedule
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-red-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-red-600">1st Offense</div>
                    <div className="mt-2 text-2xl font-bold text-red-700">PHP 500</div>
                  </div>
                  <div className="rounded-xl border border-red-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-red-600">2nd Offense</div>
                    <div className="mt-2 text-2xl font-bold text-red-700">PHP 1,000</div>
                  </div>
                  <div className="rounded-xl border border-red-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-red-600">3rd Offense</div>
                    <div className="mt-2 text-2xl font-bold text-red-700">PHP 1,500</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="bg-white py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 text-center">
              <h2 className="mb-3 text-2xl font-bold text-gray-900 lg:text-3xl">Key Features</h2>
            </div>

            <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
                  <span className="text-xl">Lock</span>
                </div>
                <h3 className="mb-1 font-semibold text-gray-900">Authenticated Access</h3>
                <p className="text-sm text-gray-600">Login required for calculator</p>
              </div>

              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                  <span className="text-xl">Report</span>
                </div>
                <h3 className="mb-1 font-semibold text-gray-900">Incident Reports</h3>
                <p className="text-sm text-gray-600">Online violation reporting</p>
              </div>

              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                  <span className="text-xl">Route</span>
                </div>
                <h3 className="mb-1 font-semibold text-gray-900">95% Accuracy</h3>
                <p className="text-sm text-gray-600">Road-based routing</p>
              </div>

              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
                  <span className="text-xl">Data</span>
                </div>
                <h3 className="mb-1 font-semibold text-gray-900">Data Integrity</h3>
                <p className="text-sm text-gray-600">Legitimate user tracking</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
