import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function repoPath(...parts: string[]) {
  return path.join(process.cwd(), ...parts)
}

describe('Phase 8 UX simplification', () => {
  it('keeps the public dashboard focused on one action grid and two recent-activity sections', () => {
    const dashboard = readFileSync(repoPath('src', 'components', 'PublicUserDashboard.tsx'), 'utf8')

    expect(dashboard).not.toContain('Quick Actions')
    expect(dashboard).toContain('Recent Fare Calculations')
    expect(dashboard).toContain('Recent Incident Reports')
  })

  it('keeps the history page focused on one timeline view', () => {
    const history = readFileSync(repoPath('src', 'components', 'UserHistory.tsx'), 'utf8')

    expect(history).toContain('Activity timeline')
    expect(history).toContain('Fare calculation')
    expect(history).toContain('Incident report')
    expect(history).not.toContain('getItemIcon')
  })

  it('keeps calculator, incident reporting, and admin reports copy aligned with the simplified flow', () => {
    const calculatorPage = readFileSync(repoPath('src', 'app', 'dashboard', 'calculator', 'page.tsx'), 'utf8')
    const incidentReporting = readFileSync(repoPath('src', 'components', 'IncidentReporting.tsx'), 'utf8')
    const adminReports = readFileSync(repoPath('src', 'app', 'admin', 'reports', 'page.tsx'), 'utf8')

    expect(calculatorPage).toContain('OpenRouteService first, GPS fallback only')
    expect(incidentReporting).toContain('Before you submit')
    expect(incidentReporting).toContain('Evidence (Optional)')
    expect(adminReports).not.toContain('SummaryCard')
    expect(adminReports).toContain('Incident Analytics')
    expect(adminReports).toContain('Storage Analytics')
  })
})
