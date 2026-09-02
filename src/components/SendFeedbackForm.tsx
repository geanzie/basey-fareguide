'use client'

import { useState } from 'react'

import { DASHBOARD_ICONS, DashboardIconSlot } from '@/components/dashboardIcons'
import type { FeedbackCategoryDto } from '@/lib/contracts'
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_MESSAGE_MAX_LENGTH,
  FEEDBACK_MESSAGE_MIN_LENGTH,
} from '@/lib/feedback/categories'
import { SWR_KEYS } from '@/lib/swrKeys'
import Button from '@/ui/Button'
import { Field, Select, Textarea } from '@/ui/Field'
import { useFeedback } from '@/ui/FeedbackProvider'

const RATINGS = [1, 2, 3, 4, 5] as const

export default function SendFeedbackForm() {
  const { toast } = useFeedback()
  const [category, setCategory] = useState<FeedbackCategoryDto>('FARE_CALCULATOR')
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const trimmedLength = message.trim().length
  const canSubmit =
    rating > 0 && trimmedLength >= FEEDBACK_MESSAGE_MIN_LENGTH && !loading

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (rating === 0) {
      setError('Give a rating from 1 to 5 stars.')
      return
    }

    if (trimmedLength < FEEDBACK_MESSAGE_MIN_LENGTH) {
      setError(`Tell us a little more — at least ${FEEDBACK_MESSAGE_MIN_LENGTH} characters.`)
      return
    }

    setLoading(true)

    try {
      const response = await fetch(SWR_KEYS.feedback, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, rating, message: message.trim() }),
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        toast('Feedback sent')
        setCategory('FARE_CALCULATOR')
        setRating(0)
        setMessage('')
        setSent(true)
      } else {
        setError(data.message || 'Failed to send feedback')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-card border border-surface-border bg-surface p-4 shadow-card sm:p-6">
      <div>
        <h3 className="text-lg font-bold text-ink-strong">Send Feedback</h3>
        <p className="text-sm text-ink-muted">
          Tell us what works, what is broken, and what would make FareCheck more useful.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </div>
      ) : null}

      {sent && !error ? (
        <div className="rounded-xl bg-surface-tint px-4 py-3 text-sm font-medium text-primary-dark">
          Thanks — the municipality reads these.
        </div>
      ) : null}

      <Field label="What is this about?" htmlFor="feedbackCategory" required>
        <Select
          id="feedbackCategory"
          name="category"
          value={category}
          onChange={(event) => setCategory(event.target.value as FeedbackCategoryDto)}
        >
          {FEEDBACK_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {FEEDBACK_CATEGORY_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="How is it working for you?" required>
        <div className="flex items-center gap-2">
          {RATINGS.map((value) => {
            const active = value <= rating
            return (
              <button
                key={value}
                type="button"
                aria-label={`${value} star${value > 1 ? 's' : ''}`}
                aria-pressed={value === rating}
                onClick={() => setRating(value)}
                className={`rounded-xl border p-2 transition-colors ${
                  active
                    ? 'border-amber-300 bg-amber-50 text-amber-500'
                    : 'border-surface-border bg-surface text-ink-faint hover:border-ink-faint'
                }`}
              >
                <DashboardIconSlot
                  icon={DASHBOARD_ICONS.star}
                  size={20}
                  className={active ? 'fill-current' : ''}
                />
              </button>
            )
          })}
        </div>
      </Field>

      <Field
        label="Your feedback"
        htmlFor="feedbackMessage"
        required
        hint={`${message.length}/${FEEDBACK_MESSAGE_MAX_LENGTH} characters`}
      >
        <Textarea
          id="feedbackMessage"
          name="message"
          rows={5}
          required
          maxLength={FEEDBACK_MESSAGE_MAX_LENGTH}
          placeholder="What happened, what you expected, or what you would like added"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </Field>

      <Button type="submit" loading={loading} disabled={!canSubmit} className="w-full">
        {loading ? 'Sending...' : 'Send Feedback'}
      </Button>
    </form>
  )
}
