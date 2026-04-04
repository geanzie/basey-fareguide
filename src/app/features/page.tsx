import Link from 'next/link'

import BrandMark from '@/components/BrandMark'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
  type DashboardIcon,
  type DashboardIconTone,
} from '@/components/dashboardIcons'

interface FeatureCard {
  id: string
  title: string
  icon: DashboardIcon
  description: string
  features: string[]
  link: string
  tone: DashboardIconTone
}

export default function FeaturesPage() {
  const features: FeatureCard[] = [
    {
      id: 'fare-calculator',
      title: 'Fare Calculator',
      icon: DASHBOARD_ICONS.calculator,
      description: 'Calculate accurate fares using route-based or GPS tracking methods.',
      features: [
        'Route-based calculation with 95% accuracy',
        'Real-time GPS tracking for live fare computation',
        'All 51 barangays and landmarks database',
        'Municipal Ordinance 105 Series of 2023 compliance',
      ],
      link: '/',
      tone: 'emerald',
    },
    {
      id: 'incident-reporting',
      title: 'Incident Reporting',
      icon: DASHBOARD_ICONS.incidents,
      description: 'Report transportation violations with GPS and evidence.',
      features: [
        'Multiple violation types (fare, driving, vehicle)',
        'GPS location capture',
        'Photo and video evidence upload',
        'Real-time status tracking',
      ],
      link: '/report',
      tone: 'red',
    },
    {
      id: 'user-management',
      title: 'User Management',
      icon: DASHBOARD_ICONS.users,
      description: 'Comprehensive user accounts with role-based access.',
      features: [
        '4 user types: Admin, Data Encoder, Enforcer, Public',
        'Account approval workflow',
        'Profile management',
        'Password security',
      ],
      link: '/auth',
      tone: 'blue',
    },
    {
      id: 'authority-dashboard',
      title: 'Authority Dashboard',
      icon: DASHBOARD_ICONS.dashboard,
      description: 'Real-time system monitoring and management interface.',
      features: [
        'Live incident statistics',
        'User and vehicle management',
        'Penalty tracking',
        'System reports and analytics',
      ],
      link: '/dashboard',
      tone: 'amber',
    },
    {
      id: 'incident-management',
      title: 'Incident Management',
      icon: DASHBOARD_ICONS.list,
      description: 'Complete violation tracking and resolution support.',
      features: [
        'Status workflow (Pending to Investigating to Resolved)',
        'Advanced filtering and search',
        'Evidence management',
        'Penalty assignment',
      ],
      link: '/dashboard',
      tone: 'purple',
    },
    {
      id: 'traffic-enforcer',
      title: 'Traffic Enforcer',
      icon: DASHBOARD_ICONS.ticket,
      description: 'Dedicated enforcement workflow for field authorities.',
      features: [
        'FIFO incident queue (First In, First Out)',
        'Priority-based incident management',
        'Ticket number assignment system',
        'Real-time incident resolution tracking',
      ],
      link: '/enforcer',
      tone: 'violet',
    },
  ]

  const accessLevels: Array<{
    title: string
    description: string
    icon: DashboardIcon
    tone: DashboardIconTone
  }> = [
    {
      title: 'Administrator',
      description: 'Full system access, user management, and system configuration.',
      icon: DASHBOARD_ICONS.users,
      tone: 'purple',
    },
    {
      title: 'Data Encoder',
      description: 'Vehicle registration, driver data management, and validation.',
      icon: DASHBOARD_ICONS.fileText,
      tone: 'blue',
    },
    {
      title: 'Enforcer',
      description: 'Incident investigation, violation processing, and ticketing.',
      icon: DASHBOARD_ICONS.ticket,
      tone: 'red',
    },
    {
      title: 'General Public',
      description: 'Fare calculation, route planning, and incident reporting.',
      icon: DASHBOARD_ICONS.user,
      tone: 'emerald',
    },
  ]

  const getSurfaceClasses = (tone: DashboardIconTone) => {
    const tones: Record<DashboardIconTone, string> = {
      slate: 'border-slate-200 bg-slate-50',
      blue: 'border-blue-200 bg-blue-50',
      emerald: 'border-emerald-200 bg-emerald-50',
      red: 'border-red-200 bg-red-50',
      violet: 'border-violet-200 bg-violet-50',
      amber: 'border-amber-200 bg-amber-50',
      purple: 'border-purple-200 bg-purple-50',
    }

    return tones[tone]
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-3">
              <BrandMark size="sm" />
              <span className="text-xl font-bold text-gray-800">Basey Fare Check</span>
            </Link>

            <div className="flex space-x-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium"
              >
                <DashboardIconSlot icon={DASHBOARD_ICONS.home} size={DASHBOARD_ICON_POLICY.sizes.button} />
                <span>Home</span>
              </Link>
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium"
              >
                <DashboardIconSlot icon={DASHBOARD_ICONS.arrowRight} size={DASHBOARD_ICON_POLICY.sizes.button} className="-rotate-45" />
                <span>Get Started</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Complete Transportation Management
          </h1>
          <p className="text-xl text-emerald-100 mb-8 max-w-3xl mx-auto">
            Explore all features of the Basey Fare Check system, from accurate fare calculation
            to comprehensive incident management and user administration.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth"
              className="inline-flex items-center justify-center gap-2 bg-white text-emerald-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              <DashboardIconSlot icon={DASHBOARD_ICONS.user} size={DASHBOARD_ICON_POLICY.sizes.button} />
              <span>Sign Up Now</span>
            </Link>
            <Link
              href="/report"
              className="inline-flex items-center justify-center gap-2 bg-emerald-800 text-white px-8 py-3 rounded-lg font-semibold hover:bg-emerald-900 transition-colors"
            >
              <DashboardIconSlot icon={DASHBOARD_ICONS.incidents} size={DASHBOARD_ICON_POLICY.sizes.button} />
              <span>Report Incident</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">System Features</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our transportation management system brings fare calculation, reporting, and operational tools into one place.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.id}
                className={`bg-white rounded-xl shadow-lg overflow-hidden border ${getSurfaceClasses(feature.tone)} hover:shadow-xl transition-shadow`}
              >
                <div className="p-8">
                  <div className="mb-4 flex items-center gap-3">
                    <div className={getDashboardIconChipClasses(feature.tone)}>
                      <DashboardIconSlot icon={feature.icon} size={DASHBOARD_ICON_POLICY.sizes.hero} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{feature.title}</h3>
                  </div>

                  <p className="text-gray-600 mb-6">{feature.description}</p>

                  <ul className="space-y-2 mb-6">
                    {feature.features.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                        <DashboardIconSlot
                          icon={DASHBOARD_ICONS.checkmark}
                          size={DASHBOARD_ICON_POLICY.sizes.button}
                          className="mt-0.5 text-emerald-600"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={feature.link}
                    className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium gap-2"
                  >
                    <span>Try Feature</span>
                    <DashboardIconSlot icon={DASHBOARD_ICONS.arrowRight} size={DASHBOARD_ICON_POLICY.sizes.button} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">User Access Levels</h2>
            <p className="text-gray-600">Different user types with specific permissions and capabilities.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {accessLevels.map((level) => (
              <div key={level.title} className="text-center p-6 border border-gray-200 rounded-xl">
                <div className="mx-auto mb-4 flex justify-center">
                  <div className={getDashboardIconChipClasses(level.tone)}>
                    <DashboardIconSlot icon={level.icon} size={DASHBOARD_ICON_POLICY.sizes.hero} />
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{level.title}</h3>
                <p className="text-sm text-gray-600">{level.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-gray-300 mb-8 text-lg">
            Join the Transportation Fare Reference System for Basey Municipality.
            Calculate fares, report incidents, and help maintain fair transportation services.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth"
              className="inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
            >
              <DashboardIconSlot icon={DASHBOARD_ICONS.user} size={DASHBOARD_ICON_POLICY.sizes.button} />
              <span>Create Account</span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 bg-gray-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
            >
              <DashboardIconSlot icon={DASHBOARD_ICONS.calculator} size={DASHBOARD_ICON_POLICY.sizes.button} />
              <span>Try Calculator</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
