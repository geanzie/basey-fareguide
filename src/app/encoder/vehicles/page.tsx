'use client'

import RoleGuard from '@/components/RoleGuard'
import VehiclesList from '@/components/VehiclesList'
import PageWrapper, { ActionButton } from '@/components/PageWrapper'
import Link from 'next/link'

export default function VehiclesListPage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <PageWrapper 
        title="Vehicle Registry"
        subtitle="Browse and manage all registered vehicles"
        headerContent={
          <Link href="/encoder/vehicles/new">
            <ActionButton variant="primary">
              ➕ Register Vehicle
            </ActionButton>
          </Link>
        }
      >
        <VehiclesList />
      </PageWrapper>
    </RoleGuard>
  )
}