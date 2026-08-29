'use client'

import RoleGuard from '@/components/RoleGuard'
import VehicleRegistrationForm from '@/components/VehicleRegistrationForm'
import PageShell from '@/ui/PageShell'

export default function RegisterVehiclePage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <PageShell
        title="Register New Vehicle"
        subtitle="Add a new vehicle to the transportation system"
        backHref="/encoder/vehicles"
        width="narrow"
      >
        <VehicleRegistrationForm />
      </PageShell>
    </RoleGuard>
  )
}
