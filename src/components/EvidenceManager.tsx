'use client'

import { useEffect, useState } from 'react'

import LoadingSpinner from '@/components/LoadingSpinner'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
  type DashboardIcon,
} from '@/components/dashboardIcons'

interface Evidence {
  id: string
  fileName: string
  fileUrl: string
  fileType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'OTHER'
  fileSize: number
  status: 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED' | 'REQUIRES_ADDITIONAL'
  storageStatus?: 'AVAILABLE' | 'DELETED'
  fileDeletedAt?: string
  remarks?: string
  createdAt: string
  reviewedAt?: string
  uploader: {
    firstName: string
    lastName: string
    email: string
  }
  reviewer?: {
    firstName: string
    lastName: string
    email: string
  }
}

interface EvidenceManagerProps {
  incidentId: string
  onClose: () => void
  onVerified?: () => void
  incidentVerifiedAt?: string | null
}

const EvidenceManager = ({ incidentId, onClose, onVerified, incidentVerifiedAt }: EvidenceManagerProps) => {
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewStatus, setReviewStatus] = useState('')
  const [reviewRemarks, setReviewRemarks] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifiedSuccessfully, setVerifiedSuccessfully] = useState(false)

  useEffect(() => {
    fetchEvidence()
  }, [incidentId])

  const fetchEvidence = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch(`/api/incidents/${incidentId}/evidence`)

      if (response.ok) {
        const data = await response.json()
        setEvidence(data.evidence)
      } else {
        const errorData = await response.json().catch(() => null)
        setError(errorData?.message || 'Failed to load evidence')
      }
    } catch {
      setError('Failed to load evidence')
    } finally {
      setLoading(false)
    }
  }

  const handleReviewEvidence = async (evidenceId: string) => {
    if (!reviewStatus) return

    try {
      const response = await fetch(`/api/evidence/${evidenceId}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: reviewStatus,
          remarks: reviewRemarks,
        }),
      })

      if (response.ok) {
        setReviewingId(null)
        setReviewStatus('')
        setReviewRemarks('')
        await fetchEvidence()
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to review evidence')
      }
    } catch {
      setError('Failed to review evidence')
    }
  }

  const handleVerifyIncident = async () => {
    setVerifying(true)
    setError('')
    try {
      const response = await fetch(`/api/incidents/${incidentId}/verify-evidence`, {
        method: 'PATCH',
      })
      const data = await response.json().catch(() => null)
      if (response.ok || response.status === 409) {
        setVerifiedSuccessfully(true)
        onVerified?.()
      } else {
        setError(data?.message || 'Failed to verify evidence.')
      }
    } catch {
      setError('Failed to verify evidence.')
    } finally {
      setVerifying(false)
    }
  }

  const getFileIcon = (fileType: string): DashboardIcon => {
    switch (fileType) {
      case 'IMAGE':
        return DASHBOARD_ICONS.image
      case 'VIDEO':
        return DASHBOARD_ICONS.video
      case 'AUDIO':
        return DASHBOARD_ICONS.audio
      case 'DOCUMENT':
        return DASHBOARD_ICONS.fileText
      default:
        return DASHBOARD_ICONS.evidence
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING_REVIEW: 'bg-yellow-100 text-yellow-800',
      VERIFIED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      REQUIRES_ADDITIONAL: 'bg-blue-100 text-blue-800',
    }
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800'
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString()

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/35 p-4 backdrop-blur-sm sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-manager-title"
        className="app-surface-overlay mx-auto flex min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-3xl sm:max-h-[calc(100vh-5rem)]"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-4 backdrop-blur sm:px-5">
          <h3 id="evidence-manager-title" className="min-w-0 text-lg font-bold text-gray-900 sm:text-xl flex items-center gap-3">
            <span className={getDashboardIconChipClasses('blue')}>
              <DashboardIconSlot icon={DASHBOARD_ICONS.folder} size={DASHBOARD_ICON_POLICY.sizes.card} />
            </span>
            <span>Evidence Management</span>
          </h3>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-gray-400 transition-colors hover:bg-white/80 hover:text-gray-600"
            aria-label="Close evidence manager"
          >
            <DashboardIconSlot icon={DASHBOARD_ICONS.close} size={DASHBOARD_ICON_POLICY.sizes.card} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <div className="space-y-6">
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-900">
              Review submitted evidence, open files, and submit verification without leaving the incident workflow.
            </div>

          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
              <DashboardIconSlot icon={DASHBOARD_ICONS.reports} size={DASHBOARD_ICON_POLICY.sizes.alert} className="text-red-600" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Evidence Files ({evidence.length})</h4>

            {loading ? (
              <div className="text-center py-8">
                <LoadingSpinner className="justify-center text-blue-600" size={28} />
                <p className="text-gray-600 mt-2">Loading evidence...</p>
              </div>
            ) : evidence.length > 0 ? (
              <div className="grid gap-4">
                {evidence.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-gray-200 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className={`${getDashboardIconChipClasses('slate')} h-11 w-11 rounded-xl`}>
                          <DashboardIconSlot icon={getFileIcon(item.fileType)} size={DASHBOARD_ICON_POLICY.sizes.card} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-start">
                            <h5 className="min-w-0 break-all font-medium leading-snug text-gray-900">{item.fileName}</h5>
                            <span className={`shrink-0 self-start rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadge(item.status)}`}>
                              {item.status.replace('_', ' ').toLowerCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {formatFileSize(item.fileSize)} • Uploaded by {item.uploader.firstName} {item.uploader.lastName}
                          </p>
                          <p className="text-xs text-gray-500">
                            Uploaded: {formatDate(item.createdAt)}
                          </p>
                          {item.reviewer ? (
                            <p className="text-xs text-gray-500">
                              Reviewed by {item.reviewer.firstName} {item.reviewer.lastName} on {formatDate(item.reviewedAt!)}
                            </p>
                          ) : null}
                          {item.remarks ? (
                            <p className="text-sm text-gray-700 mt-2 bg-gray-100 p-2 rounded">
                              <strong>Remarks:</strong> {item.remarks}
                            </p>
                          ) : null}
                          {item.storageStatus === 'DELETED' && item.fileDeletedAt ? (
                            <p className="text-xs text-amber-700 mt-2 bg-amber-50 p-2 rounded">
                              File removed from storage on {formatDate(item.fileDeletedAt)}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                        <a
                          href={item.storageStatus === 'DELETED' ? undefined : item.fileUrl}
                          target={item.storageStatus === 'DELETED' ? undefined : '_blank'}
                          rel={item.storageStatus === 'DELETED' ? undefined : 'noopener noreferrer'}
                          className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium sm:w-auto ${
                            item.storageStatus === 'DELETED'
                              ? 'border-gray-200 text-gray-400 cursor-not-allowed pointer-events-none'
                              : 'border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-800'
                          }`}
                        >
                          <DashboardIconSlot icon={DASHBOARD_ICONS.view} size={DASHBOARD_ICON_POLICY.sizes.button} />
                          <span>
                            {item.storageStatus === 'DELETED'
                              ? 'Removed from storage'
                              : item.fileType === 'IMAGE'
                                ? 'View'
                                : 'Download'}
                          </span>
                        </a>

                        {item.status === 'PENDING_REVIEW' ? (
                          <button
                            onClick={() => setReviewingId(item.id)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-green-200 px-3 py-2 text-sm font-medium text-green-600 hover:bg-green-50 hover:text-green-800 sm:w-auto"
                          >
                            <DashboardIconSlot icon={DASHBOARD_ICONS.check} size={DASHBOARD_ICON_POLICY.sizes.button} />
                            <span>Review</span>
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {reviewingId === item.id ? (
                      <div className="mt-4 rounded-xl bg-blue-50 p-4">
                        <h6 className="font-medium text-gray-900 mb-3">Review Evidence</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="evidence-review-status" className="block text-sm font-medium text-gray-700 mb-1">
                              Review Status
                            </label>
                            <select
                              id="evidence-review-status"
                              name="reviewStatus"
                              autoComplete="off"
                              value={reviewStatus}
                              onChange={(e) => setReviewStatus(e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            >
                              <option value="">Select status...</option>
                              <option value="VERIFIED">Verified</option>
                              <option value="REJECTED">Rejected</option>
                              <option value="REQUIRES_ADDITIONAL">Requires Additional Evidence</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor="evidence-review-remarks" className="block text-sm font-medium text-gray-700 mb-1">
                              Remarks (Optional)
                            </label>
                            <input
                              id="evidence-review-remarks"
                              name="reviewRemarks"
                              type="text"
                              autoComplete="off"
                              value={reviewRemarks}
                              onChange={(e) => setReviewRemarks(e.target.value)}
                              placeholder="Add review comments..."
                              className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                          <button
                            onClick={() => {
                              setReviewingId(null)
                              setReviewStatus('')
                              setReviewRemarks('')
                            }}
                            className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-white/70 hover:text-gray-800"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleReviewEvidence(item.id)}
                            disabled={!reviewStatus}
                            className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm inline-flex items-center gap-2"
                          >
                            <DashboardIconSlot icon={DASHBOARD_ICONS.check} size={DASHBOARD_ICON_POLICY.sizes.button} />
                            <span>Submit Review</span>
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <div className={`${getDashboardIconChipClasses('slate')} mx-auto mb-3 h-16 w-16 rounded-2xl`}>
                  <DashboardIconSlot icon={DASHBOARD_ICONS.evidence} size={DASHBOARD_ICON_POLICY.sizes.empty} />
                </div>
                <p className="text-gray-500">No evidence files uploaded yet</p>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200/80 bg-white/95 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="sm:flex-1">
              {verifiedSuccessfully || incidentVerifiedAt ? (
                <span className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
                  <DashboardIconSlot icon={DASHBOARD_ICONS.check} size={DASHBOARD_ICON_POLICY.sizes.button} />
                  Evidence Verified—Ticket can now be issued
                </span>
              ) : (
                <button
                  onClick={() => { void handleVerifyIncident() }}
                  disabled={verifying || loading || evidence.length === 0}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {verifying ? (
                    <LoadingSpinner size={14} />
                  ) : (
                    <DashboardIconSlot icon={DASHBOARD_ICONS.inspect} size={DASHBOARD_ICON_POLICY.sizes.button} />
                  )}
                  <span>{verifying ? 'Verifying…' : 'Submit Verification'}</span>
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-400 sm:w-auto"
            >
              <DashboardIconSlot icon={DASHBOARD_ICONS.close} size={DASHBOARD_ICON_POLICY.sizes.button} />
              <span>Close</span>
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

export default EvidenceManager
