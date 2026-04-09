'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'

import { useAuth } from '@/components/AuthProvider'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
} from '@/components/dashboardIcons'
import LoadingSpinner from '@/components/LoadingSpinner'
import type { FareCalculationDto, FareCalculationsResponseDto, VehicleLookupDto } from '@/lib/contracts'
import {
  REPORTABLE_FARE_HISTORY_DAYS,
  REPORTABLE_FARE_HISTORY_LIMIT,
  buildTripRouteLabel,
  formatVehicleIdentity,
} from '@/lib/incidents/reportTripSelection'
import { resolvePinLabel } from '@/lib/locations/pinLabelResolver'

import VehicleLookupField from './VehicleLookupField'

interface IncidentFormState {
  incidentType: string
  description: string
  incidentDate: string
  incidentTime: string
  location: string
  vehicleId: string
  plateNumber: string
  driverLicense: string
  vehicleType: string
  evidenceFiles: File[]
}

interface GPSPosition {
  latitude: number
  longitude: number
}

const barangays = [
  'Amandayehan', 'Anglit', 'Bacubac', 'Baloog', 'Basiao', 'Buenavista', 'Burgos',
  'Cambayan', 'Can-abay', 'Cancaiyas', 'Canmanila', 'Catadman', 'Cogon', 'Dolongan',
  'Guintigui-an', 'Guirang', 'Balante', 'Iba', 'Inuntan', 'Loog', 'Mabini',
  'Magallanes', 'Manlilinab', 'Del Pilar', 'May-it', 'Mongabong', 'New San Agustin',
  'Nouvelas Occidental', 'Old San Agustin', 'Panugmonon', 'Pelit',
  'Baybay (Poblacion)', 'Buscada (Poblacion)', 'Lawa-an (Poblacion)', 'Loyo (Poblacion)',
  'Mercado (Poblacion)', 'Palaypay (Poblacion)', 'Sulod (Poblacion)',
  'Roxas', 'Salvacion', 'San Antonio', 'San Fernando', 'Sawa', 'Serum', 'Sugca',
  'Sugponon', 'Tinaogan', 'Tingib', 'Villa Aurora', 'Binongtu-an', 'Bulao',
]

const incidentTypes = [
  { value: 'FARE_OVERCHARGE', label: 'Fare Overcharging' },
  { value: 'FARE_UNDERCHARGE', label: 'Fare Undercharging' },
  { value: 'RECKLESS_DRIVING', label: 'Reckless Driving' },
  { value: 'VEHICLE_VIOLATION', label: 'Vehicle Violation' },
  { value: 'ROUTE_VIOLATION', label: 'Route Violation' },
  { value: 'OTHER', label: 'Other Violation' },
]

function getDefaultFormState(): IncidentFormState {
  return {
    incidentType: '',
    description: '',
    incidentDate: new Date().toISOString().split('T')[0],
    incidentTime: new Date().toTimeString().slice(0, 5),
    location: '',
    vehicleId: '',
    plateNumber: '',
    driverLicense: '',
    vehicleType: '',
    evidenceFiles: [],
  }
}

