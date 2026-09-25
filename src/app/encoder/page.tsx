'use client'

import RoleGuard from '@/components/RoleGuard'
import EncoderControlCenter from '@/components/encoder-operations/EncoderControlCenter'
import NavCard from '@/ui/NavCard'
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
    <EncoderControlCenter
      title="Encoder Control Center"
      subtitle="Registrations, permits, stickers and ticket payments for Basey Municipality"
    >
      {/*
        The home page is overview only. The permit list and its statistics
        live on /encoder/permits, which the bottom nav already reaches; they
        used to be drawn here a second time.

        What is left below is what the nav cannot reach: a create form, and
        /encoder/ride-access, which is in no nav list at all.
      */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
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
    </EncoderControlCenter>
  )
}
