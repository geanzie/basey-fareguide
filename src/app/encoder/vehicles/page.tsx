'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'

import RoleGuard from '@/components/RoleGuard'
import VehiclesList from '@/components/VehiclesList'
import Button from '@/ui/Button'
import GradientHeader from '@/ui/GradientHeader'

export default function VehiclesListPage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <div className="mx-auto max-w-6xl">
        <GradientHeader
          title="Vehicle Registry"
          subtitle="Browse and manage all registered vehicles"
          compact
          right={
            <Link href="/encoder/vehicles/new">
              <Button size="sm">
                <Plus className="h-4 w-4" />
                <span className="sm:hidden">Register</span>
                <span className="hidden sm:inline">Register Vehicle</span>
              </Button>
            </Link>
          }
        />
        <div className="-mt-6 px-4 pb-8 lg:px-8">
          <VehiclesList />
        </div>
      </div>
    </RoleGuard>
  )
}
