'use client'

import type { FormEvent, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import useSWR, { useSWRConfig } from 'swr'
import ResponsiveTable, { ActionButton, StatusBadge } from './ResponsiveTable'
import { useAuth } from '@/components/AuthProvider'
import EvidenceManager from './EvidenceManager'
import type {
  EnforcerIncidentScope,
  EnforcerIncidentsViewMode,
  IncidentListItemDto,
  IncidentsResponseDto,
  TerminalIncidentHandoffSnapshotDto,
} from '@/lib/contracts'
import { clearQrTerminalHandoff, readQrTerminalHandoff } from '@/lib/terminal/handoff'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
  type DashboardIcon,
  type DashboardIconTone,
} from '@/components/dashboardIcons'

interface TicketFormState {
  ticketNumber: string
  remarks: string
}

interface TicketPenaltyPreview {
  penaltyAmount: number
  currentPenaltyAmount: number
  carriedForwardPenaltyAmount: number
  offenseNumber: number
  offenseTier: 'FIRST' | 'SECOND' | 'THIRD_PLUS'
  offenseTierLabel: string
  priorTicketCount: number
  priorUnpaidTicketCount: number
  ruleVersion: string
}

interface ActionNotice {
  tone: 'success' | 'error'
  title: string
  message: string
}

type EnforcerStatusFilter = 'ALL' | 'PENDING' | 'TICKET_ISSUED' | 'RESOLVED'

const QUEUE_STATUS_FILTERS = ['ALL', 'PENDING', 'TICKET_ISSUED'] as const satisfies readonly EnforcerStatusFilter[]

const DASHBOARD_STATUS_FILTERS = ['ALL', 'PENDING', 'TICKET_ISSUED', 'RESOLVED'] as const satisfies readonly EnforcerStatusFilter[]

const UNRESOLVED_INCIDENT_STATUSES = ['PENDING', 'TICKET_ISSUED'] as const
const EVIDENCE_ASSIGNMENT_NOTICE = 'Evidence is only accessible to the enforcer or admin.'
const INCIDENT_LIST_CACHE_KEYS = [
  '/api/incidents/enforcer?scope=all&mode=dashboard',
  '/api/incidents/enforcer?scope=unresolved&mode=queue',
] as const

const ALLOWED_STATUS_FILTERS: Record<EnforcerIncidentsViewMode, readonly EnforcerStatusFilter[]> = {
  dashboard: DASHBOARD_STATUS_FILTERS,
  queue: QUEUE_STATUS_FILTERS,
}

const STATUS_TABS: Record<EnforcerIncidentsViewMode, Array<{ key: EnforcerStatusFilter; label: string }>> = {
  dashboard: [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'TICKET_ISSUED', label: 'Ticket Issued' },
    { key: 'RESOLVED', label: 'Resolved' },
  ],
  queue: [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'TICKET_ISSUED', label: 'Ticket Issued' },
  ],
}

interface EnforcerIncidentsListProps {
  mode: EnforcerIncidentsViewMode
  embeddedQrHandoffSnapshot?: TerminalIncidentHandoffSnapshotDto | null
  onWorkflowComplete?: () => void
}

function ActionLabel({
  children,
  icon,
  iconClassName = '',
}: {
  children: ReactNode
  icon: DashboardIcon
  iconClassName?: string
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <DashboardIconSlot
        icon={icon}
        size={DASHBOARD_ICON_POLICY.sizes.button}
        className={iconClassName}
      />
      <span>{children}</span>
    </span>
  )
}

function DetailField({
  label,
  value,
  fullWidth = false,
  valueClassName = '',
}: {
  label: string
  value: ReactNode
  fullWidth?: boolean
  valueClassName?: string
}) {
  return (
    <div className={fullWidth ? 'sm:col-span-2 xl:col-span-4' : ''}>
      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{label}</dt>
      <dd className={`mt-1 text-sm font-medium leading-relaxed text-gray-900 ${valueClassName}`.trim()}>{value}</dd>
    </div>
  )
}

