'use client'

import RoleGuard from '@/components/RoleGuard'
import VehicleRegistrationForm from '@/components/VehicleRegistrationForm'
import PageWrapper from '@/components/PageWrapper'

export default function RegisterVehiclePage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <PageWrapper 
        title="Register New Vehicle"
        subtitle="Add a new vehicle to the transportation system"
      >
        <VehicleRegistrationForm />
      </PageWrapper>
    </RoleGuard>
  )
}