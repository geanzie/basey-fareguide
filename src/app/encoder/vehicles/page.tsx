'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'

import RoleGuard from '@/components/RoleGuard'
import VehiclesList from '@/components/VehiclesList'
import Button from '@/ui/Button'
import PageShell from '@/ui/PageShell'

export default function VehiclesListPage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <PageShell
        title="Vehicle Registry"
        subtitle="Browse and manage all registered vehicles"
        right={
          <Link href="/encoder/vehicles/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              <span className="sm:hidden">Register</span>
              <span className="hidden sm:inline">Register Vehicle</span>
            </Button>
          </Link>
        }
      >
        <VehiclesList />
      </PageShell>
    </RoleGuard>
  )
}