export default function EnforcerIncidentsList({
  mode,
  embeddedQrHandoffSnapshot,
  onWorkflowComplete,
}: EnforcerIncidentsListProps) {
  const searchParams = useSearchParams()
  const { mutate: mutateCache } = useSWRConfig()
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState<EnforcerStatusFilter>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [qrHandoffSnapshot, setQrHandoffSnapshot] = useState<TerminalIncidentHandoffSnapshotDto | null>(null)
  const [qrHandoffNotice, setQrHandoffNotice] = useState<string | null>(null)
  const [selectedIncident, setSelectedIncident] = useState<IncidentListItemDto | null>(null)
  const [showIncidentDetails, setShowIncidentDetails] = useState(false)
  const [evidenceIncidentId, setEvidenceIncidentId] = useState<string | null>(null)
  const [evidenceIncident, setEvidenceIncident] = useState<IncidentListItemDto | null>(null)
  const [showEvidenceManager, setShowEvidenceManager] = useState(false)
  const [ticketIncident, setTicketIncident] = useState<IncidentListItemDto | null>(null)
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [ticketPenaltyPreview, setTicketPenaltyPreview] = useState<TicketPenaltyPreview | null>(null)
  const [isTicketPenaltyLoading, setIsTicketPenaltyLoading] = useState(false)
  const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null)
  const [ticketData, setTicketData] = useState<TicketFormState>({
    ticketNumber: '',
    remarks: '',
  })

  const isQueueMode = mode === 'queue'
  const isEmbeddedQueueMode = isQueueMode && embeddedQrHandoffSnapshot !== undefined
  const requestScope: EnforcerIncidentScope = isQueueMode ? 'unresolved' : 'all'
  const swrKey = `/api/incidents/enforcer?scope=${requestScope}&mode=${mode}`
  const allowedStatusFilters = ALLOWED_STATUS_FILTERS[mode]
  const statusTabs = STATUS_TABS[mode]

  const { data, error, isLoading, mutate } = useSWR<IncidentsResponseDto>(swrKey)
  const incidents = data?.incidents || []

  const revalidateIncidentLists = async () => {
    await Promise.all([
      mutate(),
      ...INCIDENT_LIST_CACHE_KEYS.map((cacheKey) => mutateCache(cacheKey)),
    ])
  }

  useEffect(() => {
    if (!isQueueMode) {
      return
    }

    if (!allowedStatusFilters.includes(statusFilter)) {
      setStatusFilter('ALL')
    }
  }, [allowedStatusFilters, isQueueMode, statusFilter])

  useEffect(() => {
    if (!actionNotice) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setActionNotice(null)
    }, actionNotice.tone === 'success' ? 4500 : 6000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [actionNotice])

  useEffect(() => {
    if (mode !== 'queue') {
      return
    }

    if (embeddedQrHandoffSnapshot !== undefined) {
      if (!embeddedQrHandoffSnapshot) {
        setQrHandoffSnapshot(null)
        setQrHandoffNotice('QR handoff data was not available. Return to the QR terminal result and retry the enforcement workflow.')
        return
      }

      if (!embeddedQrHandoffSnapshot.vehicle) {
        setQrHandoffSnapshot(null)
        setQrHandoffNotice('QR handoff did not include a vehicle. Return to the QR terminal result and re-scan before continuing.')
        return
      }

      setQrHandoffNotice(null)
      setQrHandoffSnapshot(embeddedQrHandoffSnapshot)
      return
    }

    if (searchParams.get('qrHandoff') !== '1') {
      return
    }

    const snapshot = readQrTerminalHandoff()

    if (!snapshot) {
      clearQrTerminalHandoff()
      setQrHandoffSnapshot(null)
      setQrHandoffNotice('QR handoff data was not available. Return to the QR terminal and retry the incident handoff.')
      return
    }

    if (!snapshot.vehicle) {
      clearQrTerminalHandoff()
      setQrHandoffSnapshot(null)
      setQrHandoffNotice('QR handoff did not include a vehicle. Re-scan the permit in the QR terminal before opening the queue.')
      return
    }

    const handoffVehicle = snapshot.vehicle

    setQrHandoffNotice(null)
    setQrHandoffSnapshot(snapshot)
    setSearchQuery((current) => current || handoffVehicle.plateNumber || '')
  }, [embeddedQrHandoffSnapshot, mode, searchParams])

  const showActionNotice = (tone: ActionNotice['tone'], title: string, message: string) => {
    setActionNotice({ tone, title, message })
  }

  const scopedIncidents = useMemo(() => {
    if (!isQueueMode) {
      return incidents
    }

    return incidents.filter((incident) =>
      UNRESOLVED_INCIDENT_STATUSES.includes(incident.status as (typeof UNRESOLVED_INCIDENT_STATUSES)[number]),
    )
  }, [incidents, isQueueMode])

  const embeddedPlateNumber = isEmbeddedQueueMode ? qrHandoffSnapshot?.vehicle?.plateNumber?.trim().toLowerCase() || '' : ''

  const filteredIncidents = useMemo(() => {
    return scopedIncidents.filter((incident) => {
      const matchesStatus = statusFilter === 'ALL' || incident.status === statusFilter

      if (isEmbeddedQueueMode) {
        const incidentPlateNumber = incident.plateNumber?.trim().toLowerCase() || ''
        return Boolean(matchesStatus && embeddedPlateNumber && incidentPlateNumber === embeddedPlateNumber)
      }

      if (!searchQuery.trim()) {
        return matchesStatus
      }

      const query = searchQuery.toLowerCase()
      const matchesSearch =
        incident.plateNumber?.toLowerCase().includes(query) ||
        incident.location?.toLowerCase().includes(query) ||
        incident.description?.toLowerCase().includes(query) ||
        incident.ticketNumber?.toLowerCase().includes(query) ||
        incident.type?.toLowerCase().includes(query) ||
        incident.driverLicense?.toLowerCase().includes(query) ||
        `${incident.reportedBy?.firstName || ''} ${incident.reportedBy?.lastName || ''}`.toLowerCase().includes(query)

      return Boolean(matchesStatus && matchesSearch)
    })
  }, [embeddedPlateNumber, isEmbeddedQueueMode, scopedIncidents, searchQuery, statusFilter])

  const stats = useMemo(
    () => ({
      total: scopedIncidents.length,
      pending: scopedIncidents.filter((incident) => incident.status === 'PENDING').length,
      forReview: scopedIncidents.filter((incident) => incident.status === 'PENDING' && !incident.evidenceVerifiedAt).length,
      readyForTicket: scopedIncidents.filter((incident) => incident.status === 'PENDING' && incident.evidenceVerifiedAt).length,
      ticketIssued: scopedIncidents.filter((incident) => incident.status === 'TICKET_ISSUED').length,
      resolved: scopedIncidents.filter((incident) => incident.status === 'RESOLVED').length,
    }),
    [scopedIncidents],
  )

  const getStatusTabCount = (filter: EnforcerStatusFilter) => {
    switch (filter) {
      case 'ALL':
        return stats.total
      case 'PENDING':
        return stats.pending
      case 'TICKET_ISSUED':
        return stats.ticketIssued
      case 'RESOLVED':
        return stats.resolved
      default:
        return 0
    }
  }

  const openTicketModal = async (incident: IncidentListItemDto) => {
    setTicketIncident(incident)
    setTicketData({
      ticketNumber: '',
      remarks: '',
    })
    setTicketPenaltyPreview(null)
    setIsTicketPenaltyLoading(true)
    setShowTicketModal(true)

    try {
      const response = await fetch(`/api/incidents/${incident.id}/issue-ticket`)
      const payload = await response.json()

      if (!response.ok) {
        closeTicketModal()
        showActionNotice('error', 'Unable to load ticket details', payload.message || 'Failed to load ticket penalty details.')
        return
      }

      setTicketPenaltyPreview(payload.penalty ?? null)
    } catch (_error) {
      closeTicketModal()
      showActionNotice('error', 'Unable to load ticket details', 'Error loading ticket penalty details. Please try again.')
    } finally {
      setIsTicketPenaltyLoading(false)
    }
  }

  const closeTicketModal = () => {
    setShowTicketModal(false)
    setTicketIncident(null)
    setTicketPenaltyPreview(null)
    setIsTicketPenaltyLoading(false)
    setTicketData({
      ticketNumber: '',
      remarks: '',
    })
  }

  const handleDismissIncident = async (incident: IncidentListItemDto) => {
    let remarks = window.prompt('Dismissal remarks (required):', '')

    while (remarks !== null && remarks.trim() === '') {
      remarks = window.prompt('Remarks cannot be blank. Enter dismissal remarks:', '')
    }

    if (remarks === null) {
      return
    }

    try {
      const response = await fetch(`/api/incidents/${incident.id}/dismiss`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissRemarks: remarks }),
      })
      const payload = await response.json()

      if (!response.ok) {
        showActionNotice('error', 'Unable to dismiss incident', payload.message || 'Failed to dismiss incident.')
        return
      }

      showActionNotice('success', 'Incident dismissed', payload.message || 'Incident dismissed.')
      if (selectedIncident?.id === incident.id) {
        closeIncidentDetails()
      }
      await revalidateIncidentLists()
      onWorkflowComplete?.()
    } catch (_error) {
      showActionNotice('error', 'Unable to dismiss incident', 'Error dismissing incident. Please try again.')
    }
  }

  const handleTicketSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (!ticketIncident || !ticketData.ticketNumber) {
      showActionNotice('error', 'Ticket number required', 'Please complete the ticket number.')
      return
    }

    if (!ticketPenaltyPreview) {
      showActionNotice('error', 'Penalty details unavailable', 'Penalty details are still loading. Please try again.')
      return
    }

    try {
      const response = await fetch(`/api/incidents/${ticketIncident.id}/issue-ticket`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketNumber: ticketData.ticketNumber,
          remarks: ticketData.remarks,
        }),
      })
      const payload = await response.json()

      if (!response.ok) {
        showActionNotice('error', 'Unable to issue ticket', payload.message || 'Failed to issue ticket.')
        return
      }

      showActionNotice('success', 'Ticket issued', payload.message || 'Ticket issued successfully.')
      closeTicketModal()
      closeIncidentDetails()
      await revalidateIncidentLists()
      onWorkflowComplete?.()
    } catch (_error) {
      showActionNotice('error', 'Unable to issue ticket', 'Error issuing ticket. Please try again.')
    }
  }

  const closeIncidentDetails = useCallback(() => {
    setShowIncidentDetails(false)
    setSelectedIncident(null)
  }, [])

  const closeEvidenceManager = useCallback(() => {
    setShowEvidenceManager(false)
    setEvidenceIncidentId(null)
    setEvidenceIncident(null)
  }, [])

  // Sync selectedIncident with fresh SWR data so the details modal never shows stale status.
  useEffect(() => {
    if (!selectedIncident) return
    const fresh = incidents.find((i) => i.id === selectedIncident.id)
    if (!fresh) {
      closeIncidentDetails()
      return
    }
    setSelectedIncident(fresh)
  }, [incidents, selectedIncident?.id, closeIncidentDetails])

  // Sync evidenceIncident so EvidenceManager receives the latest incidentVerifiedAt.
  useEffect(() => {
    if (!evidenceIncident) return
    const fresh = incidents.find((i) => i.id === evidenceIncident.id)
    if (fresh) setEvidenceIncident(fresh)
  }, [incidents, evidenceIncident?.id])

  const canAccessIncidentEvidence = (_incident: IncidentListItemDto) =>
    user?.userType === 'ADMIN' || user?.userType === 'ENFORCER'

  const openEvidenceManager = (incident: IncidentListItemDto) => {
    if (!canAccessIncidentEvidence(incident)) {
      showActionNotice('error', 'Evidence unavailable', EVIDENCE_ASSIGNMENT_NOTICE)
      return
    }

    setEvidenceIncidentId(incident.id)
    setEvidenceIncident(incident)
    setShowEvidenceManager(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'TICKET_ISSUED':
        return 'bg-amber-100 text-amber-800'
      case 'RESOLVED':
        return 'bg-green-100 text-green-800'
      case 'DISMISSED':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const getTimeElapsed = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-300 rounded-lg p-6">
        <div className="mb-2 flex items-center gap-2">
          <DashboardIconSlot
            icon={DASHBOARD_ICONS.reports}
            size={DASHBOARD_ICON_POLICY.sizes.alert}
            className="text-red-700"
          />
          <h3 className="text-lg font-semibold text-red-800">Failed to load incidents</h3>
        </div>
        <p className="text-red-700 mb-3">
          {error.message || 'Unable to retrieve incident reports. Please try again.'}
        </p>
        <button
          onClick={() => mutate()}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-semibold"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {actionNotice ? (
        <div className="fixed inset-x-4 top-4 z-[60] flex justify-center sm:left-auto sm:right-4 sm:inset-x-auto sm:w-full sm:max-w-md">
          <div
            role={actionNotice.tone === 'error' ? 'alert' : 'status'}
            aria-live={actionNotice.tone === 'error' ? 'assertive' : 'polite'}
            className={`app-surface-overlay w-full rounded-2xl border px-4 py-3 shadow-2xl ${
              actionNotice.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50/95 text-emerald-900'
                : 'border-red-200 bg-red-50/95 text-red-900'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  actionNotice.tone === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}
              >
                <DashboardIconSlot
                  icon={actionNotice.tone === 'success' ? DASHBOARD_ICONS.check : DASHBOARD_ICONS.reports}
                  size={DASHBOARD_ICON_POLICY.sizes.button}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{actionNotice.title}</p>
                <p className="mt-1 text-sm leading-6">{actionNotice.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setActionNotice(null)}
                className="rounded-full p-1 text-current/70 transition hover:bg-white/70 hover:text-current"
                aria-label="Dismiss notification"
              >
                <DashboardIconSlot icon={DASHBOARD_ICONS.close} size={DASHBOARD_ICON_POLICY.sizes.button} />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!isQueueMode ? (
        <div className="app-surface-card-strong rounded-3xl">
          <div className="px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex items-start gap-4">
              <div className={getDashboardIconChipClasses('red')}>
                <DashboardIconSlot
                  icon={DASHBOARD_ICONS.incidents}
                  size={DASHBOARD_ICON_POLICY.sizes.hero}
                  className="text-red-700"
                />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Queue overview</h2>
                <p className="text-gray-600 mt-1">
                  Review live queue status alongside completed enforcement history.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="space-y-6 sm:space-y-8">
        {!isEmbeddedQueueMode && stats.pending > 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <DashboardIconSlot
                icon={DASHBOARD_ICONS.reports}
                size={DASHBOARD_ICON_POLICY.sizes.alert}
                className="mt-0.5 text-red-700"
              />
              <div>
                <h3 className="text-lg font-semibold text-red-800">
                  {stats.pending} incident{stats.pending === 1 ? '' : 's'} awaiting response
                </h3>
                <p className="text-red-600 text-sm">
                  Scan the QR token and verify evidence before issuing a ticket.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {isQueueMode && qrHandoffNotice ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                  <DashboardIconSlot icon={DASHBOARD_ICONS.camera} size={16} />
                  <span>QR Handoff</span>
                </div>
                <p className="mt-2">{qrHandoffNotice}</p>
              </div>
              <button
                type="button"
                onClick={() => setQrHandoffNotice(null)}
                className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-900 transition-colors hover:bg-white/70"
              >
                Dismiss Notice
              </button>
            </div>
          </div>
        ) : null}

        {isQueueMode && qrHandoffSnapshot ? (
          <div className="app-surface-card rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  <DashboardIconSlot icon={DASHBOARD_ICONS.camera} size={16} />
                  <span>QR Handoff</span>
                </div>
                <h3 className="mt-2 text-lg font-semibold text-emerald-950">
                  {isEmbeddedQueueMode
                    ? `Matched incidents for ${qrHandoffSnapshot.vehicle?.plateNumber || qrHandoffSnapshot.vehicle?.id || 'the scanned vehicle'}`
                    : `${qrHandoffSnapshot.vehicle?.plateNumber || qrHandoffSnapshot.vehicle?.id || 'Matched vehicle'} is loaded into the queue`}
                </h3>
                <p className="mt-1 text-sm text-emerald-900">
                  {isEmbeddedQueueMode
                    ? `${filteredIncidents.length} unresolved incident${filteredIncidents.length === 1 ? '' : 's'} matched to this plate number.`
                    : `Permit status: ${qrHandoffSnapshot.permitStatusAtScan}. Compliance: ${qrHandoffSnapshot.complianceStatus.replace('_', ' ')}.`}
                </p>
                {!isEmbeddedQueueMode ? (
                  <p className="mt-1 text-sm text-emerald-900">
                    Driver: {qrHandoffSnapshot.operator.driverFullName || qrHandoffSnapshot.operator.driverName || 'Unspecified'}
                    {' '}• Unpaid tickets: {qrHandoffSnapshot.violationSummary.unpaidTickets}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (embeddedQrHandoffSnapshot === undefined) {
                    clearQrTerminalHandoff()
                  }
                  setQrHandoffSnapshot(null)
                }}
                className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-900 transition-colors hover:bg-white/70"
              >
                Dismiss Handoff
              </button>
            </div>
          </div>
        ) : null}

        {!isQueueMode ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <MetricCard
              label="Total Incidents"
              value={stats.total}
              icon={DASHBOARD_ICONS.list}
              tone="slate"
            />
            <MetricCard
              label="For Review"
              value={stats.forReview}
              icon={DASHBOARD_ICONS.inspect}
              tone="amber"
            />
            <MetricCard
              label="Awaiting Payment"
              value={stats.ticketIssued}
              icon={DASHBOARD_ICONS.ticket}
              tone="blue"
            />
            <MetricCard
              label="Resolved"
              value={stats.resolved}
              icon={DASHBOARD_ICONS.check}
              tone="emerald"
            />
          </div>
        ) : null}

        {!isEmbeddedQueueMode ? (
        <div className="app-surface-card rounded-2xl p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">
              {isQueueMode ? 'Unresolved work queue' : 'All enforcement incidents'}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {isQueueMode
                ? 'Focus on pending and investigating incidents that still need action.'
                : 'Review live queue volume together with the resolved enforcement record.'}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 text-sm text-gray-500">
            <DashboardIconSlot
              icon={DASHBOARD_ICONS.list}
              size={DASHBOARD_ICON_POLICY.sizes.button}
              className="text-gray-400"
            />
            <span>
              <span className="font-medium">{scopedIncidents.length}</span> incident{scopedIncidents.length === 1 ? '' : 's'} returned
            </span>
          </div>
        </div>
        ) : null}

        {!isEmbeddedQueueMode ? (
        <div className="app-surface-card rounded-2xl p-4 flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label htmlFor="incident-search" className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-gray-700">
              <DashboardIconSlot
                icon={DASHBOARD_ICONS.inspect}
                size={DASHBOARD_ICON_POLICY.sizes.button}
                className="text-gray-500"
              />
              <span>Search incidents</span>
            </label>
            <div className="relative">
              <DashboardIconSlot
                icon={DASHBOARD_ICONS.inspect}
                size={DASHBOARD_ICON_POLICY.sizes.button}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                id="incident-search"
                name="incidentSearch"
                type="text"
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by plate number, location, ticket number, description, or reporter..."
                className="block w-full rounded-lg border border-gray-300 py-2.5 pl-11 pr-4 focus:border-transparent focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key as typeof statusFilter)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  statusFilter === tab.key
                    ? 'bg-emerald-600 text-white'
                    : 'app-surface-inner border border-gray-300/80 text-gray-700 hover:bg-white/80'
                }`}
              >
                {tab.label} ({getStatusTabCount(tab.key)})
              </button>
            ))}
          </div>
        </div>
        ) : null}

        <div className="app-surface-card rounded-2xl">
          <div className="p-6">
            <ResponsiveTable
              columns={[
                {
                  key: 'type',
                  label: 'Incident',
                  mobileLabel: 'Incident',
                  render: (_, incident) => (
                    <div>
                      <div className="text-sm font-medium text-gray-900">{incident.typeLabel}</div>
                      <div className="text-xs text-gray-500">{getTimeElapsed(incident.createdAt)}</div>
                    </div>
                  ),
                },
                {
                  key: 'details',
                  label: 'Details',
                  mobileLabel: 'Vehicle and Reporter',
                  render: (_, incident) => (
                    <div>
                      <div className="text-sm text-gray-900">{incident.plateNumber || 'No plate number'}</div>
                      <div className="text-sm text-gray-500">{incident.driverLicense || 'No driver license recorded'}</div>
                      <div className="text-xs text-gray-500">
                        Reporter:{' '}
                        {incident.reportedBy ? `${incident.reportedBy.firstName} ${incident.reportedBy.lastName}` : 'Unknown'}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'location',
                  label: 'Location',
                  render: (location) => location,
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (_, incident) => (
                    <div>
                      <StatusBadge
                        status={incident.status.toLowerCase().replace('_', ' ')}
                        className={getStatusColor(incident.status)}
                      />
                      {incident.ticketNumber ? (
                        <div className="text-xs text-gray-600 mt-1">
                          Ticket: {incident.ticketNumber}
                          {incident.paymentStatus ? ` • ${incident.paymentStatus.replace('_', ' ')}` : ''}
                        </div>
                      ) : null}
                    </div>
                  ),
                },
                {
                  key: 'time',
                  label: 'Incident Date',
                  render: (_, incident) => (
                    <div>
                      <div>{formatDate(incident.date)}</div>
                      <div className="text-xs text-gray-500">Reported: {formatDate(incident.createdAt)}</div>
                    </div>
                  ),
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (_, incident) => (
                    <div className="space-y-2">
                      <ActionButton
                        onClick={() => {
                          setSelectedIncident(incident)
                          setShowIncidentDetails(true)
                        }}
                        variant="secondary"
                        size="xs"
                      >
                        <ActionLabel icon={DASHBOARD_ICONS.view} iconClassName="text-gray-500">
                          View Details
                        </ActionLabel>
                      </ActionButton>
                      {canAccessIncidentEvidence(incident) ? (
                        <ActionButton onClick={() => openEvidenceManager(incident)} variant="secondary" size="xs">
                          <ActionLabel icon={DASHBOARD_ICONS.evidence} iconClassName="text-gray-500">
                            Evidence
                          </ActionLabel>
                        </ActionButton>
                      ) : null}
                      {incident.status === 'PENDING' && incident.evidenceVerifiedAt ? (
                        <ActionButton
                          onClick={() => {
                            void openTicketModal(incident)
                          }}
                          variant="primary"
                          size="xs"
                          className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                        >
                          <ActionLabel icon={DASHBOARD_ICONS.ticket} iconClassName="text-white">
                            Issue Ticket
                          </ActionLabel>
                        </ActionButton>
                      ) : null}
                    </div>
                  ),
                },
              ]}
              data={filteredIncidents}
              loading={isLoading}
              emptyMessage={isEmbeddedQueueMode
                ? 'No unresolved incidents matched this plate number.'
                : isQueueMode
                  ? 'No unresolved incidents found for the selected filters.'
                  : 'No incidents found for the selected filters.'}
              className="rounded-lg"
            />
          </div>
        </div>
      </div>

      {showIncidentDetails && selectedIncident ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-3 backdrop-blur-sm sm:p-5">
          <div className="app-surface-overlay app-mobile-sheet-safe relative w-full max-w-5xl overflow-hidden rounded-3xl p-4 sm:max-h-[calc(100vh-2rem)] sm:p-5">
            <button
              onClick={closeIncidentDetails}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/80 hover:text-gray-600"
              aria-label="Close incident details"
            >
              <DashboardIconSlot icon={DASHBOARD_ICONS.close} size={DASHBOARD_ICON_POLICY.sizes.card} />
            </button>
            <div className="space-y-3">
              <div className="flex flex-col gap-2 border-b border-slate-200/80 pb-3 pr-12">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className={getDashboardIconChipClasses('slate')}>
                      <DashboardIconSlot
                        icon={DASHBOARD_ICONS.list}
                        size={DASHBOARD_ICON_POLICY.sizes.section}
                      />
                    </span>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Incident Details</h3>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                      {selectedIncident.typeLabel}
                    </span>
                    <StatusBadge
                      status={selectedIncident.status.toLowerCase()}
                      className={getStatusColor(selectedIncident.status)}
                    />
                    {selectedIncident.ticketNumber ? (
                      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-green-800">
                        Ticket {selectedIncident.ticketNumber}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <section className="app-surface-inner rounded-2xl p-3 sm:p-4">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-gray-600">Case Snapshot</h4>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 xl:grid-cols-4">
                  <DetailField label="Type" value={selectedIncident.typeLabel} />
                  <DetailField
                    label="Status"
                    value={(
                      <StatusBadge
                        status={selectedIncident.status.toLowerCase()}
                        className={getStatusColor(selectedIncident.status)}
                      />
                    )}
                  />
                  <DetailField label="Evidence" value={selectedIncident.evidenceCount ?? 0} />
                  <DetailField label="Plate" value={selectedIncident.plateNumber || 'N/A'} />
                  <DetailField label="Date" value={formatDate(selectedIncident.date)} />
                  <DetailField label="Reported" value={formatDate(selectedIncident.createdAt)} />
                  <DetailField label="License" value={selectedIncident.driverLicense || 'N/A'} />
                  <DetailField
                    label="Reporter"
                    value={selectedIncident.reportedBy
                      ? `${selectedIncident.reportedBy.firstName} ${selectedIncident.reportedBy.lastName}`
                      : 'Unknown'}
                  />
                  <DetailField label="Location" value={selectedIncident.location} fullWidth valueClassName="truncate" />
                  {selectedIncident.ticketNumber ? (
                    <DetailField label="Ticket" value={selectedIncident.ticketNumber} />
                  ) : null}
                  {selectedIncident.ticketNumber ? (
                    <DetailField
                      label="Payment"
                      value={(selectedIncident.paymentStatus || 'NOT_APPLICABLE').replace('_', ' ')}
                    />
                  ) : null}
                  {selectedIncident.paidAt ? (
                    <DetailField label="Paid" value={formatDate(selectedIncident.paidAt)} />
                  ) : null}
                  {selectedIncident.penaltyAmount != null ? (
                    <DetailField
                      label="Penalty"
                      value={`PHP ${selectedIncident.penaltyAmount.toLocaleString()}`}
                    />
                  ) : null}
                  {selectedIncident.description ? (
                    <DetailField
                      label="Description"
                      value={selectedIncident.description}
                      fullWidth
                      valueClassName="overflow-hidden text-ellipsis [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                    />
                  ) : null}
                </dl>
              </section>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3">
                <div className="flex flex-wrap gap-2">
                  {canAccessIncidentEvidence(selectedIncident) ? (
                    <button
                      onClick={() => openEvidenceManager(selectedIncident)}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-700"
                    >
                      <DashboardIconSlot
                        icon={DASHBOARD_ICONS.evidence}
                        size={DASHBOARD_ICON_POLICY.sizes.button}
                        className="text-white"
                      />
                      <span>Manage Evidence</span>
                    </button>
                  ) : (
                    <p className="text-sm text-gray-600">{EVIDENCE_ASSIGNMENT_NOTICE}</p>
                  )}

                  {selectedIncident.status === 'PENDING' && selectedIncident.evidenceVerifiedAt ? (
                    <button
                      onClick={() => {
                        closeIncidentDetails()
                        void openTicketModal(selectedIncident)
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                    >
                      <DashboardIconSlot
                        icon={DASHBOARD_ICONS.ticket}
                        size={DASHBOARD_ICON_POLICY.sizes.button}
                        className="text-white"
                      />
                      <span>Issue Ticket</span>
                    </button>
                  ) : null}

                  {selectedIncident.ticketNumber ? (
                    <div className="app-surface-inner rounded-lg border border-green-200 px-3 py-2 text-sm font-semibold text-green-800">
                      Ticket Issued: {selectedIncident.ticketNumber}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showEvidenceManager && evidenceIncidentId ? (
        <EvidenceManager
          incidentId={evidenceIncidentId}
          onClose={closeEvidenceManager}
          onVerified={() => { void revalidateIncidentLists() }}
          incidentVerifiedAt={evidenceIncident?.evidenceVerifiedAt ?? null}
        />
      ) : null}

      {showTicketModal && ticketIncident ? (
        <div className="fixed inset-0 z-50 h-full w-full overflow-y-auto bg-slate-950/35 backdrop-blur-sm">
          <div className="app-surface-overlay app-mobile-sheet-safe relative top-4 mx-auto max-h-[calc(100vh-2rem)] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-3xl p-4 sm:top-10 sm:max-h-[90vh] sm:w-11/12 sm:p-5">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <DashboardIconSlot
                    icon={DASHBOARD_ICONS.ticket}
                    size={DASHBOARD_ICON_POLICY.sizes.section}
                    className="text-red-600"
                  />
                  <h3 className="text-xl font-bold text-gray-900">Issue Ticket</h3>
                </div>
                <button onClick={closeTicketModal} className="text-gray-400 hover:text-gray-600">
                  <span className="text-2xl">x</span>
                </button>
              </div>

              <div className="app-surface-inner mb-6 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Incident Details</h4>
                <p className="text-sm text-gray-600"><strong>Type:</strong> {ticketIncident.typeLabel}</p>
                <p className="text-sm text-gray-600"><strong>Plate:</strong> {ticketIncident.plateNumber || 'N/A'}</p>
                <p className="text-sm text-gray-600"><strong>Location:</strong> {ticketIncident.location}</p>
                <p className="text-sm text-gray-600"><strong>Date:</strong> {formatDate(ticketIncident.date)}</p>
              </div>

              <form onSubmit={handleTicketSubmit} className="space-y-4">
                <div>
                  <label htmlFor="issue-ticket-number" className="block text-sm font-medium text-gray-700 mb-2">
                    Ticket Number *
                  </label>
                  <input
                    id="issue-ticket-number"
                    name="ticketNumber"
                    type="text"
                    autoComplete="off"
                    value={ticketData.ticketNumber}
                    onChange={(e) => setTicketData((prev) => ({ ...prev, ticketNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Enter ticket number"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enforced Penalty
                  </label>
                  {isTicketPenaltyLoading ? (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                      Loading penalty details...
                    </div>
                  ) : ticketPenaltyPreview ? (
                    <div className="grid gap-3 rounded-lg border border-red-200 bg-red-50 p-4 md:grid-cols-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Offense</p>
                        <p className="mt-1 text-sm font-semibold text-red-900">#{ticketPenaltyPreview.offenseNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Tier</p>
                        <p className="mt-1 text-sm font-semibold text-red-900">{ticketPenaltyPreview.offenseTierLabel}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Current Ticket</p>
                        <p className="mt-1 text-sm font-semibold text-red-900">
                          PHP {ticketPenaltyPreview.currentPenaltyAmount.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Amount Due</p>
                        <p className="mt-1 text-sm font-semibold text-red-900">
                          PHP {ticketPenaltyPreview.penaltyAmount.toLocaleString()}
                        </p>
                      </div>
                      <div className="md:col-span-3">
                        <p className="text-xs text-red-700">
                          Based on {ticketPenaltyPreview.priorTicketCount} prior ticketed violation
                          {ticketPenaltyPreview.priorTicketCount === 1 ? '' : 's'} for this plate number.
                        </p>
                      </div>
                      {ticketPenaltyPreview.carriedForwardPenaltyAmount > 0 ? (
                        <div className="md:col-span-4">
                          <p className="text-xs text-red-700">
                            Includes PHP {ticketPenaltyPreview.carriedForwardPenaltyAmount.toLocaleString()} carried forward from {ticketPenaltyPreview.priorUnpaidTicketCount} earlier unpaid ticket{ticketPenaltyPreview.priorUnpaidTicketCount === 1 ? '' : 's'}.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                      Penalty details unavailable.
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="issue-ticket-remarks" className="block text-sm font-medium text-gray-700 mb-2">
                    Remarks
                  </label>
                  <textarea
                    id="issue-ticket-remarks"
                    name="remarks"
                    autoComplete="off"
                    value={ticketData.remarks}
                    onChange={(e) => setTicketData((prev) => ({ ...prev, remarks: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    rows={3}
                    placeholder="Additional notes or remarks"
                  />
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:space-x-0">
                  <button
                    type="button"
                    onClick={closeTicketModal}
                    className="w-full rounded-lg bg-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-400 sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isTicketPenaltyLoading || !ticketPenaltyPreview}
                    className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 sm:w-auto"
                  >
                    Issue Ticket
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MetricCard({
  icon,
  label,
  tone = 'slate',
  value,
}: {
  icon?: DashboardIcon
  label: string
  tone?: DashboardIconTone
  value: number | string
}) {
  return (
    <div className="app-surface-card rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        {icon ? (
          <div className={getDashboardIconChipClasses(tone)}>
            <DashboardIconSlot
              icon={icon}
              size={DASHBOARD_ICON_POLICY.sizes.card}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
