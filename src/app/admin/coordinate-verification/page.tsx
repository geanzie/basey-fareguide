import type { Metadata } from 'next'

import { CheckCircle2 } from 'lucide-react'
import PageShell from '@/ui/PageShell'

export const metadata: Metadata = {
  title: 'Coordinate System - Admin Dashboard',
  description: 'Information about the coordinate system used in Basey Municipality fare calculation system.',
}

export default function CoordinateSystemPage() {
  return (
    <PageShell
      title="Coordinate System"
      subtitle="Authoritative GeoJSON data for all coordinates"
      backHref="/admin"
      width="narrow"
    >
      <div className="space-y-4">
        <div className="rounded-card border border-surface-border bg-surface p-6 shadow-card">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="text-sm font-bold text-primary-dark">Coordinate Verification Discontinued</h3>
              <div className="mt-2 space-y-2 text-sm text-ink-body">
                <p>
                  <strong>Rule:</strong> &quot;Follow whatever the .geojson file has because this is the most
                  realistic coordinates data&quot;
                </p>
                <p>
                  The coordinate verification tool has been removed. All coordinates now follow the
                  accurate GeoJSON data from <code>Barangay.shp.json</code>, which contains official
                  polygon boundaries for all 51+ barangays.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-card border border-surface-border bg-surface p-6 shadow-card">
          <h3 className="mb-4 text-lg font-bold text-ink-strong">Current Coordinate System</h3>
          <div className="space-y-3 text-sm text-ink-body">
            <div>
              <strong>Data Source:</strong> <code>src/data/Barangay.shp.json</code>
            </div>
            <div>
              <strong>Format:</strong> GeoJSON with polygon boundaries
            </div>
            <div>
              <strong>Coverage:</strong> 51+ barangays with precise boundaries
            </div>
            <div>
              <strong>Coordinate System:</strong> WGS84 (EPSG:4326)
            </div>
            <div>
              <strong>Basey Center:</strong> [11.282621, 125.068848] (calculated from poblacion barangays)
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
