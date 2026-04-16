'use client'

import { useEffect, useMemo, useState } from 'react'

import type { AdminDriverOptionDto, AdminUserDto } from '@/lib/admin/user-management-contract'

import { createAdminUser, fetchAdminDriverOptions } from './api'
import { formatAdminUserTypeLabel, formatVehicleTypeLabel } from './display'

type CreateableUserType = 'ADMIN' | 'DATA_ENCODER' | 'ENFORCER' | 'DRIVER'

interface AdminUserForm {
  username: string
  firstName: string
  lastName: string
  phoneNumber: string
  userType: CreateableUserType
  driverVehicleId: string
  tempPassword: string
  department: string
  position: string
  employeeId: string
  notes: string
}

interface AdminUserCreateFormProps {
  onUserCreated: (user: AdminUserDto) => void
}

const EMPTY_USER_FORM: AdminUserForm = {
  username: '',
  firstName: '',
  lastName: '',
  phoneNumber: '',
  userType: 'DATA_ENCODER',
  driverVehicleId: '',
  tempPassword: '',
  department: '',
  position: '',
  employeeId: '',
  notes: '',
}

function LabeledInput({
  label,
  fieldId,
  children,
}: {
  label: string
  fieldId: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  )
}

export default function AdminUserCreateForm({ onUserCreated }: AdminUserCreateFormProps) {
  const [form, setForm] = useState<AdminUserForm>(EMPTY_USER_FORM)
  const [driverOptions, setDriverOptions] = useState<AdminDriverOptionDto[]>([])
  const [driverOptionsLoading, setDriverOptionsLoading] = useState(false)
  const [driverOptionsError, setDriverOptionsError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    message: string
    user: AdminUserDto
    tempPassword: string | null
  } | null>(null)

  const isDriverUser = form.userType === 'DRIVER'

  useEffect(() => {
    if (!isDriverUser) {
      return
    }

    let cancelled = false

    async function loadDriverOptions() {
      try {
        setDriverOptionsLoading(true)
        setDriverOptionsError(null)
        const nextOptions = await fetchAdminDriverOptions()

        if (!cancelled) {
          setDriverOptions(nextOptions)
        }
      } catch (driverOptionsLoadError) {
        if (!cancelled) {
          setDriverOptions([])
          setDriverOptionsError(
            driverOptionsLoadError instanceof Error
              ? driverOptionsLoadError.message
              : 'Failed to load registered drivers',
          )
        }
      } finally {
        if (!cancelled) {
          setDriverOptionsLoading(false)
        }
      }
    }

    void loadDriverOptions()

    return () => {
      cancelled = true
    }
  }, [isDriverUser])

  const selectedDriverOption = useMemo(
    () => driverOptions.find((option) => option.vehicleId === form.driverVehicleId) ?? null,
    [driverOptions, form.driverVehicleId],
  )

  function updateForm<K extends keyof AdminUserForm>(field: K, value: AdminUserForm[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function validateForm() {
    if (isDriverUser) {
      if (!form.driverVehicleId) {
        return 'Select a registered driver before creating the account.'
      }

      if (form.tempPassword.trim().length < 8) {
        return 'Temporary password must be at least 8 characters long.'
      }

      return null
    }

    if (!form.username.trim() || !form.firstName.trim() || !form.lastName.trim() || !form.phoneNumber.trim()) {
      return 'Username, first name, last name, and phone number are required.'
    }

    return null
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setResult(null)

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      setSubmitting(true)
      const response = await createAdminUser(form)

      setResult({
        message: response.message || 'Official account created successfully',
        user: response.data.user,
        tempPassword: response.data.tempPassword,
      })
      onUserCreated(response.data.user)
      setForm({
        ...EMPTY_USER_FORM,
        userType: form.userType,
      })

      if (isDriverUser) {
        setDriverOptions(await fetchAdminDriverOptions())
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  async function copySensitiveValue(value: string) {
    if (!navigator.clipboard) {
      return
    }

    await navigator.clipboard.writeText(value)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {result ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-emerald-900">{result.message}</h3>
              <p className="mt-1 text-sm text-emerald-800">
                {result.user.fullName} ({formatAdminUserTypeLabel(result.user.userType)}) was added as an active
                account.
              </p>
              <p className="mt-2 text-sm text-emerald-800">Username: @{result.user.username}</p>
            </div>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="text-sm font-medium text-emerald-800 hover:text-emerald-900"
            >
              Hide success state
            </button>
          </div>

          {result.tempPassword ? (
            <div className="mt-4 rounded-2xl border border-emerald-300 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    Temporary credential
                  </div>
                  <div className="mt-2 rounded-lg bg-slate-950 px-3 py-2 font-mono text-sm text-white">
                    {result.tempPassword}
                  </div>
                  <p className="mt-2 text-xs text-gray-600">
                    Share this password securely and ask the user to change it after first login.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void copySensitiveValue(result.tempPassword as string)}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Copy password
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <h3 className="text-lg font-semibold text-blue-900">Official account creation</h3>
        <p className="mt-2 text-sm text-blue-800">
          Use this form for administrator, data encoder, enforcer, and driver accounts. Public users should only
          enter the system through self-registration.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-gray-900">Account type</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <LabeledInput label="User role" fieldId="admin-user-role">
            <select
              id="admin-user-role"
              name="userType"
              value={form.userType}
              onChange={(event) => {
                const nextUserType = event.target.value as CreateableUserType

                setError(null)
                setResult(null)
                setForm({
                  ...EMPTY_USER_FORM,
                  userType: nextUserType,
                })
              }}
              className="block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
            >
              <option value="DATA_ENCODER">Data Encoder</option>
              <option value="ENFORCER">Enforcer</option>
              <option value="DRIVER">Driver</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </LabeledInput>
        </div>
      </div>

      {isDriverUser ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-gray-900">Driver provisioning</h3>
          <p className="mt-2 text-sm text-gray-600">
            Driver accounts are created from the registered driver list so the account stays linked to the correct
            assigned vehicle.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <LabeledInput label="Registered driver" fieldId="admin-driver-registered-option">
              <select
                id="admin-driver-registered-option"
                name="driverVehicleId"
                value={form.driverVehicleId}
                onChange={(event) => updateForm('driverVehicleId', event.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
              >
                <option value="">Select registered driver</option>
                {driverOptions.map((option) => (
                  <option key={option.vehicleId} value={option.vehicleId}>
                    {option.driverName} - {option.plateNumber} ({formatVehicleTypeLabel(option.vehicleType)})
                  </option>
                ))}
              </select>
              {driverOptionsLoading ? <p className="mt-2 text-sm text-gray-500">Loading registered drivers...</p> : null}
              {driverOptionsError ? <p className="mt-2 text-sm text-rose-700">{driverOptionsError}</p> : null}
              {!driverOptionsLoading && !driverOptionsError && driverOptions.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">No unassigned registered drivers are available right now.</p>
              ) : null}
            </LabeledInput>

            <LabeledInput label="Temporary password" fieldId="admin-driver-temp-password">
              <input
                id="admin-driver-temp-password"
                name="tempPassword"
                type="password"
                autoComplete="new-password"
                value={form.tempPassword}
                onChange={(event) => updateForm('tempPassword', event.target.value)}
                placeholder="Set a temporary password for the driver"
                className="block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
              />
            </LabeledInput>
          </div>

          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <h4 className="text-sm font-semibold text-gray-900">Driver record preview</h4>
            {selectedDriverOption ? (
              <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-gray-700 md:grid-cols-2">
                <div>
                  <span className="font-medium">Driver:</span> {selectedDriverOption.driverName}
                </div>
                <div>
                  <span className="font-medium">Plate:</span> {selectedDriverOption.plateNumber}
                </div>
                <div>
                  <span className="font-medium">Username:</span> {selectedDriverOption.username}
                </div>
                <div>
                  <span className="font-medium">Vehicle:</span> {formatVehicleTypeLabel(selectedDriverOption.vehicleType)}
                </div>
                <div>
                  <span className="font-medium">Permit Plate:</span> {selectedDriverOption.permitPlateNumber || 'Not linked'}
                </div>
                <div>
                  <span className="font-medium">License:</span> {selectedDriverOption.driverLicense || 'Not recorded'}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-600">Select a registered driver to review the linked vehicle context.</p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-gray-900">Account identity</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <LabeledInput label="Username" fieldId="admin-user-username">
                <input
                  id="admin-user-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={form.username}
                  onChange={(event) => updateForm('username', event.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                />
              </LabeledInput>

              <LabeledInput label="Phone number" fieldId="admin-user-phone-number">
                <input
                  id="admin-user-phone-number"
                  name="phoneNumber"
                  type="tel"
                  autoComplete="tel"
                  value={form.phoneNumber}
                  onChange={(event) => updateForm('phoneNumber', event.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                />
              </LabeledInput>

              <LabeledInput label="First name" fieldId="admin-user-first-name">
                <input
                  id="admin-user-first-name"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={(event) => updateForm('firstName', event.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                />
              </LabeledInput>

              <LabeledInput label="Last name" fieldId="admin-user-last-name">
                <input
                  id="admin-user-last-name"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={(event) => updateForm('lastName', event.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                />
              </LabeledInput>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-gray-900">Organization details</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <LabeledInput label="Employee ID" fieldId="admin-user-employee-id">
                <input
                  id="admin-user-employee-id"
                  name="employeeId"
                  type="text"
                  value={form.employeeId}
                  onChange={(event) => updateForm('employeeId', event.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                />
              </LabeledInput>

              <LabeledInput label="Department" fieldId="admin-user-department">
                <input
                  id="admin-user-department"
                  name="department"
                  type="text"
                  value={form.department}
                  onChange={(event) => updateForm('department', event.target.value)}
                  placeholder="e.g., Traffic Management"
                  className="block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                />
              </LabeledInput>

              <LabeledInput label="Position" fieldId="admin-user-position">
                <input
                  id="admin-user-position"
                  name="position"
                  type="text"
                  value={form.position}
                  onChange={(event) => updateForm('position', event.target.value)}
                  placeholder="e.g., Traffic Enforcer"
                  className="block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                />
              </LabeledInput>

              <LabeledInput label="Notes" fieldId="admin-user-notes">
                <textarea
                  id="admin-user-notes"
                  name="notes"
                  value={form.notes}
                  onChange={(event) => updateForm('notes', event.target.value)}
                  rows={3}
                  placeholder="Optional context about this account"
                  className="block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                />
              </LabeledInput>
            </div>
          </div>
        </>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? 'Creating account...'
            : isDriverUser
              ? `Create ${formatAdminUserTypeLabel(form.userType)} Account`
              : 'Create Official Account'}
        </button>
      </div>
    </form>
  )
}
