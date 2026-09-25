'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type { EnforcerOperationsPointDto, ViolationGroup } from '@/lib/contracts'
import { addBaseTileLayer } from '@/lib/map/baseTileLayer'
import { VIOLATION_GROUP_LABELS } from '@/lib/incidents/dashboardGroups'
import { formatIncidentStatusLabel } from '@/lib/serializers/incidents'
import { GROUP_HEX } from './palette'

export type MapMode = 'hotspots' | 'pins'

export interface IncidentHotspotMapHandle {
  /** Pan to an incident and open its popup. Returns false when it has no point. */
  focusIncident: (id: string) => boolean
}

interface Props {
  points: EnforcerOperationsPointDto[]
  mode: MapMode
  className?: string
}

/** Basey poblacion — used until the first points arrive. */
const BASEY_CENTER: [number, number] = [11.2817, 125.068]
/** ~250 m cells at Basey's latitude. */
const CELL_LAT = 0.00225
const CELL_LNG = 0.0023

// Popup content is built as HTML, and location / plate are free text from
// reporters, so everything user-supplied goes through this.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const dateFormat = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function pointPopup(point: EnforcerOperationsPointDto): string {
  const precision =
    point.precision === 'GPS'
      ? 'Reporter GPS'
      : 'Approximate: placed at the named barangay or landmark'
  return `
    <div style="min-width:180px;font:13px/1.4 var(--font-inter),system-ui,sans-serif;color:#0f172a">
      <div style="font-weight:700">${escapeHtml(point.typeLabel)}</div>
      <div style="color:#374151">${escapeHtml(point.location || 'No location given')}</div>
      ${point.plateNumber ? `<div style="color:#374151">Plate ${escapeHtml(point.plateNumber)}</div>` : ''}
      <div style="color:#64748b;margin-top:4px">${escapeHtml(formatIncidentStatusLabel(point.status))} · ${dateFormat.format(new Date(point.incidentDate))}</div>
      <div style="color:#64748b;font-size:12px;margin-top:2px">${precision}</div>
    </div>`
}

interface Cell {
  lat: number
  lng: number
  count: number
  approx: number
  groups: Map<ViolationGroup, number>
  places: Map<string, number>
}

function binPoints(points: EnforcerOperationsPointDto[]): Cell[] {
  const cells = new Map<string, Cell & { sumLat: number; sumLng: number }>()
  for (const point of points) {
    const key = `${Math.floor(point.lat / CELL_LAT)}:${Math.floor(point.lng / CELL_LNG)}`
    const cell =
      cells.get(key) ??
      { lat: 0, lng: 0, sumLat: 0, sumLng: 0, count: 0, approx: 0, groups: new Map(), places: new Map() }
    cell.sumLat += point.lat
    cell.sumLng += point.lng
    cell.count += 1
    if (point.precision === 'PLACE') cell.approx += 1
    cell.groups.set(point.group, (cell.groups.get(point.group) ?? 0) + 1)
    if (point.location) cell.places.set(point.location, (cell.places.get(point.location) ?? 0) + 1)
    cells.set(key, cell)
  }
  return [...cells.values()].map((cell) => ({
    ...cell,
    lat: cell.sumLat / cell.count,
    lng: cell.sumLng / cell.count,
  }))
}

function dominant<K>(counts: Map<K, number>): K | undefined {
  let best: K | undefined
  let bestCount = -1
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key
      bestCount = count
    }
  }
  return best
}

