'use client'

import { useState } from 'react'

import Button from '@/ui/Button'
import { Field } from '@/ui/Field'
import PasswordInput from '@/ui/PasswordInput'
import { useFeedback } from '@/ui/FeedbackProvider'

export default function ChangePasswordForm() {
  const { toast } = useFeedback()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await response.json()

      if (response.ok) {
        toast('Password changed successfully')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setError(data.message || 'Failed to change password')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
      <div>
        <h3 className="text-lg font-bold text-ink-strong">Change Password</h3>
        <p className="text-sm text-ink-muted">Update the password you use to sign in.</p>
      </div>

      {error ? (
        <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </div>
      ) : null}

      <Field label="Current Password" htmlFor="currentPassword">
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          autoComplete="current-password"
          required
          placeholder="Enter your current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </Field>

      <Field label="New Password" htmlFor="newPassword">
        <PasswordInput
          id="newPassword"
          name="newPassword"
          autoComplete="new-password"
          required
          placeholder="Enter new password (min 8 characters)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </Field>

      <Field label="Confirm New Password" htmlFor="confirmNewPassword">
        <PasswordInput
          id="confirmNewPassword"
          name="confirmNewPassword"
          autoComplete="new-password"
          required
          placeholder="Re-enter new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </Field>

      <Button type="submit" size="sm" loading={loading}>
        {loading ? 'Saving...' : 'Change Password'}
      </Button>
    </form>
  )
}
