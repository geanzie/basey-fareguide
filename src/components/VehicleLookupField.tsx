'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import type { VehicleLookupDto, VehicleLookupResponseDto } from '@/lib/contracts'

const DEFAULT_LIMIT = 20
const DEFAULT_MIN_QUERY_LENGTH = 2
const DEFAULT_DEBOUNCE_MS = 300

interface VehicleLookupFieldProps {
  label: string
  onSelect: (vehicle: VehicleLookupDto) => void
  placeholder?: string
  selectedVehicle: VehicleLookupDto | null
  helperText?: string
  noResultsText?: string
  requireActivePermit?: boolean
  disabled?: boolean
  resultFilter?: (vehicle: VehicleLookupDto) => boolean
  onClearSelection?: () => void
}

export default function VehicleLookupField({
  label,
  onSelect,
  placeholder = 'Search by plate number, permit, owner, or driver name',
  selectedVehicle,
  helperText,
  noResultsText = 'No vehicles matched your search.',
  requireActivePermit = true,
  disabled = false,
  resultFilter,
  onClearSelection,
}: VehicleLookupFieldProps) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<VehicleLookupDto[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const requestRef = useRef<AbortController | null>(null)
  const selectedLabel = selectedVehicle
    ? selectedVehicle.permitPlateNumber || selectedVehicle.plateNumber
    : null

  useEffect(() => {
    if (!selectedLabel) {
      return
    }

    setQuery(selectedLabel)
  }, [selectedLabel])

  useEffect(() => {
    if (disabled) {
      setOptions([])
      setIsOpen(false)
      setIsLoading(false)
      return
    }

    const trimmedQuery = query.trim()

    if (trimmedQuery.length < DEFAULT_MIN_QUERY_LENGTH) {
      requestRef.current?.abort()
      setOptions([])
      setIsLoading(false)
      setHasSearched(false)
      setError(null)
      return
    }

    if (selectedLabel && trimmedQuery === selectedLabel && !isOpen) {
      requestRef.current?.abort()
      setOptions([])
      setIsLoading(false)
      setHasSearched(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    requestRef.current?.abort()
    requestRef.current = controller

    const timer = setTimeout(async () => {
      setIsLoading(true)
      setHasSearched(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          search: trimmedQuery,
          limit: String(DEFAULT_LIMIT),
          activeOnly: 'true',
          requireActivePermit: requireActivePermit ? 'true' : 'false',
        })
        const response = await fetch(`/api/vehicles/options?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Unable to load matching vehicles right now.')
        }

        const data: VehicleLookupResponseDto = await response.json()
        setOptions(data.vehicles)
        setIsOpen(true)
      } catch (requestError) {
        if (controller.signal.aborted) {
          return
        }

        setOptions([])
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load matching vehicles right now.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }, DEFAULT_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [disabled, isOpen, query, requireActivePermit, selectedLabel])

  const filteredOptions = useMemo(() => {
    if (!resultFilter) {
      return options
    }

    return options.filter(resultFilter)
  }, [options, resultFilter])

  const tooShort = query.trim().length > 0 && query.trim().length < DEFAULT_MIN_QUERY_LENGTH

  const handleSelect = (vehicle: VehicleLookupDto) => {
    onSelect(vehicle)
    setIsOpen(false)
    setOptions([])
    setError(null)
    setHasSearched(false)
    setQuery(vehicle.permitPlateNumber || vehicle.plateNumber)
  }

  const handleClear = () => {
    requestRef.current?.abort()
    setQuery('')
    setOptions([])
    setHasSearched(false)
    setError(null)
    setIsOpen(false)
    onClearSelection?.()
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(event) => {
            const nextValue = event.target.value

            if (selectedLabel && nextValue !== selectedLabel) {
              onClearSelection?.()
            }

            setQuery(nextValue)
            setIsOpen(true)
          }}
          onFocus={() => {
            if (filteredOptions.length > 0 || hasSearched) {
              setIsOpen(true)
            }
          }}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-28 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
        />

        <div className="absolute inset-y-0 right-0 flex items-center gap-2 px-3">
          {isLoading && <span className="text-xs font-medium text-blue-600">Searching...</span>}
          {selectedVehicle && onClearSelection && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {helperText && <p className="text-xs text-gray-500">{helperText}</p>}
      {tooShort && (
        <p className="text-xs text-gray-500">
          Enter at least {DEFAULT_MIN_QUERY_LENGTH} characters to search.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {isOpen && hasSearched && query.trim().length >= DEFAULT_MIN_QUERY_LENGTH && !error && (
        <div className="app-surface-overlay rounded-lg">
          {filteredOptions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">{noResultsText}</div>
          ) : (
            <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
              {filteredOptions.map((vehicle) => (
                <li key={vehicle.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(vehicle)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50/80"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">
                        {vehicle.permitPlateNumber || vehicle.plateNumber}
                      </p>
                      <p className="text-sm text-gray-600">
                        {vehicle.plateNumber}
                        {vehicle.permitPlateNumber ? ` - Permit ${vehicle.permitPlateNumber}` : ''}
                      </p>
                      <p className="text-sm text-gray-500">
                        {vehicle.vehicleType.replace(/_/g, ' ')} - {vehicle.make} {vehicle.model} - {vehicle.color}
                      </p>
                      {(vehicle.ownerName || vehicle.driverName) ? (
                        <p className="text-xs text-gray-500">
                          {vehicle.ownerName ? `Owner: ${vehicle.ownerName}` : 'Vehicle matched'}
                          {vehicle.driverName ? ` - Driver: ${vehicle.driverName}` : ''}
                        </p>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selectedVehicle && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <p className="font-medium text-blue-900">
            Selected vehicle: {selectedVehicle.permitPlateNumber || selectedVehicle.plateNumber}
          </p>
          <p className="mt-1">
            {selectedVehicle.plateNumber} - {selectedVehicle.vehicleType.replace(/_/g, ' ')} -{' '}
            {selectedVehicle.make} {selectedVehicle.model}
          </p>
          {(selectedVehicle.ownerName || selectedVehicle.driverName) ? (
            <p className="mt-1 text-blue-700">
              {selectedVehicle.ownerName ? `Owner: ${selectedVehicle.ownerName}` : 'Vehicle selected'}
              {selectedVehicle.driverName ? ` - Driver: ${selectedVehicle.driverName}` : ''}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