function cellPopup(cell: Cell): string {
  const rows = [...cell.groups.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(
      ([group, count]) =>
        `<div style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:3px;background:${GROUP_HEX[group]}"></span><span style="flex:1">${VIOLATION_GROUP_LABELS[group]}</span><b>${count}</b></div>`,
    )
    .join('')
  const place = dominant(cell.places)
  return `
    <div style="min-width:190px;font:13px/1.5 var(--font-inter),system-ui,sans-serif;color:#0f172a">
      <div style="font-weight:700;font-size:15px">${cell.count} ${cell.count === 1 ? 'report' : 'reports'}</div>
      ${place ? `<div style="color:#374151;margin-bottom:4px">Mostly around ${escapeHtml(place)}</div>` : ''}
      ${rows}
      ${cell.approx ? `<div style="color:#64748b;font-size:12px;margin-top:4px">${cell.approx} placed by barangay or landmark, not exact GPS</div>` : ''}
    </div>`
}

const IncidentHotspotMap = forwardRef<IncidentHotspotMapHandle, Props>(function IncidentHotspotMap(
  { points, mode, className = 'h-[55vh] w-full lg:h-[520px]' },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const leafletRef = useRef<typeof import('leaflet') | null>(null)
  const layerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const markersRef = useRef(new Map<string, import('leaflet').CircleMarker>())
  const hasFittedRef = useRef(false)
  const latestRef = useRef({ points, mode })
  latestRef.current = { points, mode }

  const drawRef = useRef<() => void>(() => {})
  drawRef.current = () => {
    const L = leafletRef.current
    const map = mapRef.current
    const layer = layerRef.current
    if (!L || !map || !layer) return

    const { points: currentPoints, mode: currentMode } = latestRef.current
    layer.clearLayers()
    markersRef.current.clear()

    if (currentMode === 'hotspots') {
      const cells = binPoints(currentPoints).sort((a, b) => b.count - a.count)
      // Largest first so small cells stay clickable on top.
      for (const cell of cells) {
        const group = dominant(cell.groups) ?? 'OTHER'
        const allApprox = cell.approx === cell.count
        L.circleMarker([cell.lat, cell.lng], {
          radius: 8 + 6 * Math.sqrt(cell.count),
          color: '#ffffff',
          weight: 2,
          fillColor: GROUP_HEX[group],
          fillOpacity: allApprox ? 0.35 : 0.7,
          dashArray: allApprox ? '4 4' : undefined,
        })
          .bindTooltip(`${cell.count}`, {
            permanent: cell.count > 1,
            direction: 'center',
            className: 'enforcer-map-count',
          })
          .bindPopup(cellPopup(cell))
          .addTo(layer)
      }
    } else {
      for (const point of currentPoints) {
        const exact = point.precision === 'GPS'
        const marker = L.circleMarker([point.lat, point.lng], {
          radius: 7,
          color: exact ? '#ffffff' : GROUP_HEX[point.group],
          weight: 2,
          fillColor: GROUP_HEX[point.group],
          fillOpacity: exact ? 0.9 : 0.15,
          dashArray: exact ? undefined : '3 3',
        })
          .bindPopup(pointPopup(point))
          .addTo(layer)
        markersRef.current.set(point.id, marker)
      }
    }

    if (!hasFittedRef.current && currentPoints.length > 0) {
      hasFittedRef.current = true
      map.fitBounds(
        currentPoints.map((p) => [p.lat, p.lng] as [number, number]),
        { padding: [32, 32], maxZoom: 15 },
      )
    }
  }

  useImperativeHandle(ref, () => ({
    focusIncident(id) {
      const map = mapRef.current
      const L = leafletRef.current
      const point = latestRef.current.points.find((p) => p.id === id)
      if (!map || !L || !point) return false

      const marker = markersRef.current.get(id)
      map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 16), { duration: 0.6 })
      if (marker) {
        marker.openPopup()
      } else {
        L.popup().setLatLng([point.lat, point.lng]).setContent(pointPopup(point)).openOn(map)
      }
      return true
    },
  }))

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    const init = async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current) return

      // No wheel zoom: the map sits mid-page and would swallow page scrolling.
      const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false }).setView(
        BASEY_CENTER,
        13,
      )
      mapRef.current = map
      leafletRef.current = L
      layerRef.current = L.layerGroup().addTo(map)

      void addBaseTileLayer(map)
        .then((layer) => {
          if (cancelled) map.removeLayer(layer)
        })
        .catch((error) => console.error('Failed to load basemap:', error))

      drawRef.current()
    }

    void init()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      layerRef.current = null
      hasFittedRef.current = false
    }
  }, [])

  // Redraw in place on every refresh or filter change. The map itself is
  // never re-created, so the enforcer's pan and zoom survive the 15 s poll.
  useEffect(() => {
    drawRef.current()
  }, [points, mode])

  return (
    <div
      ref={containerRef}
      className={`${className} z-0`}
      role="region"
      aria-label="Map of incident reports. The top hotspots list on the Analytics tab has the same information as text."
    />
  )
})

export default IncidentHotspotMap
