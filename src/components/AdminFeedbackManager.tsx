'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'

import { DASHBOARD_ICONS, DashboardIconSlot } from '@/components/dashboardIcons'
import type {
  AdminUserFeedbackDto,
  AdminUserFeedbackListResponseDto,
  FeedbackStatusDto,
} from '@/lib/contracts'
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_REVIEW_NOTES_MAX_LENGTH,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
} from '@/lib/feedback/categories'
import { formatManilaDateTimeLabel } from '@/lib/manilaTime'
import { swrFetcher } from '@/lib/swr'
import { swrKey } from '@/lib/swrKeys'
import Badge from '@/ui/Badge'
import Button from '@/ui/Button'
import DataList, { type DataListColumn } from '@/ui/DataList'
import { Field, Select, Textarea } from '@/ui/Field'
import FilterChips from '@/ui/FilterChips'
import { useFeedback } from '@/ui/FeedbackProvider'
import Modal from '@/ui/Modal'
import RowActions from '@/ui/RowActions'
import SearchBar from '@/ui/SearchBar'
import StatTile from '@/ui/StatTile'

const STATUS_TONES: Record<FeedbackStatusDto, 'warning' | 'info' | 'success'> = {
  NEW: 'warning',
  REVIEWED: 'info',
  RESOLVED: 'success',
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <DashboardIconSlot
          key={value}
          icon={DASHBOARD_ICONS.star}
          size={14}
          className={value <= rating ? 'fill-current text-amber-500' : 'text-ink-faint'}
        />
      ))}
    </span>
  )
}

export default function AdminFeedbackManager() {
  const { toast } = useFeedback()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [reviewing, setReviewing] = useState<AdminUserFeedbackDto | null>(null)
  const [reviewStatus, setReviewStatus] = useState<FeedbackStatusDto>('REVIEWED')
  const [reviewNotes, setReviewNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [reviewError, setReviewError] = useState('')

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (categoryFilter !== 'all') params.set('category', categoryFilter)
    if (search.trim()) params.set('search', search.trim())
    if (page > 1) params.set('page', String(page))
    return params.toString()
  }, [statusFilter, categoryFilter, search, page])

  const { data, error, isLoading, mutate } = useSWR<AdminUserFeedbackListResponseDto>(
    swrKey.adminFeedback(query),
    swrFetcher,
  )

  const rows = data?.feedback ?? []
  const counts = data?.counts
  const pagination = data?.pagination

  const openReview = (row: AdminUserFeedbackDto) => {
    setReviewing(row)
    setReviewStatus(row.status === 'NEW' ? 'REVIEWED' : row.status)
    setReviewNotes(row.reviewNotes ?? '')
    setReviewError('')
  }

  const saveReview = async () => {
    if (!reviewing) return
    setSaving(true)
    setReviewError('')

    try {
      const response = await fetch(`/api/admin/feedback/${reviewing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: reviewStatus, reviewNotes }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        setReviewError(payload.message || 'Failed to update this feedback')
        return
      }

      await mutate()
      toast('Feedback updated')
      setReviewing(null)
    } catch {
      setReviewError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const columns: DataListColumn<AdminUserFeedbackDto & Record<string, unknown>>[] = [
    {
      key: 'createdAt',
      label: 'Submitted',
      render: (row) => formatManilaDateTimeLabel(row.createdAt),
    },
    {
      key: 'submittedByName',
      label: 'From',
      render: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink-strong">
            {row.submittedByName ?? 'Unknown user'}
          </span>
          <Badge label={row.submittedByRole} />
        </span>
      ),
    },
    { key: 'categoryLabel', label: 'Category' },
    { key: 'rating', label: 'Rating', render: (row) => <Stars rating={row.rating} /> },
    {
      key: 'message',
      label: 'Feedback',
      className: 'whitespace-normal',
      render: (row) => <span className="line-clamp-3 max-w-md">{row.message}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge label={FEEDBACK_STATUS_LABELS[row.status]} tone={STATUS_TONES[row.status]} />
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <RowActions className="mt-0">
          <Button size="sm" variant="secondary" onClick={() => openReview(row)}>
            Review
          </Button>
        </RowActions>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total feedback" value={counts?.all ?? 0} tone="info" />
        <StatTile label="New" value={counts?.NEW ?? 0} tone="warning" />
        <StatTile label="Reviewed" value={counts?.REVIEWED ?? 0} tone="info" />
        <StatTile label="Resolved" value={counts?.RESOLVED ?? 0} tone="success" />
      </div>

      <FilterChips
        value={statusFilter}
        onChange={(value) => {
          setStatusFilter(value)
          setPage(1)
        }}
        options={[
          { label: 'All', value: 'all', count: counts?.all },
          ...FEEDBACK_STATUSES.map((value) => ({
            label: FEEDBACK_STATUS_LABELS[value],
            value,
            count: counts?.[value],
          })),
        ]}
      />

      <FilterChips
        value={categoryFilter}
        onChange={(value) => {
          setCategoryFilter(value)
          setPage(1)
        }}
        options={[
          { label: 'All categories', value: 'all' },
          ...FEEDBACK_CATEGORIES.map((value) => ({
            label: FEEDBACK_CATEGORY_LABELS[value],
            value,
          })),
        ]}
      />

      <SearchBar
        value={search}
        onChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        placeholder="Search feedback text…"
      />

      {error ? (
        <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          Failed to load feedback. Refresh to try again.
        </div>
      ) : null}

      <DataList
        columns={columns}
        data={rows as (AdminUserFeedbackDto & Record<string, unknown>)[]}
        loading={isLoading}
        emptyMessage="No feedback matches these filters"
        getRowKey={(row) => row.id}
      />

      {pagination && pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="secondary"
            disabled={pagination.page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-ink-muted">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}

      <Modal
        open={reviewing !== null}
        onClose={() => setReviewing(null)}
        title="Review feedback"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setReviewing(null)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={saveReview}>
              Save review
            </Button>
          </div>
        }
      >
        {reviewing ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-surface-border bg-surface-alt p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                <span className="font-semibold text-ink-strong">
                  {reviewing.submittedByName ?? 'Unknown user'}
                </span>
                <Badge label={reviewing.submittedByRole} />
                <span>{reviewing.categoryLabel}</span>
                <Stars rating={reviewing.rating} />
                <span>{formatManilaDateTimeLabel(reviewing.createdAt)}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-ink-body">
                {reviewing.message}
              </p>
            </div>

            {reviewError ? (
              <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                {reviewError}
              </div>
            ) : null}

            <Field label="Status" htmlFor="reviewStatus">
              <Select
                id="reviewStatus"
                value={reviewStatus}
                onChange={(event) =>
                  setReviewStatus(event.target.value as FeedbackStatusDto)
                }
              >
                {FEEDBACK_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {FEEDBACK_STATUS_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Internal notes"
              htmlFor="reviewNotes"
              hint="Only admins see these. The submitter is not notified."
            >
              <Textarea
                id="reviewNotes"
                rows={4}
                maxLength={FEEDBACK_REVIEW_NOTES_MAX_LENGTH}
                value={reviewNotes}
                onChange={(event) => setReviewNotes(event.target.value)}
              />
            </Field>

            {reviewing.reviewedByName ? (
              <p className="text-xs text-ink-muted">
                Last reviewed by {reviewing.reviewedByName}
                {reviewing.reviewedAt
                  ? ` on ${formatManilaDateTimeLabel(reviewing.reviewedAt)}`
                  : ''}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
