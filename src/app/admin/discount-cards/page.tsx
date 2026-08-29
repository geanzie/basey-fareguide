'use client'

import { useState } from 'react'
import { List, Plus } from 'lucide-react'
import RoleGuard from '@/components/RoleGuard'
import AdminDiscountOverride from '@/components/AdminDiscountOverride'
import AdminDiscountList from '@/components/AdminDiscountList'
import PageShell from '@/ui/PageShell'

type TabType = 'list' | 'create'

export default function AdminDiscountCardsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('list')
  const [refreshKey, setRefreshKey] = useState(0)

  const handleSuccess = () => {
    setActiveTab('list')
    setRefreshKey(prev => prev + 1)
  }

  const handleCancel = () => {
    setActiveTab('list')
  }

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageShell
        title="Discount Card Management"
        subtitle="Create and manage discount cards for eligible users"
        backHref="/admin"
        band={
          <div className="mt-4 flex gap-2 overflow-x-auto py-0.5 lg:flex-wrap lg:overflow-visible">
            <button
              onClick={() => setActiveTab('list')}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'list' ? 'bg-white text-primary-dark' : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              <List className="h-4 w-4" />
              Discount Cards List
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'create' ? 'bg-white text-primary-dark' : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              <Plus className="h-4 w-4" />
              Create Discount Card
            </button>
          </div>
        }
      >
        {activeTab === 'list' && <AdminDiscountList key={refreshKey} />}
        {activeTab === 'create' && (
          <AdminDiscountOverride onSuccess={handleSuccess} onCancel={handleCancel} />
        )}
      </PageShell>
    </RoleGuard>
  )
}
