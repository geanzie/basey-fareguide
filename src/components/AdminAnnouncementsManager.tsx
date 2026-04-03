'use client'

import { useEffect, useMemo, useState } from 'react'

import type {
  AdminAnnouncementDto,
  AdminAnnouncementsResponseDto,
  AnnouncementCategoryDto,
} from '@/lib/contracts'
import {
  ANNOUNCEMENT_BODY_MAX_LENGTH,
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
} from '@/lib/announcements/categories'
import { formatManilaDateTimeInput, formatManilaDateTimeLabel } from '@/lib/manilaTime'

function getStatusClasses(status: AdminAnnouncementDto['status']) {
  switch (status) {
    case 'active':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800'
    case 'scheduled':
      return 'border-blue-200 bg-blue-50 text-blue-800'
    case 'archived':
      return 'border-amber-200 bg-amber-50 text-amber-800'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700'
  }
}

function formatStatusLabel(status: AdminAnnouncementDto['status']) {
  switch (status) {
    case 'active':
      return 'Active'
    case 'scheduled':
      return 'Scheduled'
    case 'archived':
      return 'Archived'
    default:
      return 'Expired'
  }
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-slate-500">{message}</p>
}

function AnnouncementCard({
  announcement,
  onArchive,
  onEdit,
  disabled,
}: {
  announcement: AdminAnnouncementDto
  onArchive: (announcement: AdminAnnouncementDto) => Promise<void>
  onEdit: (announcement: AdminAnnouncementDto) => void
  disabled: boolean
}) {
  const canManage = announcement.status === 'active' || announcement.status === 'scheduled'

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClasses(announcement.status)}`}
            >
              {formatStatusLabel(announcement.status)}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
              {announcement.categoryLabel}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-900">{announcement.title}</h3>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{announcement.body}</p>
          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <p>Visible from {formatManilaDateTimeLabel(announcement.startsAt)}</p>
            <p>
              Until{' '}
              {announcement.endsAt
                ? formatManilaDateTimeLabel(announcement.endsAt)
                : 'archived or manually replaced'}
            </p>
            <p>
              Created {formatManilaDateTimeLabel(announcement.createdAt)} by{' '}
              {announcement.createdByName || 'Unknown admin'}.
            </p>
            <p>
              Last updated {formatManilaDateTimeLabel(announcement.updatedAt)} by{' '}
              {announcement.updatedByName || 'Unknown admin'}.
            </p>
            {announcement.archivedAt && (
              <p>
                Archived {formatManilaDateTimeLabel(announcement.archivedAt)} by{' '}
                {announcement.archivedByName || 'Unknown admin'}.
              </p>
            )}
          </div>
        </div>

        {canManage && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => onEdit(announcement)}
              disabled={disabled}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => void onArchive(announcement)}
              disabled={disabled}
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Archive
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

export default function AdminAnnouncementsManager() {
  const [data, setData] = useState<AdminAnnouncementsResponseDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<AnnouncementCategoryDto>('TRAFFIC_ADVISORY')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const setupRequired = Boolean(data?.warning)

  const editingAnnouncement = useMemo(
    () =>
      editingId
        ? [...(data?.active ?? []), ...(data?.scheduled ?? [])].find(
            (announcement) => announcement.id === editingId,
          ) ?? null
        : null,
    [data, editingId],
  )

  useEffect(() => {
    void fetchAnnouncements()
  }, [])

  async function fetchAnnouncements() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/announcements')
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.message || payload.error || 'Failed to load announcements')
      }

      setData(payload as AdminAnnouncementsResponseDto)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load announcements')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setBody('')
    setCategory('TRAFFIC_ADVISORY')
    setStartsAt('')
    setEndsAt('')
  }

  function handleEdit(announcement: AdminAnnouncementDto) {
    setEditingId(announcement.id)
    setTitle(announcement.title)
    setBody(announcement.body)
    setCategory(announcement.category)
    setStartsAt(formatManilaDateTimeInput(announcement.startsAt))
    setEndsAt(formatManilaDateTimeInput(announcement.endsAt))
    setError(null)
    setSuccess(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(
        editingAnnouncement ? `/api/admin/announcements/${editingAnnouncement.id}` : '/api/admin/announcements',
        {
          method: editingAnnouncement ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            body,
            category,
            startsAt,
            endsAt: endsAt || null,
          }),
        },
      )

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.message || payload.error || 'Failed to save announcement')
      }

      setSuccess(
        payload.message ||
          (editingAnnouncement
            ? 'Traffic announcement updated successfully.'
            : 'Traffic announcement published successfully.'),
      )
      resetForm()
      await fetchAnnouncements()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save announcement')
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive(announcement: AdminAnnouncementDto) {
    setArchivingId(announcement.id)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/admin/announcements/${announcement.id}/archive`, {
        method: 'POST',
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.message || payload.error || 'Failed to archive announcement')
      }

      if (editingId === announcement.id) {
        resetForm()
      }

      setSuccess(payload.message || 'Traffic announcement archived successfully.')
      await fetchAnnouncements()
    } catch (archiveError) {
      setError(
        archiveError instanceof Error ? archiveError.message : 'Failed to archive announcement',
      )
    } finally {
      setArchivingId(null)
    }
  }

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Loading traffic announcement management...</p>
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

      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-slate-900">
            {editingAnnouncement ? 'Edit Traffic Announcement' : 'Publish a Traffic Announcement'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Use Manila time in the form. The server stores all announcement windows in UTC.
          </p>
          {setupRequired && (
            <p className="mt-2 text-sm text-amber-700">
              Publishing, editing, and archiving are disabled until the pending database migrations are applied.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="text-sm text-slate-700">
            <span className="mb-2 flex items-center justify-between font-medium text-slate-900">
              <span>Headline</span>
              <span className="text-xs text-slate-500">
                {title.length}/{ANNOUNCEMENT_TITLE_MAX_LENGTH}
              </span>
            </span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={ANNOUNCEMENT_TITLE_MAX_LENGTH}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="text-sm text-slate-700">
            <span className="mb-2 block font-medium text-slate-900">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as AnnouncementCategoryDto)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              {ANNOUNCEMENT_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {ANNOUNCEMENT_CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            <span className="mb-2 flex items-center justify-between font-medium text-slate-900">
              <span>Announcement body</span>
              <span className="text-xs text-slate-500">
                {body.length}/{ANNOUNCEMENT_BODY_MAX_LENGTH}
              </span>
            </span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={ANNOUNCEMENT_BODY_MAX_LENGTH}
              rows={5}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              <span className="mb-2 block font-medium text-slate-900">Start date and time (Asia/Manila)</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-2 block font-medium text-slate-900">
                End date and time (Asia/Manila, optional)
              </span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving || setupRequired}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving
                ? 'Saving announcement...'
                : editingAnnouncement
                  ? 'Save announcement changes'
                  : 'Publish announcement'}
            </button>

            {editingAnnouncement && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel editing
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-slate-900">Active Announcements</h2>
          <p className="mt-1 text-sm text-slate-600">
            These notices are visible to constituents right now.
          </p>
        </div>

        <div className="space-y-3">
          {data?.active.length ? (
            data.active.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                onEdit={handleEdit}
                onArchive={handleArchive}
                disabled={setupRequired || archivingId === announcement.id}
              />
            ))
          ) : (
            <EmptyState message="No active traffic announcements right now." />
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-slate-900">Scheduled Announcements</h2>
          <p className="mt-1 text-sm text-slate-600">
            Upcoming notices stay hidden until their Manila start time arrives.
          </p>
        </div>

        <div className="space-y-3">
          {data?.scheduled.length ? (
            data.scheduled.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                onEdit={handleEdit}
                onArchive={handleArchive}
                disabled={setupRequired || archivingId === announcement.id}
              />
            ))
          ) : (
            <EmptyState message="No scheduled traffic announcements." />
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-slate-900">Announcement History</h2>
          <p className="mt-1 text-sm text-slate-600">
            Expired and archived notices stay here for audit review.
          </p>
        </div>

        <div className="space-y-3">
          {data?.history.length ? (
            data.history.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                onEdit={handleEdit}
                onArchive={handleArchive}
                disabled
              />
            ))
          ) : (
            <EmptyState message="No announcement history is available yet." />
          )}
        </div>
      </section>
    </div>
  )
}