function formatCurrency(amount: number): string {
  return `PHP ${amount.toFixed(2)}`
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatCompactTripDateTime(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function toDateInputValue(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return getDefaultFormState().incidentDate
  }

  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

function toTimeInputValue(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return getDefaultFormState().incidentTime
  }

  return date.toTimeString().slice(0, 5)
}

function getTripVehicleLabel(trip: FareCalculationDto): string | null {
  return formatVehicleIdentity(
    trip.vehicle?.permitPlateNumber ?? null,
    trip.vehicle?.plateNumber ?? null,
  )
}

function buildTripPickerLabel(trip: FareCalculationDto): string {
  return `${buildTripRouteLabel(trip.from, trip.to)} | ${formatCompactTripDateTime(trip.createdAt)} | ${formatCurrency(trip.fare)}`
}

const IncidentReporting = () => {
  const auth = useAuth()
  const authStatus = auth.status ?? (auth.user ? 'authenticated' : 'unauthenticated')
  const [formData, setFormData] = useState<IncidentFormState>(getDefaultFormState())
  const [currentLocation, setCurrentLocation] = useState<GPSPosition | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleLookupDto | null>(null)
  const [recentTrips, setRecentTrips] = useState<FareCalculationDto[]>([])
  const [selectedTripId, setSelectedTripId] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [locationLoading, setLocationLoading] = useState(false)

  const selectedTrip = useMemo(
    () => recentTrips.find((trip) => trip.id === selectedTripId) ?? null,
    [recentTrips, selectedTripId],
  )
  const hasEligibleTrips = recentTrips.length > 0
  const usingManualFallback = !hasEligibleTrips
  const shouldShowIncidentDetails = usingManualFallback || Boolean(selectedTrip)
  const requiresSupplementalVehicle = usingManualFallback || (selectedTrip ? !selectedTrip.vehicle?.hasVehicleContext : false)
  const hasCustomLocationOption = Boolean(formData.location) && !barangays.includes(formData.location)

  const loadTripHistory = async () => {
    if (!auth.user) {
      setRecentTrips([])
      setHistoryLoading(false)
      setHistoryError('')
      return
    }

    setHistoryLoading(true)
    setHistoryError('')

    try {
      const params = new URLSearchParams({
        page: '1',
        limit: String(REPORTABLE_FARE_HISTORY_LIMIT),
        recentDays: String(REPORTABLE_FARE_HISTORY_DAYS),
      })
      const response = await fetch(`/api/fare-calculations?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Unable to load your recent trip history right now.')
      }

      const data: FareCalculationsResponseDto = await response.json()
      setRecentTrips(data.calculations || [])
    } catch (caughtError) {
      setRecentTrips([])
      setHistoryError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to load your recent trip history right now.',
      )
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (authStatus === 'loading') {
      return
    }

    void loadTripHistory()
  }, [auth.user?.id, authStatus])

  const handleTripSelect = (trip: FareCalculationDto) => {
    setSelectedTripId(trip.id)
    setSelectedVehicle(null)
    setCurrentLocation(null)
    setError('')
    setSuccess('')
    setFormData((prev) => ({
      ...prev,
      incidentDate: toDateInputValue(trip.createdAt),
      incidentTime: toTimeInputValue(trip.createdAt),
      location: '',
      vehicleId: '',
      plateNumber: '',
      driverLicense: '',
      vehicleType: '',
    }))
  }

  const clearSelectedTrip = () => {
    setSelectedTripId('')
    setSelectedVehicle(null)
    setCurrentLocation(null)
    setFormData((prev) => ({
      ...prev,
      vehicleId: '',
      plateNumber: '',
      driverLicense: '',
      vehicleType: '',
    }))
  }

  const handleTripPickerChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextTripId = event.target.value

    if (!nextTripId) {
      clearSelectedTrip()
      return
    }

    const trip = recentTrips.find((recentTrip) => recentTrip.id === nextTripId)

    if (trip) {
      handleTripSelect(trip)
    }
  }

  const handleVehicleSelect = (vehicle: VehicleLookupDto) => {
    setSelectedVehicle(vehicle)
    setFormData((prev) => ({
      ...prev,
      vehicleId: vehicle.id,
      plateNumber: vehicle.plateNumber,
      vehicleType: vehicle.vehicleType,
      driverLicense: vehicle.driverLicense || '',
    }))
  }

  const clearSelectedVehicle = () => {
    setSelectedVehicle(null)
    setFormData((prev) => ({
      ...prev,
      vehicleId: '',
      plateNumber: '',
      vehicleType: '',
      driverLicense: '',
    }))
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }

    setLocationLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const gpsPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }
        const resolvedLocation = resolvePinLabel(gpsPosition.latitude, gpsPosition.longitude)

        setCurrentLocation(gpsPosition)
        setFormData((prev) => ({
          ...prev,
          location: resolvedLocation.displayLabel,
        }))
        setLocationLoading(false)
      },
      () => {
        setError('Unable to get your GPS location. Please select the location manually.')
        setLocationLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      },
    )
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setFormData((prev) => ({
      ...prev,
      evidenceFiles: files,
    }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (hasEligibleTrips && !selectedTrip) {
        setError('Select the trip you want to report before submitting the incident.')
        return
      }

      if (!formData.incidentType || !formData.description) {
        setError('Please fill in the incident type and description before submitting.')
        return
      }

      if (usingManualFallback && !formData.location && !currentLocation) {
        setError('Please provide the incident location before submitting.')
        return
      }

      if (requiresSupplementalVehicle && !formData.vehicleId) {
        setError(
          usingManualFallback
            ? 'Please select a vehicle to report before submitting.'
            : 'This trip has no linked vehicle, so select the vehicle involved before submitting.',
        )
        return
      }

      const submitData = new FormData()
      submitData.append('incidentType', formData.incidentType)
      submitData.append('description', formData.description)
      submitData.append('incidentDate', formData.incidentDate)
      submitData.append('incidentTime', formData.incidentTime)

      if (selectedTrip) {
        submitData.append('fareCalculationId', selectedTrip.id)
      } else {
        submitData.append('location', formData.location)
        if (currentLocation) {
          submitData.append('coordinates', JSON.stringify(currentLocation))
        }
      }

      if (requiresSupplementalVehicle) {
        submitData.append('vehicleId', formData.vehicleId)
      }

      formData.evidenceFiles.forEach((file, index) => {
        submitData.append(`evidence_${index}`, file)
      })

      const response = await fetch('/api/incidents/report', {
        method: 'POST',
        body: submitData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to submit report')
        return
      }

      const data = await response.json()
      const evidenceSummary = data.evidenceCount
        ? ` ${data.evidenceCount} evidence file(s) saved.`
        : ''
      setSuccess(`Incident report submitted successfully. Reference number: ${data.referenceNumber}.${evidenceSummary}`)
      setFormData(getDefaultFormState())
      setCurrentLocation(null)
      setSelectedVehicle(null)
      setSelectedTripId('')
      await loadTripHistory()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (authStatus === 'loading') {
    return (
      <div className="app-surface-card mx-auto max-w-4xl rounded-3xl p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <LoadingSpinner className="justify-center text-red-600" size={28} />
            <p className="mt-3 text-gray-600">Loading incident reporting...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!auth.user) {
    return (
      <div className="app-surface-card mx-auto max-w-4xl rounded-3xl p-8">
        <div className="text-center mb-8">
          <div className={`${getDashboardIconChipClasses('red')} mx-auto mb-4 h-16 w-16 rounded-full`}>
            <DashboardIconSlot icon={DASHBOARD_ICONS.incidents} size={DASHBOARD_ICON_POLICY.sizes.hero} />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Report an Incident</h2>
          <p className="text-gray-600">Sign in to choose one of your recent trips before filing a report.</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 text-center text-blue-800">
          <p className="font-semibold">You need an account session to report against trip history.</p>
          <p className="mt-2 text-sm">Log in as a public rider to access your last {REPORTABLE_FARE_HISTORY_LIMIT} saved trips from the last {REPORTABLE_FARE_HISTORY_DAYS} days.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-surface-card mx-auto max-w-4xl rounded-3xl p-8">
      <div className="text-center mb-8">
        <div className={`${getDashboardIconChipClasses('red')} mx-auto mb-4 h-16 w-16 rounded-full`}>
          <DashboardIconSlot icon={DASHBOARD_ICONS.incidents} size={DASHBOARD_ICON_POLICY.sizes.hero} />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Report an Incident</h2>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <DashboardIconSlot icon={DASHBOARD_ICONS.reports} size={DASHBOARD_ICON_POLICY.sizes.alert} className="text-red-600" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <DashboardIconSlot icon={DASHBOARD_ICONS.check} size={DASHBOARD_ICON_POLICY.sizes.alert} className="text-green-600" />
          <span>{success}</span>
        </div>
      ) : null}

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Step 1</p>
            <h3 className="text-xl font-semibold text-slate-900">Select Trip to Report</h3>
            <p className="mt-1 text-xs text-slate-500">Latest {REPORTABLE_FARE_HISTORY_LIMIT} trips from the last {REPORTABLE_FARE_HISTORY_DAYS} days.</p>
          </div>
          {selectedTrip ? (
            <button
              type="button"
              onClick={clearSelectedTrip}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clear selection
            </button>
          ) : null}
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="text-center">
              <LoadingSpinner className="justify-center text-red-600" size={24} />
              <p className="mt-3 text-sm text-slate-600">Loading your recent trip history...</p>
            </div>
          </div>
        ) : historyError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{historyError}</p>
            <button
              type="button"
              onClick={() => void loadTripHistory()}
              className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              Retry loading trips
            </button>
          </div>
        ) : hasEligibleTrips ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label htmlFor="recentTripPicker" className="block text-sm font-medium text-slate-700">
                Recent trips
              </label>
              <select
                id="recentTripPicker"
                value={selectedTripId}
                onChange={handleTripPickerChange}
                className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-red-500 focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select a recent trip</option>
                {recentTrips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {buildTripPickerLabel(trip)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <h4 className="text-base font-semibold text-slate-900">No recent saved trips available</h4>
            <p className="mt-2 text-sm text-slate-600">Use the manual report form below.</p>
          </div>
        )}
      </section>

      {selectedTrip ? (
        <section className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-red-700">Selected trip</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">{buildTripRouteLabel(selectedTrip.from, selectedTrip.to)}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-red-100 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Trip date and time</p>
              <p className="mt-1 text-sm text-slate-800">{formatDateTime(selectedTrip.createdAt)}</p>
            </div>
            <div className="rounded-xl border border-red-100 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Quoted fare</p>
              <p className="mt-1 text-sm text-slate-800">{formatCurrency(selectedTrip.fare)}</p>
            </div>
            <div className="rounded-xl border border-red-100 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Calculation type</p>
              <p className="mt-1 text-sm text-slate-800">{selectedTrip.calculationType}</p>
            </div>
            <div className="rounded-xl border border-red-100 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Vehicle context</p>
              <p className="mt-1 text-sm text-slate-800">
                {getTripVehicleLabel(selectedTrip) || 'No vehicle was linked to this saved trip.'}
              </p>
              {selectedTrip.vehicle?.vehicleType ? (
                <p className="mt-1 text-xs text-slate-500">{selectedTrip.vehicle.vehicleType.replace(/_/g, ' ')}</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {shouldShowIncidentDetails ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Step 2</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">Describe the Incident</h3>

            <div className="mt-5 space-y-6">
              <div>
                <label htmlFor="incidentType" className="block text-sm font-medium text-gray-700 mb-2">
                  Incident Type *
                </label>
                <select
                  id="incidentType"
                  name="incidentType"
                  value={formData.incidentType}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Select incident type</option>
                  {incidentTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Incident Description *
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Please provide a detailed description of what happened..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="incidentDate" className="block text-sm font-medium text-gray-700 mb-2">
                    Incident Date *
                  </label>
                  <input
                    type="date"
                    id="incidentDate"
                    name="incidentDate"
                    value={formData.incidentDate}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <div>
                  <label htmlFor="incidentTime" className="block text-sm font-medium text-gray-700 mb-2">
                    Incident Time *
                  </label>
                  <input
                    type="time"
                    id="incidentTime"
                    name="incidentTime"
                    value={formData.incidentTime}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>

              {usingManualFallback ? (
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                    Location *
                  </label>
                  <div className="flex space-x-2">
                    <select
                      id="location"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      required
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    >
                      <option value="">Select barangay</option>
                      {hasCustomLocationOption ? (
                        <option value={formData.location}>{formData.location}</option>
                      ) : null}
                      {barangays.map((barangay) => (
                        <option key={barangay} value={barangay}>
                          {barangay}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={getCurrentLocation}
                      disabled={locationLoading}
                      className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 inline-flex items-center gap-2"
                      title="Capture current GPS coordinates"
                    >
                      {locationLoading ? (
                        <>
                          <LoadingSpinner size={16} className="text-white" />
                          <span>Loading GPS</span>
                        </>
                      ) : (
                        <>
                          <DashboardIconSlot icon={DASHBOARD_ICONS.map} size={DASHBOARD_ICON_POLICY.sizes.button} />
                          <span>Use GPS</span>
                        </>
                      )}
                    </button>
                  </div>
                  {currentLocation ? (
                    <p className="text-xs text-green-600 mt-1">
                      GPS pinned to {formData.location || 'your current location'} ({currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)})
                    </p>
                  ) : null}
                </div>
              ) : null}

              {requiresSupplementalVehicle ? (
                <div>
                  <label htmlFor="vehicleId" className="block text-sm font-medium text-gray-700 mb-2">
                    {usingManualFallback ? 'Select Vehicle to Report *' : 'Confirm Vehicle for This Trip *'}
                  </label>
                  <VehicleLookupField
                    label="Vehicle Search"
                    placeholder="Type at least 2 characters to search matching vehicles"
                    selectedVehicle={selectedVehicle}
                    onSelect={handleVehicleSelect}
                    onClearSelection={clearSelectedVehicle}
                    requireActivePermit
                    noResultsText="No active permitted vehicles matched your search."
                  />

                  {formData.vehicleId && selectedVehicle ? (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-1">Selected vehicle</h4>
                      <div className="text-sm text-blue-700 space-y-1">
                        <p><strong>Plate Number:</strong> {formData.plateNumber}</p>
                        <p><strong>Type:</strong> {formData.vehicleType.replace(/_/g, ' ')}</p>
                        {selectedVehicle.ownerName ? (
                          <p><strong>Owner:</strong> {selectedVehicle.ownerName}</p>
                        ) : null}
                        {formData.driverLicense ? (
                          <p><strong>Driver License:</strong> {formData.driverLicense}</p>
                        ) : null}
                        {selectedVehicle.permitPlateNumber ? (
                          <p><strong>Permit:</strong> {selectedVehicle.permitPlateNumber} <span className="text-green-600 ml-1">Active</span></p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div>
                <label htmlFor="evidence" className="block text-sm font-medium text-gray-700 mb-2">
                  Evidence (Optional)
                </label>
                <input
                  type="file"
                  id="evidence"
                  name="evidence"
                  onChange={handleFileChange}
                  multiple
                  accept="image/*,video/*,audio/*,.pdf"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Images, audio, and PDFs up to 10MB each. Videos up to 50MB.
                </p>
                {formData.evidenceFiles.length > 0 ? (
                  <div className="mt-2 text-sm text-green-600 inline-flex items-center gap-2">
                    <DashboardIconSlot icon={DASHBOARD_ICONS.check} size={DASHBOARD_ICON_POLICY.sizes.button} />
                    <span>{formData.evidenceFiles.length} file(s) selected for upload</span>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 inline-flex items-center"
            >
              {loading ? (
                <>
                  <LoadingSpinner size={20} className="mr-3 text-white" />
                  Submitting...
                </>
              ) : (
                <>
                  <DashboardIconSlot icon={DASHBOARD_ICONS.incidents} size={DASHBOARD_ICON_POLICY.sizes.button} className="mr-2" />
                  Submit Report
                </>
              )}
            </button>
          </div>
        </form>
      ) : hasEligibleTrips ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-slate-600">
          Select one trip above to continue to the incident form.
        </div>
      ) : null}

      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center mb-2 gap-2">
          <DashboardIconSlot icon={DASHBOARD_ICONS.phone} size={DASHBOARD_ICON_POLICY.sizes.section} className="text-yellow-700" />
          <h3 className="font-semibold text-yellow-800">Emergency hotlines</h3>
        </div>
        <div className="space-y-1 text-sm text-yellow-700">
          <p>Traffic Enforcement: 09985986570</p>
          <p>Municipal Office: 09177140798</p>
          <p>Emergency: 911</p>
        </div>
      </div>
    </div>
  )
}

export default IncidentReporting
