'use client'

import { useState, useEffect } from 'react'
import { PermitStatus } from '@prisma/client'
import type { PermitDto, PermitsResponseDto } from '@/lib/contracts'
import { DASHBOARD_ICONS } from '@/components/dashboardIcons'
import StatTile from '@/ui/StatTile'

interface PermitStats {
  total: number
  active: number
  expired: number
  suspendedOrRevoked: number
  expiringSoon: number
}

/**
 * Permit counts, as one decomposition rather than three.
 *
 * This used to render seven tiles: a status split (active / expired /
 * suspended / revoked), a vehicle-type split (tricycle / habal-habal), and the
 * total above both — the same population carved up twice with its size printed
 * a third time. The vehicle split answers a permit-list question, so it belongs
 * on the list, not here.
 *
 * "Expiring soon" is deliberately not a tile: a permit expiring within 30 days
 * is still ACTIVE, so as a peer of the status tiles it was silently counted
 * twice. It rides along on Active instead, which is where it is true.
 */
export default function PermitStatistics() {
  const [stats, setStats] = useState<PermitStats>({
    total: 0,
    active: 0,
    expired: 0,
    suspendedOrRevoked: 0,
    expiringSoon: 0,
  })
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/permits?limit=1000')
      if (response.ok) {
        const data: PermitsResponseDto = await response.json()
        const permits: PermitDto[] = data.permits

        const today = new Date()
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(today.getDate() + 30)

        setStats({
          total: permits.length,
          active: permits.filter((p: PermitDto) => p.status === PermitStatus.ACTIVE).length,
          expired: permits.filter((p: PermitDto) => p.status === PermitStatus.EXPIRED).length,
          suspendedOrRevoked: permits.filter(
            (p: PermitDto) =>
              p.status === PermitStatus.SUSPENDED || p.status === PermitStatus.REVOKED,
          ).length,
          expiringSoon: permits.filter((p: PermitDto) => {
            const expiryDate = new Date(p.expiryDate)
            return expiryDate <= thirtyDaysFromNow && expiryDate > today
          }).length,
        })
      }
    } catch (_error) {
      // Preserve current fallback behavior.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const show = (value: number) => (loading ? '...' : value.toLocaleString())

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Permit Statistics</h3>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            label="Total Permits"
            value={show(stats.total)}
            icon={DASHBOARD_ICONS.list}
            tone="muted"
            href="/encoder/permits"
          />
          <StatTile
            label="Active Permits"
            value={show(stats.active)}
            detail={
              loading || stats.expiringSoon === 0
                ? undefined
                : `${stats.expiringSoon} expiring within 30 days`
            }
            icon={DASHBOARD_ICONS.check}
            tone="success"
            href={`/encoder/permits?status=${PermitStatus.ACTIVE}`}
          />
          <StatTile
            label="Expired Permits"
            value={show(stats.expired)}
            icon={DASHBOARD_ICONS.reports}
            tone="danger"
            href={`/encoder/permits?status=${PermitStatus.EXPIRED}`}
          />
          {/* Static on purpose: the permit list filters by one status, so no
              view shows suspended and revoked together. An arrow here would
              promise a filter that does not exist. */}
          <StatTile
            label="Suspended / Revoked"
            value={show(stats.suspendedOrRevoked)}
            icon={DASHBOARD_ICONS.danger}
            tone="warning"
          />
        </div>
      </div>
    </div>
  )
}
