'use client'

import { useEffect, useMemo, useState } from 'react'
import type { IncidentListItemDto, IncidentsResponseDto } from '@/lib/contracts'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
} from '@/components/dashboardIcons'

type PaymentFilter = 'ALL' | 'UNPAID' | 'PAID'

interface TicketPaymentsWorkspaceProps {
  allowPaymentRecording: boolean
  heading: string
  description: string
  defaultPaymentFilter?: PaymentFilter
}

function formatCurrency(amount: number) {
  return `PHP ${amount.toLocaleString()}`
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function normalizePaymentLabel(status: IncidentListItemDto['paymentStatus']) {
  return (status || 'NOT_APPLICABLE').replace('_', ' ')
}

function toDatetimeLocalValue(value: string | null) {
  const date = value ? new Date(value) : new Date()
  const offset = date.getTimezoneOffset()
  const normalizedDate = new Date(date.getTime() - offset * 60 * 1000)
  return normalizedDate.toISOString().slice(0, 16)
}

export default function TicketPaymentsWorkspace({
  allowPaymentRecording,
  heading,
  description,
  defaultPaymentFilter = 'ALL',
}: TicketPaymentsWorkspaceProps) {
  const [incidents, setIncidents] = useState<IncidentListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>(defaultPaymentFilter)
  const [selectedIncident, setSelectedIncident] = useState<IncidentListItemDto | null>(null)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    officialReceiptNumber: '',
    paidAt: toDatetimeLocalValue(null),
    remarks: '',
  })

  const fetchTicketedIncidents = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/incidents?limit=500')

      if (!response.ok) {
        throw new Error('Failed to fetch ticketed incidents')
      }

      const payload: IncidentsResponseDto = await response.json()
      setIncidents((payload.incidents || []).filter((incident) => Boolean(incident.ticketNumber)))
    } catch (_error) {
      setError('Failed to load ticket payment records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchTicketedIncidents()
  }, [])

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const normalizedStatus = incident.paymentStatus || 'NOT_APPLICABLE'
      const matchesPaymentFilter = paymentFilter === 'ALL' || normalizedStatus === paymentFilter

      if (!matchesPaymentFilter) {
        return false
      }

      if (!searchQuery.trim()) {
        return true
      }

      const query = searchQuery.toLowerCase()
      return Boolean(
        incident.ticketNumber?.toLowerCase().includes(query) ||
        incident.officialReceiptNumber?.toLowerCase().includes(query) ||
        incident.plateNumber?.toLowerCase().includes(query) ||
        incident.location.toLowerCase().includes(query) ||
        incident.typeLabel.toLowerCase().includes(query) ||
        incident.description.toLowerCase().includes(query),
      )
    })
  }, [incidents, paymentFilter, searchQuery])

  const stats = useMemo(() => {
    const unpaidIncidents = incidents.filter((incident) => incident.paymentStatus === 'UNPAID')
    const paidIncidents = incidents.filter((incident) => incident.paymentStatus === 'PAID')
    const outstandingBalance = unpaidIncidents.reduce((sum, incident) => sum + (incident.penaltyAmount || 0), 0)

    return {
      totalTicketed: incidents.length,
      unpaid: unpaidIncidents.length,
      paid: paidIncidents.length,
      outstandingBalance,
    }
  }, [incidents])

  const openIncidentDetails = (incident: IncidentListItemDto) => {
    setSelectedIncident(incident)
    setPaymentForm({
      officialReceiptNumber: incident.officialReceiptNumber || '',
      paidAt: toDatetimeLocalValue(incident.paidAt),
      remarks: incident.remarks || '',
    })
  }

  const closeIncidentDetails = () => {
    setSelectedIncident(null)
    setPaymentForm({
      officialReceiptNumber: '',
      paidAt: toDatetimeLocalValue(null),
      remarks: '',
    })
  }

  const handleRecordPayment = async () => {
    if (!selectedIncident) {
      return
    }

    if (!paymentForm.officialReceiptNumber.trim()) {
      alert('Official receipt number is required.')
      return
    }

    try {
      setIsProcessingPayment(true)
      const response = await fetch(`/api/incidents/${selectedIncident.id}/payment`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          officialReceiptNumber: paymentForm.officialReceiptNumber.trim(),
          paidAt: paymentForm.paidAt,
          remarks: paymentForm.remarks.trim(),
        }),
      })
      const payload = await response.json()

      if (!response.ok) {
        alert(payload.message || 'Failed to record ticket payment.')
        return
      }

      alert(payload.message || 'Ticket payment recorded successfully.')
      closeIncidentDetails()
      await fetchTicketedIncidents()
    } catch (_error) {
      alert('Error recording ticket payment. Please try again.')
    } finally {
      setIsProcessingPayment(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="app-surface-card rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className={getDashboardIconChipClasses('emerald')}>
            <DashboardIconSlot
              icon={DASHBOARD_ICONS.ticket}
              size={DASHBOARD_ICON_POLICY.sizes.hero}
            />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{heading}</h2>
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="app-surface-card rounded-2xl p-5">
          <p className="text-sm text-gray-600">Ticketed Violations</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.totalTicketed}</p>
        </div>
        <div className="app-surface-card rounded-2xl border border-amber-200 p-5">
          <p className="text-sm text-gray-600">Unpaid Tickets</p>
          <p className="mt-2 text-3xl font-bold text-amber-700">{stats.unpaid}</p>
        </div>
        <div className="app-surface-card rounded-2xl border border-emerald-200 p-5">
          <p className="text-sm text-gray-600">Paid Tickets</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{stats.paid}</p>
        </div>
        <div className="app-surface-card rounded-2xl border border-red-200 p-5">
          <p className="text-sm text-gray-600">Outstanding Balance</p>
          <p className="mt-2 text-3xl font-bold text-red-700">{formatCurrency(stats.outstandingBalance)}</p>
        </div>
      </div>

      <div className="app-surface-card rounded-2xl p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Search tickets or receipts</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by ticket number, official receipt, plate number, location, or violation..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'ALL', label: `All (${stats.totalTicketed})` },
              { key: 'UNPAID', label: `Unpaid (${stats.unpaid})` },
              { key: 'PAID', label: `Paid (${stats.paid})` },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setPaymentFilter(item.key as PaymentFilter)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  paymentFilter === item.key
                    ? 'bg-emerald-600 text-white'
                    : 'app-surface-inner border border-gray-300/80 text-gray-700 hover:bg-white/80'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="app-surface-card overflow-hidden rounded-2xl">
        {loading ? (
          <div className="p-6 text-sm text-gray-600">Loading ticket payment records...</div>
        ) : filteredIncidents.length === 0 ? (
          <div className="p-6 text-sm text-gray-600">No ticket payment records matched the current filters.</div>
        ) : (
          <>
            <div className="space-y-3 p-4 lg:hidden">
              {filteredIncidents.map((incident) => (
                <article key={incident.id} className="app-surface-inner rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{incident.ticketNumber}</p>
                      <p className="text-sm text-gray-600">{incident.typeLabel}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${incident.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {normalizePaymentLabel(incident.paymentStatus)}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-gray-600">
                    <p>Plate: <span className="font-medium text-gray-900">{incident.plateNumber || '-'}</span></p>
                    <p>Penalty: <span className="font-medium text-gray-900">{formatCurrency(incident.penaltyAmount || 0)}</span></p>
                    <p>Official Receipt: <span className="font-medium text-gray-900">{incident.officialReceiptNumber || '-'}</span></p>
                    <p>Paid At: <span className="font-medium text-gray-900">{formatDateTime(incident.paidAt)}</span></p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => openIncidentDetails(incident)}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      View Details
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Ticket</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Violation</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Plate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Payment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Penalty</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Receipt #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Paid At</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredIncidents.map((incident) => (
                    <tr key={incident.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{incident.ticketNumber}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div>{incident.typeLabel}</div>
                        <div className="text-xs text-gray-500">{incident.location}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{incident.plateNumber || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${incident.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {normalizePaymentLabel(incident.paymentStatus)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(incident.penaltyAmount || 0)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{incident.officialReceiptNumber || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{formatDateTime(incident.paidAt)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <button
                          onClick={() => openIncidentDetails(incident)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {selectedIncident ? (
        <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm">
          <div className="app-surface-overlay app-mobile-sheet-safe relative top-4 mx-auto max-h-[calc(100vh-2rem)] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-3xl p-5 sm:top-10 sm:w-11/12">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Ticket Payment Details</h3>
              <button
                onClick={closeIncidentDetails}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="text-2xl">x</span>
              </button>
            </div>

            <div className="mt-5 space-y-3 text-sm text-gray-700">
              <p><span className="font-medium">Ticket Number:</span> {selectedIncident.ticketNumber}</p>
              <p><span className="font-medium">Violation:</span> {selectedIncident.typeLabel}</p>
              <p><span className="font-medium">Plate Number:</span> {selectedIncident.plateNumber || '-'}</p>
              <p><span className="font-medium">Location:</span> {selectedIncident.location}</p>
              <p><span className="font-medium">Penalty Amount:</span> {formatCurrency(selectedIncident.penaltyAmount || 0)}</p>
              <p><span className="font-medium">Payment Status:</span> {normalizePaymentLabel(selectedIncident.paymentStatus)}</p>
              <p><span className="font-medium">Official Receipt:</span> {selectedIncident.officialReceiptNumber || '-'}</p>
              <p><span className="font-medium">Paid At:</span> {formatDateTime(selectedIncident.paidAt)}</p>
              <div>
                <p className="font-medium">Description</p>
                <p className="mt-1 rounded-lg bg-gray-50 p-3 text-gray-600">{selectedIncident.description}</p>
              </div>
            </div>

            {allowPaymentRecording && selectedIncident.paymentStatus === 'UNPAID' ? (
              <div className="mt-5 space-y-4 border-t border-slate-200 pt-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Official Receipt Number</label>
                  <input
                    type="text"
                    value={paymentForm.officialReceiptNumber}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        officialReceiptNumber: event.target.value,
                      }))
                    }
                    placeholder="Enter OR number"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Payment Timestamp</label>
                  <input
                    type="datetime-local"
                    value={paymentForm.paidAt}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        paidAt: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Receipt Notes</label>
                  <textarea
                    value={paymentForm.remarks}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        remarks: event.target.value,
                      }))
                    }
                    rows={3}
                    placeholder="Optional receipt remarks"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
              <button
                onClick={closeIncidentDetails}
                className="rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-700 hover:bg-gray-300"
              >
                Close
              </button>
              {allowPaymentRecording && selectedIncident.paymentStatus === 'UNPAID' ? (
                <button
                  onClick={() => void handleRecordPayment()}
                  disabled={isProcessingPayment}
                  className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Record Payment
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}