'use client'

import { useState, useEffect } from 'react'
import useSWR, { useSWRConfig } from 'swr'

import Badge from '@/ui/Badge'
import Button from '@/ui/Button'
import Card from '@/ui/Card'
import { Field, Input, Select } from '@/ui/Field'
import { FormSkeleton } from '@/ui/Skeleton'
import { useFeedback } from '@/ui/FeedbackProvider'
import type { UserProfileDto, UserProfileResponseDto } from '@/lib/contracts'
import { SWR_KEYS } from '@/lib/swrKeys'
import { fetchUserProfileResponse } from '@/lib/userProfile'

const ID_TYPES = [
  'National ID',
  "Driver's License",
  'Passport',
  "Voter's ID",
  'PhilHealth ID',
  'SSS ID',
  'TIN ID',
  'Senior Citizen ID',
  'PWD ID',
  'Student ID',
]

export default function UserProfile() {
  const { mutate: mutateCache } = useSWRConfig()
  const { toast } = useFeedback()
  const { data, isLoading } = useSWR<UserProfileResponseDto | null>(
    SWR_KEYS.userProfile,
    fetchUserProfileResponse,
  )
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    dateOfBirth: '',
    governmentId: '',
    idType: '',
    barangayResidence: ''
  })

  useEffect(() => {
    const user = data?.user

    if (!user) {
      return
    }

    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
      governmentId: user.governmentId || '',
      idType: user.idType || '',
      barangayResidence: user.barangayResidence || ''
    })
  }, [data])

  const user: UserProfileDto | null = data?.user ?? null

  const handleSaveProfile = async () => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const responseData = await response.json()

      if (response.ok) {
        await mutateCache(
          SWR_KEYS.userProfile,
          { user: responseData.user },
          { populateCache: true, revalidate: false },
        )
        setIsEditing(false)
        toast('Profile updated')
      } else {
        setError(responseData.message || 'Failed to update profile')
      }
    } catch {
      setError('An error occurred while updating profile')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const resetForm = () => {
    if (!user) return
    setIsEditing(false)
    setError('')
    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
      governmentId: user.governmentId || '',
      idType: user.idType || '',
      barangayResidence: user.barangayResidence || ''
    })
  }

  if (isLoading && !user) {
    return (
      <Card>
        <FormSkeleton fields={4} />
      </Card>
    )
  }

  if (!user) {
    return (
      <Card>
        <p className="text-danger">{error || 'User not found'}</p>
      </Card>
    )
  }

  return (
    <Card padded={false}>
      <div className="flex flex-col gap-3 border-b border-surface-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink-strong">Profile details</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Keep your account information current for fare history and support.
          </p>
        </div>
        {!isEditing ? (
          <Button size="sm" onClick={() => setIsEditing(true)}>
            Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" loading={saving} onClick={handleSaveProfile}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6">
        {error && (
          <div className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="border-b border-surface-border pb-2 text-base font-bold text-ink-strong">
              Basic Information
            </h3>

            <Field label="Username" htmlFor="profile-username" hint="Username cannot be changed">
              <Input
                id="profile-username"
                name="username"
                type="text"
                autoComplete="username"
                value={user.username}
                disabled
              />
            </Field>

            <Field label="First Name" htmlFor="profile-first-name">
              <Input
                id="profile-first-name"
                type="text"
                name="firstName"
                autoComplete="given-name"
                value={isEditing ? formData.firstName : user.firstName || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
              />
            </Field>

            <Field label="Last Name" htmlFor="profile-last-name">
              <Input
                id="profile-last-name"
                type="text"
                name="lastName"
                autoComplete="family-name"
                value={isEditing ? formData.lastName : user.lastName || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
              />
            </Field>

            <Field label="Email Address" htmlFor="profile-email" hint="Required for password reset">
              <Input
                id="profile-email"
                type="email"
                name="email"
                autoComplete="email"
                value={isEditing ? formData.email : user.email || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                placeholder="your@email.com"
              />
            </Field>

            <Field label="Phone Number" htmlFor="profile-phone-number">
              <Input
                id="profile-phone-number"
                type="tel"
                name="phoneNumber"
                autoComplete="tel"
                value={isEditing ? formData.phoneNumber : user.phoneNumber || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                placeholder="09xxxxxxxxx"
              />
            </Field>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <h3 className="border-b border-surface-border pb-2 text-base font-bold text-ink-strong">
              Additional Information
            </h3>

            <Field label="Date of Birth" htmlFor="profile-date-of-birth">
              <Input
                id="profile-date-of-birth"
                type="date"
                name="dateOfBirth"
                autoComplete="bday"
                value={isEditing ? formData.dateOfBirth : user.dateOfBirth ? user.dateOfBirth.split('T')[0] : ''}
                onChange={handleInputChange}
                disabled={!isEditing}
              />
            </Field>

            <Field label="Government ID Type" htmlFor="profile-id-type">
              <Select
                id="profile-id-type"
                name="idType"
                autoComplete="off"
                value={isEditing ? formData.idType : user.idType || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
              >
                <option value="">Select ID Type</option>
                {ID_TYPES.map((idType) => (
                  <option key={idType} value={idType}>
                    {idType}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Government ID Number" htmlFor="profile-government-id">
              <Input
                id="profile-government-id"
                type="text"
                name="governmentId"
                autoComplete="off"
                value={isEditing ? formData.governmentId : user.governmentId || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
              />
            </Field>

            <Field label="Barangay Residence" htmlFor="profile-barangay-residence">
              <Input
                id="profile-barangay-residence"
                type="text"
                name="barangayResidence"
                autoComplete="off"
                value={isEditing ? formData.barangayResidence : user.barangayResidence || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
              />
            </Field>

            {/* Account Status */}
            <div className="mt-6 rounded-xl bg-surface-alt p-4">
              <h4 className="mb-2 text-sm font-bold text-ink-strong">Account Status</h4>
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm text-ink-muted">
                  User Type:
                  <span className="font-medium capitalize text-ink-body">{user.userType.toLowerCase()}</span>
                </p>
                <p className="flex items-center gap-2 text-sm text-ink-muted">
                  Status: <Badge label={user.isActive ? 'Active' : 'Inactive'} tone={user.isActive ? 'success' : 'muted'} />
                </p>
                <p className="flex items-center gap-2 text-sm text-ink-muted">
                  Verified: <Badge label={user.isVerified ? 'Verified' : 'Pending'} tone={user.isVerified ? 'success' : 'warning'} />
                </p>
                <p className="text-sm text-ink-muted">
                  Member Since:{' '}
                  <span className="font-medium text-ink-body">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
