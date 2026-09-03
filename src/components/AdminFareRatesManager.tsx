'use client'

import { useEffect, useRef, useState } from 'react'

import type { AdminFareRatesResponseDto, FareRateVersionDto } from '@/lib/contracts'
import { FARE_DOCUMENT_ACCEPT_ATTRIBUTE } from '@/lib/fare/documentTypes'
import { formatManilaDateTimeInput, formatManilaDateTimeLabel } from '@/lib/manilaTime'
import { useFeedback } from '@/ui/FeedbackProvider'

type PublishMode = 'immediate' | 'scheduled'

/** Which history row has its attach/replace form open, and what has been typed into it. */
type AttachTarget = {
  versionId: string
  title: string
  reference: string
}

function formatCurrency(value: number) {
  return `PHP ${value.toFixed(2)}`
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * Default document title for a version, so an admin attaching paper to an old
 * row does not have to invent one.
 */
function suggestDocumentTitle(version: FareRateVersionDto) {
  return `Fare rate effective ${formatManilaDateTimeLabel(version.effectiveAt)}`
}

function findPreviousEligibleVersion(data: AdminFareRatesResponseDto | null) {
  if (!data?.currentVersion) {
    return null
  }

  const currentEffectiveAt = new Date(data.currentVersion.effectiveAt).getTime()

  return (
    [...data.history]
      .filter((version) => !version.canceledAt && new Date(version.effectiveAt).getTime() < currentEffectiveAt)
      .sort((left, right) => {
        const effectiveAtDiff = new Date(right.effectiveAt).getTime() - new Date(left.effectiveAt).getTime()
        if (effectiveAtDiff !== 0) {
          return effectiveAtDiff
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      })[0] ?? null
  )
}

export default function AdminFareRatesManager() {
  const { confirm } = useFeedback()
  const [data, setData] = useState<AdminFareRatesResponseDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [mode, setMode] = useState<PublishMode>('immediate')
  const [baseFare, setBaseFare] = useState('15.00')
  const [perKmRate, setPerKmRate] = useState('3.00')
  const [effectiveAt, setEffectiveAt] = useState('')
  const [notes, setNotes] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [revertReason, setRevertReason] = useState('')
  const [documentTitle, setDocumentTitle] = useState('')
  const [documentReference, setDocumentReference] = useState('')
  const [attachTarget, setAttachTarget] = useState<AttachTarget | null>(null)
  const [documentBusyVersionId, setDocumentBusyVersionId] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const publishFormRef = useRef<HTMLFormElement | null>(null)
  const attachFileRef = useRef<HTMLInputElement | null>(null)
  const setupRequired = Boolean(data?.warning)
  const previousEligibleVersion = findPreviousEligibleVersion(data)

  useEffect(() => {
    void fetchFareRates()
  }, [])

  async function fetchFareRates() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/fare-rates')
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to load fare rates')
      }

      const nextData = payload as AdminFareRatesResponseDto
      setData(nextData)
      setBaseFare(nextData.current.baseFare.toFixed(2))
      setPerKmRate(nextData.current.perKmRate.toFixed(2))
      setEffectiveAt(nextData.upcoming?.effectiveAt ? formatManilaDateTimeInput(nextData.upcoming.effectiveAt) : '')
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load fare rates')
    } finally {
      setLoading(false)
    }
  }

  /**
   * POST the supporting document to a version that already exists.
   *
   * Throws on failure so each caller can decide what that means: a failed upload
   * during publishing is a warning (the rate is already live), while a failed
   * upload from the history list is a plain error.
   */
  async function uploadDocument(versionId: string, file: File, title: string, reference: string) {
    const body = new FormData()
    body.append('document', file)
    body.append('title', title)
    if (reference.trim()) {
      body.append('reference', reference.trim())
    }

    const response = await fetch(`/api/admin/fare-rates/${versionId}/document`, {
      method: 'POST',
      body,
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload.message || 'Failed to upload the supporting document')
    }

    return payload
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)
    setWarning(null)

    const fileInput = publishFormRef.current?.querySelector<HTMLInputElement>(
      'input[type="file"]',
    )
    const documentFile = fileInput?.files?.[0] ?? null

    if (documentFile && !documentTitle.trim()) {
      setError('A document title is required when attaching a supporting document.')
      setSaving(false)
      return
    }

    try {
      const response = await fetch('/api/admin/fare-rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode,
          baseFare: Number(baseFare),
          perKmRate: Number(perKmRate),
          effectiveAt: mode === 'scheduled' ? effectiveAt : undefined,
          notes,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to save fare rate')
      }

      // The rate is live from here on. A failed document upload must not be
      // reported as a failed publish — it is a separate, retryable step from the
      // history list below.
      if (documentFile) {
        try {
          await uploadDocument(
            payload.fareRateVersion.id,
            documentFile,
            documentTitle.trim(),
            documentReference,
          )
        } catch (uploadError) {
          setWarning(
            `${payload.message || 'Fare rate saved.'} The supporting document did not upload (${
              uploadError instanceof Error ? uploadError.message : 'unknown error'
            }). Attach it from the fare rate history below.`,
          )
        }
      }

      setSuccess(payload.message || 'Fare rate saved successfully.')
      setNotes('')
      setDocumentTitle('')
      setDocumentReference('')
      if (fileInput) {
        fileInput.value = ''
      }
      if (mode === 'immediate') {
        setEffectiveAt('')
      }
      await fetchFareRates()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save fare rate')
    } finally {
      setSaving(false)
    }
  }

  async function handleAttachDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!attachTarget) {
      return
    }

    const file = attachFileRef.current?.files?.[0] ?? null
    if (!file) {
      setError('Choose a supporting document file to upload.')
      return
    }

    if (!attachTarget.title.trim()) {
      setError('A document title is required.')
      return
    }

    setDocumentBusyVersionId(attachTarget.versionId)
    setError(null)
    setSuccess(null)
    setWarning(null)

    try {
      const payload = await uploadDocument(
        attachTarget.versionId,
        file,
        attachTarget.title.trim(),
        attachTarget.reference,
      )
      setSuccess(payload.message || 'Supporting document attached successfully.')
      setAttachTarget(null)
      await fetchFareRates()
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Failed to upload the supporting document',
      )
    } finally {
      setDocumentBusyVersionId(null)
    }
  }

  async function handleRemoveDocument(version: FareRateVersionDto) {
    const confirmed = await confirm({
      title: 'Remove supporting document',
      message: `Permanently delete "${version.document?.title}" from storage? The fare rate version itself is kept.`,
      confirmLabel: 'Remove document',
      destructive: true,
    })
    if (!confirmed) {
      return
    }

    setDocumentBusyVersionId(version.id)
    setError(null)
    setSuccess(null)
    setWarning(null)

    try {
      const response = await fetch(`/api/admin/fare-rates/${version.id}/document`, {
        method: 'DELETE',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to remove the supporting document')
      }

      setSuccess(payload.message || 'Supporting document removed successfully.')
      await fetchFareRates()
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : 'Failed to remove the supporting document',
      )
    } finally {
      setDocumentBusyVersionId(null)
    }
  }

  async function handleCancelUpcoming() {
    if (!data?.upcomingVersion) {
      return
    }

    setCanceling(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/fare-rates', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: cancelReason,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to cancel scheduled fare rate')
      }

      setSuccess(payload.message || 'Scheduled fare rate canceled successfully.')
      setCancelReason('')
      await fetchFareRates()
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Failed to cancel scheduled fare rate')
    } finally {
      setCanceling(false)
    }
  }

  async function handleRevertCurrentFare() {
    if (!previousEligibleVersion) {
      return
    }

    const confirmed = await confirm({
      title: 'Revert fare rate',
      message: `Revert the current live fare to ${formatCurrency(previousEligibleVersion.baseFare)} base and ${formatCurrency(previousEligibleVersion.perKmRate)} per km?`,
    })
    if (!confirmed) {
      return
    }

    setReverting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/fare-rates/revert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: revertReason,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to revert fare rate')
      }

      setSuccess(payload.message || 'Fare rate reverted successfully.')
      setRevertReason('')
      await fetchFareRates()
    } catch (revertError) {
      setError(revertError instanceof Error ? revertError.message : 'Failed to revert fare rate')
    } finally {
      setReverting(false)
    }
  }

  async function handleDeleteVersion(versionId: string, isUpcoming: boolean) {
    const confirmed = await confirm({
      title: 'Delete fare version',
      message: 'Delete this fare version permanently? This cannot be undone.',
      destructive: true,
    })
    if (!confirmed) {
      return
    }

    setDeletingVersionId(versionId)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/admin/fare-rates/${versionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: isUpcoming
            ? 'Deleted upcoming mistaken fare adjustment.'
            : 'Deleted historical mistaken fare adjustment.',
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to delete fare rate version')
      }

      setSuccess(payload.message || 'Fare rate version deleted permanently.')
      await fetchFareRates()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete fare rate version')
    } finally {
      setDeletingVersionId(null)
    }
  }

  if (loading && !data) {
    return (
      <div className="border border-surface-border bg-surface shadow-card rounded-card p-6">
        <p className="text-sm text-slate-500">Loading fare rate management...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {data?.warning && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {data.warning}
        </div>
      )}

      {warning && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {warning}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-primary/20 bg-surface-tint px-4 py-3 text-sm text-primary-dark">
          {success}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-primary/20 bg-surface-tint p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-primary-dark">Current fare</p>
          <div className="mt-4 space-y-2 text-sm text-primary-dark">
            <div className="flex items-center justify-between">
              <span>Base fare ({data?.current.baseDistanceKm} km)</span>
              <span className="font-semibold">{formatCurrency(data?.current.baseFare ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Per additional km</span>
              <span className="font-semibold">{formatCurrency(data?.current.perKmRate ?? 0)}</span>
            </div>
            <p className="pt-2 text-xs text-primary-dark">
              Active since {formatManilaDateTimeLabel(data?.current.effectiveAt)}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Upcoming fare</p>
          {data?.upcomingVersion ? (
            <div className="mt-4 space-y-2 text-sm text-blue-900">
              <div className="flex items-center justify-between">
                <span>Base fare ({data.upcomingVersion.baseDistanceKm} km)</span>
                <span className="font-semibold">{formatCurrency(data.upcomingVersion.baseFare)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Per additional km</span>
                <span className="font-semibold">{formatCurrency(data.upcomingVersion.perKmRate)}</span>
              </div>
              <p className="pt-2 text-xs text-blue-700">
                Effective {formatManilaDateTimeLabel(data.upcomingVersion.effectiveAt)}
              </p>
              <p className="text-xs text-blue-700">
                Scheduled by {data.upcomingVersion.createdByName || 'System'}.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-blue-900">No future fare update is scheduled.</p>
          )}
        </div>
      </section>

      <section className="border border-surface-border bg-surface shadow-card rounded-card p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-slate-900">Publish or Schedule a Fare Change</h2>
          <p className="mt-1 text-sm text-slate-600">
            The first 3 km remain fixed. Each save creates a new immutable version with your admin note.
          </p>
          {setupRequired && (
            <p className="mt-2 text-sm text-amber-700">
              Publishing and scheduling are disabled until the pending database migrations are applied.
            </p>
          )}
        </div>

        <form ref={publishFormRef} onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-center gap-3">
                <input
                  id="admin-fare-publish-immediate"
                  type="radio"
                  name="publishMode"
                  value="immediate"
                  checked={mode === 'immediate'}
                  onChange={() => setMode('immediate')}
                />
                <div>
                  <div className="font-semibold text-slate-900">Publish now</div>
                  <div className="text-xs text-slate-500">Apply the new fare immediately to future calculations.</div>
                </div>
              </div>
            </label>

            <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-center gap-3">
                <input
                  id="admin-fare-publish-scheduled"
                  type="radio"
                  name="publishMode"
                  value="scheduled"
                  checked={mode === 'scheduled'}
                  onChange={() => setMode('scheduled')}
                />
                <div>
                  <div className="font-semibold text-slate-900">Schedule for later</div>
                  <div className="text-xs text-slate-500">Keep one upcoming fare version queued for a future Manila time.</div>
                </div>
              </div>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              <span className="mb-2 block font-medium text-slate-900">Base fare</span>
              <input
                id="admin-fare-base-fare"
                name="baseFare"
                type="number"
                autoComplete="off"
                min="0.01"
                step="0.01"
                value={baseFare}
                onChange={(event) => setBaseFare(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-surface-tint"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-2 block font-medium text-slate-900">Additional fare per km</span>
              <input
                id="admin-fare-per-km-rate"
                name="perKmRate"
                type="number"
                autoComplete="off"
                min="0.01"
                step="0.01"
                value={perKmRate}
                onChange={(event) => setPerKmRate(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-surface-tint"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Base distance is fixed at <span className="font-semibold">3 km</span>.
          </div>

          {mode === 'scheduled' && (
            <label className="text-sm text-slate-700">
              <span className="mb-2 block font-medium text-slate-900">Effective date and time (Asia/Manila)</span>
              <input
                id="admin-fare-effective-at"
                name="effectiveAt"
                type="datetime-local"
                autoComplete="off"
                value={effectiveAt}
                onChange={(event) => setEffectiveAt(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-surface-tint"
              />
            </label>
          )}

          <label className="text-sm text-slate-700">
            <span className="mb-2 block font-medium text-slate-900">Admin note</span>
            <textarea
              id="admin-fare-notes"
              name="notes"
              autoComplete="off"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              required
              placeholder="Explain why this fare version is being published or scheduled."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-surface-tint"
            />
          </label>

          <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-900">
              Supporting document (optional)
            </legend>
            <p className="mt-1 text-xs text-slate-600">
              Attach the Sangguniang Bayan resolution or ordinance that authorized this change. Riders
              see it on the About page beside Ordinance No. 105, so the new rate can be verified against
              the issuance behind it. PDF, JPEG, PNG, or WebP up to 15MB.
            </p>

            <div className="mt-4 space-y-4">
              <label className="block text-sm text-slate-700">
                <span className="mb-2 block font-medium text-slate-900">Document file</span>
                <input
                  id="admin-fare-document-file"
                  name="document"
                  type="file"
                  accept={FARE_DOCUMENT_ACCEPT_ATTRIBUTE}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm text-slate-700">
                  <span className="mb-2 block font-medium text-slate-900">Document title</span>
                  <input
                    id="admin-fare-document-title"
                    name="documentTitle"
                    type="text"
                    autoComplete="off"
                    value={documentTitle}
                    onChange={(event) => setDocumentTitle(event.target.value)}
                    placeholder="Resolution approving the adjusted fare rates"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-surface-tint"
                  />
                </label>

                <label className="text-sm text-slate-700">
                  <span className="mb-2 block font-medium text-slate-900">
                    Document reference <span className="font-normal text-slate-500">(optional)</span>
                  </span>
                  <input
                    id="admin-fare-document-reference"
                    name="documentReference"
                    type="text"
                    autoComplete="off"
                    value={documentReference}
                    onChange={(event) => setDocumentReference(event.target.value)}
                    placeholder="SB Resolution No. 42, Series of 2026"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-surface-tint"
                  />
                </label>
              </div>
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={saving || setupRequired}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? 'Saving fare rate...' : mode === 'scheduled' ? 'Save scheduled fare' : 'Publish fare now'}
          </button>
        </form>
      </section>

      {data?.upcomingVersion && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-amber-900">Cancel the Upcoming Fare Rate</h2>
          <p className="mt-1 text-sm text-amber-800">
            This only cancels the next scheduled fare version. Current live fares remain unchanged.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
            <textarea
              id="admin-fare-cancel-reason"
              name="cancelReason"
              autoComplete="off"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              rows={3}
              placeholder="Optional cancellation reason"
              className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
            />
            <button
              type="button"
              onClick={handleCancelUpcoming}
              disabled={canceling || setupRequired}
              className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {canceling ? 'Canceling...' : 'Cancel scheduled fare'}
            </button>
          </div>
        </section>
      )}

      {previousEligibleVersion && data?.currentVersion && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-rose-900">Revert the Current Fare Rate</h2>
          <p className="mt-1 text-sm text-rose-800">
            This rolls the live fare back to the previous eligible version and records the current fare as reverted.
          </p>

          <div className="mt-4 rounded-2xl border border-rose-200 bg-white/80 p-4 text-sm text-rose-900">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <span>
                Target rollback fare: {formatCurrency(previousEligibleVersion.baseFare)} base, {formatCurrency(previousEligibleVersion.perKmRate)} per km
              </span>
              <span className="text-xs font-medium uppercase tracking-wide text-rose-700">
                Effective {formatManilaDateTimeLabel(previousEligibleVersion.effectiveAt)}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
            <textarea
              id="admin-fare-revert-reason"
              name="revertReason"
              autoComplete="off"
              value={revertReason}
              onChange={(event) => setRevertReason(event.target.value)}
              rows={3}
              placeholder="Optional rollback reason"
              className="w-full rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
            <button
              id="admin-fare-revert-current"
              type="button"
              onClick={handleRevertCurrentFare}
              disabled={reverting || setupRequired}
              className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {reverting ? 'Reverting fare...' : 'Revert to previous fare'}
            </button>
          </div>
        </section>
      )}

      <section className="border border-surface-border bg-surface shadow-card rounded-card p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-slate-900">Fare Rate History</h2>
          <p className="mt-1 text-sm text-slate-600">
            Every fare change is versioned. Scheduled cancellations remain visible for audit review, and mistaken non-live entries can be deleted permanently.
          </p>
        </div>

        <div className="space-y-3">
          {data?.history.length ? (
            data.history.map((version) => (
              <article
                key={version.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                        {version.isActive ? 'Current' : version.isUpcoming ? 'Upcoming' : version.canceledAt ? 'Canceled' : 'Historical'}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {formatCurrency(version.baseFare)} base, {formatCurrency(version.perKmRate)} per km
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">
                      Effective {formatManilaDateTimeLabel(version.effectiveAt)}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      Created {formatManilaDateTimeLabel(version.createdAt)} by {version.createdByName || 'System'}.
                    </p>
                    <p className="mt-2 text-sm text-slate-600">{version.notes}</p>
                    {version.canceledAt && (
                      <p className="mt-2 text-sm text-amber-700">
                        Canceled {formatManilaDateTimeLabel(version.canceledAt)} by {version.canceledByName || 'System'}.
                        {version.cancellationReason ? ` Reason: ${version.cancellationReason}` : ''}
                      </p>
                    )}

                    {version.document ? (
                      <div className="mt-3 rounded-xl border border-slate-300 bg-white p-3 text-sm">
                        <p className="font-medium text-slate-900">{version.document.title}</p>
                        {version.document.reference && (
                          <p className="mt-0.5 text-xs text-slate-600">{version.document.reference}</p>
                        )}
                        <p className="mt-1 text-xs text-slate-500">
                          {version.document.fileName} · {formatFileSize(version.document.sizeBytes)}
                          {version.document.uploadedByName
                            ? ` · uploaded by ${version.document.uploadedByName}`
                            : ''}
                        </p>
                        <a
                          href={version.document.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-sm font-semibold text-primary hover:text-primary-dark"
                        >
                          Open document
                        </a>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">
                        No supporting document attached.
                      </p>
                    )}

                    {attachTarget?.versionId === version.id && (
                      <form
                        onSubmit={handleAttachDocument}
                        className="mt-3 space-y-3 rounded-xl border border-slate-300 bg-white p-3"
                      >
                        <label className="block text-sm text-slate-700">
                          <span className="mb-1.5 block font-medium text-slate-900">Document file</span>
                          <input
                            ref={attachFileRef}
                            type="file"
                            accept={FARE_DOCUMENT_ACCEPT_ATTRIBUTE}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
                          />
                        </label>

                        <label className="block text-sm text-slate-700">
                          <span className="mb-1.5 block font-medium text-slate-900">Document title</span>
                          <input
                            type="text"
                            autoComplete="off"
                            value={attachTarget.title}
                            onChange={(event) =>
                              setAttachTarget({ ...attachTarget, title: event.target.value })
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </label>

                        <label className="block text-sm text-slate-700">
                          <span className="mb-1.5 block font-medium text-slate-900">
                            Document reference <span className="font-normal text-slate-500">(optional)</span>
                          </span>
                          <input
                            type="text"
                            autoComplete="off"
                            value={attachTarget.reference}
                            onChange={(event) =>
                              setAttachTarget({ ...attachTarget, reference: event.target.value })
                            }
                            placeholder="SB Resolution No. 42, Series of 2026"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </label>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={documentBusyVersionId === version.id}
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            {documentBusyVersionId === version.id ? 'Uploading...' : 'Upload document'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAttachTarget(null)}
                            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-stretch gap-2 lg:w-56">
                    <button
                      type="button"
                      onClick={() =>
                        setAttachTarget({
                          versionId: version.id,
                          title: version.document?.title ?? suggestDocumentTitle(version),
                          reference: version.document?.reference ?? '',
                        })
                      }
                      disabled={documentBusyVersionId === version.id || setupRequired}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                    >
                      {version.document ? 'Replace document' : 'Attach document'}
                    </button>

                    {version.document && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDocument(version)}
                        disabled={documentBusyVersionId === version.id || setupRequired}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                      >
                        {documentBusyVersionId === version.id ? 'Working...' : 'Remove document'}
                      </button>
                    )}

                    {!version.isActive && (
                      <button
                        type="button"
                        onClick={() => handleDeleteVersion(version.id, version.isUpcoming)}
                        disabled={deletingVersionId === version.id || setupRequired}
                        className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:border-rose-400 hover:text-rose-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                      >
                        {deletingVersionId === version.id ? 'Deleting...' : 'Delete permanently'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-500">No fare rate history is available yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}
