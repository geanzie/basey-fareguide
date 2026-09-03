'use client'

import RoleGuard from '@/components/RoleGuard'
import PermitManagement from '@/components/PermitManagement'
import PermitStatistics from '@/components/PermitStatistics'
import NavCard from '@/ui/NavCard'
import PageShell from '@/ui/PageShell'
import { DASHBOARD_ICONS } from '@/components/dashboardIcons'

export default function EncoderPage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <EncoderContent />
    </RoleGuard>
  )
}

function EncoderContent() {
  return (
    <PageShell
      title="Data Encoder Dashboard"
      subtitle="Manage vehicle permits for Basey Municipality"
    >
      <div className="space-y-6">
        {/*
          Permits, Vehicle Registry and Ticket Payments used to sit here too.
          All three are encoder primary tabs, so the cards were the bottom nav
          drawn a second time — and "Manage Permits" linked to a page whose
          content PermitManagement already renders further down this one.

          What is left is what the nav cannot reach: a create form, and
          /encoder/ride-access, which is in no nav list at all.
        */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NavCard
            href="/encoder/vehicles/new"
            icon={DASHBOARD_ICONS.vehicle}
            tone="blue"
            title="Register Vehicle"
            description="Add a new vehicle to the system."
          />
          <NavCard
            href="/encoder/ride-access"
            icon={DASHBOARD_ICONS.routes}
            tone="emerald"
            title="Ride Access"
            description="Mark which places a ride can reach."
          />
        </div>

        <PermitStatistics />
        <PermitManagement />
      </div>
    </PageShell>
  )
}
