'use client'

import Link from 'next/link'

import PageWrapper, { ActionButton } from '@/components/PageWrapper'
import RoleGuard from '@/components/RoleGuard'
import VehiclesList from '@/components/VehiclesList'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
} from '@/components/dashboardIcons'

export default function VehiclesListPage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <PageWrapper
        title="Vehicle Registry"
        subtitle="Browse and manage all registered vehicles"
        headerContent={(
          <Link href="/encoder/vehicles/new">
            <ActionButton variant="primary">
              <DashboardIconSlot icon={DASHBOARD_ICONS.plus} size={DASHBOARD_ICON_POLICY.sizes.button} className="mr-2" />
              <span className="sm:hidden">Register</span>
              <span className="hidden sm:inline">Register Vehicle</span>
            </ActionButton>
          </Link>
        )}
      >
        <VehiclesList />
      </PageWrapper>
    </RoleGuard>
  )
}
