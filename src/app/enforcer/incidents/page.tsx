'use client'

import { useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import EnforcerIncidentsList from '@/components/EnforcerIncidentsList'
import type { EnforcerIncidentsViewMode } from '@/lib/contracts'
import PageShell from '@/ui/PageShell'

const VIEWS: Array<{ mode: EnforcerIncidentsViewMode; label: string }> = [
  { mode: 'queue', label: 'Open' },
  { mode: 'history', label: 'Closed' },
]

export default function EnforcerIncidentsPage() {
  const [mode, setMode] = useState<EnforcerIncidentsViewMode>('queue')

  return (
    <RoleGuard allowedRoles={['ENFORCER']}>
      <PageShell
        title="Incident Queue"
        subtitle={
          mode === 'queue'
            ? 'Work unresolved incidents in priority order using the shared incident workflow'
            : 'Look up resolved, dismissed and referred incidents'
        }
        band={
          <div role="tablist" aria-label="Incident view" className="mt-3 inline-flex rounded-full bg-white/15 p-1">
            {VIEWS.map((view) => (
              <button
                key={view.mode}
                type="button"
                role="tab"
                aria-selected={mode === view.mode}
                onClick={() => setMode(view.mode)}
                className={`rounded-full px-4 py-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  mode === view.mode ? 'bg-white text-primary-dark' : 'text-white/85 hover:text-white'
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
        }
      >
        {/* Keyed so switching views starts from a clean filter, search and page. */}
        <EnforcerIncidentsList key={mode} mode={mode} />
      </PageShell>
    </RoleGuard>
  )
}
