import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function repoPath(...parts: string[]) {
  return path.join(process.cwd(), ...parts)
}

describe('Phase 7 workflow truthfulness messaging', () => {
  it('keeps incident reporting focused on the on-screen reference number instead of an email promise', () => {
    const incidentReporting = readFileSync(repoPath('src', 'components', 'IncidentReporting.tsx'), 'utf8')

    expect(incidentReporting).toContain('keep the reference number shown after submission')
    expect(incidentReporting.toLowerCase()).not.toContain('email you')
    expect(incidentReporting.toLowerCase()).not.toContain('reference id will be provided via email')
  })

  it('keeps discount application messaging tied to checking the live review status page', () => {
    const discountApplication = readFileSync(repoPath('src', 'components', 'DiscountApplication.tsx'), 'utf8')

    expect(discountApplication).toContain('Check this page again for review status and approval details.')
    expect(discountApplication.toLowerCase()).not.toContain('you will be notified')
  })

  it('keeps enforcer actions labeled with the actual workflow they perform', () => {
    const enforcerIncidentsList = readFileSync(repoPath('src', 'components', 'EnforcerIncidentsList.tsx'), 'utf8')

    expect(enforcerIncidentsList).toContain('Take and Issue Ticket')
    expect(enforcerIncidentsList).toContain('Resolve Only')
  })
})
