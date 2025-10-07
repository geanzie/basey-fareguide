'use client'

import { useState, useEffect } from 'react'
import { PermitStatus, VehicleType } from '@/generated/prisma'

interface PermitStats {
  total: number
  active: number
  expired: number
  suspended: number
  revoked: number
  tricycles: number
  habalHabal: number
  expiringSoon: number
}

export default function PermitStatistics() {
  const [stats, setStats] = useState<PermitStats>({
    total: 0,
    active: 0,
    expired: 0,
    suspended: 0,
    revoked: 0,
    tricycles: 0,
    habalHabal: 0,
    expiringSoon: 0
  })
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      setLoading(true)
      
      // Fetch all permits to calculate statistics
      const token = localStorage.getItem('token')
      const response = await fetch('/api/permits?limit=1000', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        const permits = data.permits
        
        const today = new Date()
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(today.getDate() + 30)
        
        const newStats = {
          total: permits.length,
          active: permits.filter((p: any) => p.status === PermitStatus.ACTIVE).length,
          expired: permits.filter((p: any) => p.status === PermitStatus.EXPIRED).length,
          suspended: permits.filter((p: any) => p.status === PermitStatus.SUSPENDED).length,
          revoked: permits.filter((p: any) => p.status === PermitStatus.REVOKED).length,
          tricycles: permits.filter((p: any) => p.vehicleType === VehicleType.TRICYCLE).length,
          habalHabal: permits.filter((p: any) => p.vehicleType === VehicleType.HABAL_HABAL).length,
          expiringSoon: permits.filter((p: any) => {
            const expiryDate = new Date(p.expiryDate)
            return expiryDate <= thirtyDaysFromNow && expiryDate > today
          }).length
        }
        
        setStats(newStats)
      }
    } catch (error) {
      console.error('Error fetching permit statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const StatCard = ({ title, value, color, icon }: { title: string, value: number, color: string, icon: string }) => (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-3xl font-bold ${color}`}>
            {loading ? '...' : value.toLocaleString()}
          </p>
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Permit Statistics</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Permits"
            value={stats.total}
            color="text-gray-900"
            icon="📋"
          />
          
          <StatCard
            title="Active Permits"
            value={stats.active}
            color="text-green-600"
            icon="✅"
          />
          
          <StatCard
            title="Expired Permits"
            value={stats.expired}
            color="text-red-600"
            icon="⚠️"
          />
          
          <StatCard
            title="Expiring Soon"
            value={stats.expiringSoon}
            color="text-yellow-600"
            icon="⏰"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <StatCard
            title="Tricycles"
            value={stats.tricycles}
            color="text-blue-600"
            icon="🛺"
          />
          
          <StatCard
            title="Habal-habal"
            value={stats.habalHabal}
            color="text-purple-600"
            icon="🏍️"
          />
          
          <StatCard
            title="Suspended/Revoked"
            value={stats.suspended + stats.revoked}
            color="text-orange-600"
            icon="🚫"
          />
        </div>
      </div>
    </div>
  )
}