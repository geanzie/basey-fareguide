import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function repoPath(...parts: string[]) {
  return path.join(process.cwd(), ...parts)
}

describe('Planner-only calculator entrypoints', () => {
  it('renders the public calculator through a lazy wrapper and route loading skeleton', () => {
    const calculatorPage = readFileSync(repoPath('src', 'app', 'calculator', 'page.tsx'), 'utf8')
    const calculatorLoading = readFileSync(repoPath('src', 'app', 'calculator', 'loading.tsx'), 'utf8')

    expect(calculatorPage).toContain('LazyRoutePlannerCalculator')
    expect(calculatorLoading).toContain('CalculatorPageSkeleton')
    expect(calculatorPage).not.toContain('TripTrackerCalculator')
    expect(calculatorPage).not.toContain('Choose the right calculator for your needs')
    expect(calculatorPage).not.toContain('Start Tracking')
    expect(calculatorPage).not.toContain('Back to Calculator Selection')
  })

  it('renders the public report route through a lazy wrapper and route loading skeleton', () => {
    const reportPage = readFileSync(repoPath('src', 'app', 'report', 'page.tsx'), 'utf8')
    const reportLoading = readFileSync(repoPath('src', 'app', 'report', 'loading.tsx'), 'utf8')

    expect(reportPage).toContain('LazyIncidentReporting')
    expect(reportLoading).toContain('ReportPageSkeleton')
  })

  it('keeps the dashboard calculator aligned with the planner-only copy', () => {
    const dashboardCalculator = readFileSync(repoPath('src', 'app', 'dashboard', 'calculator', 'page.tsx'), 'utf8')

    expect(dashboardCalculator).toContain('RoutePlannerCalculator')
    expect(dashboardCalculator).not.toContain('Choose a quick estimate or an exact routed trip')
    expect(dashboardCalculator).not.toContain('Set A and B on one map')
  })
})
