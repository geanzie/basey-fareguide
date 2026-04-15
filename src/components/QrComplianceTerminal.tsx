'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { useAuth } from '@/components/AuthProvider'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
} from '@/components/dashboardIcons'
import EnforcerIncidentsList from '@/components/EnforcerIncidentsList'
import QrTokenScannerPanel from '@/components/QrTokenScannerPanel'
import type {
  TerminalIncidentHandoffSnapshotDto,
  TerminalLookupResultDto,
  TerminalScanHistoryItemDto,
  TerminalScanHistoryResponseDto,
  TerminalScanSource,
  TerminalUnlockResponseDto,
} from '@/lib/contracts'
import { storeQrTerminalHandoff } from '@/lib/terminal/handoff'

type TerminalView = 'locked' | 'unlocking' | 'camera-ready' | 'manual-entry' | 'result' | 'incident-queue' | 'error'

type TerminalApiErrorResponse = {
  message?: string
}

type ScannerHandle = {
  isScanning?: boolean
  stop: () => Promise<unknown>
  clear: () => void | Promise<void>
}

function formatIncidentDate(value: string): string {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown date'
  }

  return parsed.toLocaleDateString()
}

function getResultHeadline(result: TerminalLookupResultDto): string {
  if (result.scanDisposition === 'FLAGGED') {
    return 'Review required.'
  }

  return result.message
}

export default function QrComplianceTerminal() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, status } = useAuth()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<TerminalView>('locked')
  const [password, setPassword] = useState('')
  const [manualToken, setManualToken] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [cameraMessage, setCameraMessage] = useState('')
  const [unlockState, setUnlockState] = useState<TerminalUnlockResponseDto | null>(null)
  const [result, setResult] = useState<TerminalLookupResultDto | null>(null)
  const [scanHistory, setScanHistory] = useState<TerminalScanHistoryItemDto[]>([])
  const [historyError, setHistoryError] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [isSubmittingLookup, setIsSubmittingLookup] = useState(false)
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)

  const isAuthenticated = status === 'authenticated' && !!user
  const isEnforcer = user?.userType === 'ENFORCER'
  const canRenderLauncher = pathname === '/' || isAuthenticated
  const shouldRenderHistoryPanel = showHistoryPanel && view !== 'result'
  const isCameraVisible = view === 'camera-ready' && !shouldRenderHistoryPanel
  const shouldMaximizeTerminal = shouldRenderHistoryPanel || view === 'incident-queue'
  const incidentHandoffVehicle = result?.incidentHandoff?.vehicle ?? null
  const incidentActionDisabledReason = result && !incidentHandoffVehicle
    ? 'Incident reporting stays in the enforcer queue and requires a matched vehicle from the scan.'
    : null

  useEffect(() => {
    if (!open) {
      setPassword('')
      setManualToken('')
      setErrorMessage('')
      setCameraMessage('')
      if (!unlockState) {
        setView('locked')
      }
    }
  }, [open, unlockState])

  useEffect(() => {
    if (!canRenderLauncher) {
      setOpen(false)
    }
  }, [canRenderLauncher])

  const unlockSummary = useMemo(() => {
    if (!unlockState?.expiresAt) {
      return null
    }

    return new Date(unlockState.expiresAt).toLocaleTimeString()
  }, [unlockState])

  if (!canRenderLauncher || status === 'logging_out') {
    return null
  }

  const resetToScanner = () => {
    setResult(null)
    setErrorMessage('')
    setCameraMessage('')
    setManualToken('')
    setView('camera-ready')
  }

  const syncUnlockExpiry = (nextExpiry: string | null) => {
    if (!nextExpiry) {
      return
    }

    setUnlockState((current) => current ? {
      ...current,
      expiresAt: nextExpiry,
      lastActivityAt: new Date().toISOString(),
    } : current)
  }

  const clearUnlockedTerminalState = (nextView: TerminalView = 'locked') => {
    setUnlockState(null)
    setResult(null)
    setScanHistory([])
    setHistoryError('')
    setCameraMessage('')
    setShowHistoryPanel(false)
    setView(nextView)
  }

  const isScanHistoryResponse = (
    payload: TerminalScanHistoryResponseDto | TerminalApiErrorResponse,
  ): payload is TerminalScanHistoryResponseDto => 'items' in payload

  const loadScanHistory = async () => {
    if (!open || !unlockState?.unlocked || !isEnforcer) {
      return
    }

    setHistoryLoading(true)
    setHistoryError('')

    try {
      const response = await fetch('/api/terminal/history?limit=8')
      const payload = await response.json() as TerminalScanHistoryResponseDto | TerminalApiErrorResponse

      if (!response.ok) {
        if (response.status === 403) {
          clearUnlockedTerminalState()
        }

        const historyErrorMessage = 'message' in payload ? payload.message : undefined
        setHistoryError(historyErrorMessage || 'Unable to load recent scan history.')
        return
      }

      setScanHistory(isScanHistoryResponse(payload) ? payload.items : [])
      syncUnlockExpiry(response.headers.get('X-Terminal-Unlock-Expires-At'))
    } catch {
      setHistoryError('Unable to load recent scan history.')
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (!open || !unlockState?.unlocked || !isEnforcer) {
      return
    }

    void loadScanHistory()
  }, [open, unlockState?.unlocked, isEnforcer])

  const handleLookup = async (token: string, scanSource: TerminalScanSource) => {
    const normalizedToken = token.trim()

    if (!normalizedToken) {
      setErrorMessage('Enter a QR token before scanning.')
      setView('error')
      return
    }

    setIsSubmittingLookup(true)
    setErrorMessage('')

    try {
      const response = await fetch('/api/terminal/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: normalizedToken, scanSource }),
      })
      const payload = await response.json()

      if (!response.ok) {
        if (response.status === 403) {
          clearUnlockedTerminalState()
          setErrorMessage(payload.message || 'The terminal unlock expired. Re-enter your password to continue.')
          return
        }

        setErrorMessage(payload.message || 'Unable to complete the QR lookup right now.')
        setView('error')
        return
      }

      setResult(payload as TerminalLookupResultDto)
      setView('result')
      setCameraMessage('')
      void loadScanHistory()
      syncUnlockExpiry(response.headers.get('X-Terminal-Unlock-Expires-At'))
    } catch {
      setErrorMessage('Unable to reach the QR lookup service. Please try again.')
      setView('error')
    } finally {
      setIsSubmittingLookup(false)
    }
  }

  const handleUnlock = async () => {
    if (!password.trim()) {
      setErrorMessage('Enter your password to unlock the terminal.')
      return
    }

    setView('unlocking')
    setErrorMessage('')

    try {
      const response = await fetch('/api/terminal/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const payload = await response.json()

      if (!response.ok) {
        setErrorMessage(payload.message || 'Unable to unlock the terminal.')
        setView('locked')
        return
      }

      setUnlockState(payload as TerminalUnlockResponseDto)
      setPassword('')
      setView('camera-ready')
    } catch {
      setErrorMessage('Unable to unlock the terminal right now.')
      setView('locked')
    }
  }

  const handleLock = async () => {
    try {
      await fetch('/api/terminal/unlock', { method: 'DELETE' })
    } catch {}

    setPassword('')
    setManualToken('')
    setErrorMessage('')
    clearUnlockedTerminalState()
  }

  const handleCameraNotice = (message: string, fallbackView: TerminalView = 'error') => {
    setCameraMessage(message)
    setView(fallbackView)
  }

  const handleIncidentHandoff = (snapshot: TerminalIncidentHandoffSnapshotDto | null) => {
    if (!snapshot) {
      return
    }

    storeQrTerminalHandoff(snapshot)
    setShowHistoryPanel(false)
    setView('incident-queue')
  }

  const handleReturnToResult = () => {
    setView('result')
  }

  const handleEmbeddedWorkflowComplete = () => {
    setResult(null)
    setErrorMessage('')
    setCameraMessage('')
    setManualToken('')
    setShowHistoryPanel(false)
    setView('camera-ready')
    void loadScanHistory()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] right-4 z-[45] inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl transition hover:bg-emerald-700 lg:bottom-6 lg:right-6"
        aria-label="Open QR compliance terminal"
      >
        <DashboardIconSlot icon={DASHBOARD_ICONS.camera} size={22} className="text-white" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] bg-slate-950/50 backdrop-blur-sm">
          <div className="flex min-h-full items-end justify-center p-4 sm:items-center">
            <div className={`app-surface-overlay flex w-full max-w-5xl flex-col rounded-[1.5rem] p-4 shadow-2xl sm:rounded-3xl sm:p-5 ${shouldMaximizeTerminal ? 'h-[calc(100dvh-1rem)] overflow-hidden sm:h-[min(92dvh,860px)]' : 'max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-h-[min(92dvh,860px)]'}`}>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={getDashboardIconChipClasses('emerald')}>
                    <DashboardIconSlot icon={DASHBOARD_ICONS.camera} size={DASHBOARD_ICON_POLICY.sizes.section} className="text-emerald-700" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">QR Compliance Terminal</h2>
                    <p className="text-sm text-slate-600">
                      Scan a permit QR or enter the token manually to validate permit and compliance status.
                    </p>
                    {unlockSummary ? (
                      <p className="mt-1 text-xs text-emerald-700">Unlocked until {unlockSummary}</p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-white/80 hover:text-slate-700"
                  aria-label="Close QR compliance terminal"
                >
                  <DashboardIconSlot icon={DASHBOARD_ICONS.close} size={DASHBOARD_ICON_POLICY.sizes.button} />
                </button>
              </div>

              <div className={shouldMaximizeTerminal ? 'min-h-0 flex-1 overflow-hidden' : ''}>
                {errorMessage ? (
                  <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {errorMessage}
                  </div>
                ) : null}

                {!isAuthenticated ? (
                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-sm text-slate-700">
                      The QR terminal is visible here, but only logged-in enforcers can unlock and scan permits.
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push('/auth')}
                      className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 sm:w-auto"
                    >
                      Login as Enforcer
                    </button>
                  </div>
                ) : !isEnforcer ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Your account can view the launcher, but only ENFORCER users can unlock the QR terminal.
                  </div>
                ) : null}

                {isAuthenticated && isEnforcer && !unlockState?.unlocked ? (
                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div>
                      <label htmlFor="terminal-password" className="mb-2 block text-sm font-medium text-slate-700">
                        Re-enter your password to unlock the terminal
                      </label>
                      <input
                        id="terminal-password"
                        name="terminalPassword"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleUnlock()}
                      disabled={view === 'unlocking'}
                      className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                    >
                      {view === 'unlocking' ? 'Unlocking...' : 'Unlock Terminal'}
                    </button>
                  </div>
                ) : null}

                {isAuthenticated && isEnforcer && unlockState?.unlocked ? (
                  <div className={shouldMaximizeTerminal ? 'flex h-full min-h-0 flex-col gap-4' : 'flex flex-col gap-4'}>
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => setView('camera-ready')}
                      aria-label="Camera Scan"
                      title="Camera Scan"
                      className={`min-w-0 rounded-lg px-2 py-2 text-xs font-medium sm:px-3 sm:text-sm ${view === 'camera-ready' ? 'bg-emerald-600 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        <DashboardIconSlot icon={DASHBOARD_ICONS.camera} size={14} className={view === 'camera-ready' ? 'text-white' : 'text-slate-500'} />
                        <span className="sr-only sm:not-sr-only sm:inline truncate">Camera Scan</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setView('manual-entry')}
                      aria-label="Manual Entry"
                      title="Manual Entry"
                      className={`min-w-0 rounded-lg px-2 py-2 text-xs font-medium sm:px-3 sm:text-sm ${view === 'manual-entry' ? 'bg-emerald-600 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        <DashboardIconSlot icon={DASHBOARD_ICONS.fileText} size={14} className={view === 'manual-entry' ? 'text-white' : 'text-slate-500'} />
                        <span className="sr-only sm:not-sr-only sm:inline truncate">Manual Entry</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleLock()}
                      aria-label="Lock Terminal"
                      title="Lock Terminal"
                      className="min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:px-3 sm:text-sm"
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        <DashboardIconSlot icon={DASHBOARD_ICONS.safe} size={14} className="text-slate-500" />
                        <span className="sr-only sm:not-sr-only sm:inline truncate">Lock Terminal</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowHistoryPanel((current) => !current)}
                      aria-label={shouldRenderHistoryPanel ? 'Hide History' : 'Show History'}
                      title={shouldRenderHistoryPanel ? 'Hide History' : 'Show History'}
                      className={`min-w-0 rounded-lg px-2 py-2 text-xs font-medium sm:px-3 sm:text-sm ${shouldRenderHistoryPanel ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        <DashboardIconSlot icon={DASHBOARD_ICONS.history} size={14} className={shouldRenderHistoryPanel ? 'text-white' : 'text-slate-500'} />
                        <span className="sr-only sm:not-sr-only sm:inline truncate">{shouldRenderHistoryPanel ? 'Hide History' : 'Show History'}</span>
                      </span>
                    </button>
                    </div>

                    {shouldRenderHistoryPanel ? (
                      <div className="min-h-0 flex flex-1 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={getDashboardIconChipClasses('blue')}>
                              <DashboardIconSlot icon={DASHBOARD_ICONS.history} size={DASHBOARD_ICON_POLICY.sizes.section} className="text-blue-700" />
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-slate-900">Recent Scan History</h3>
                              <p className="text-xs text-slate-600">Latest validation attempts for this terminal session.</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void loadScanHistory()}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                          >
                            Refresh
                          </button>
                        </div>

                        {historyError ? (
                          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            {historyError}
                          </div>
                        ) : null}

                        {historyLoading ? (
                          <div className="flex-1 text-sm text-slate-500">Loading recent scans...</div>
                        ) : scanHistory.length > 0 ? (
                          <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
                            <div className="space-y-2">
                            {scanHistory.map((item) => (
                              <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                  <div className="min-w-0">
                                    <div className="font-medium text-slate-900">
                                      {item.vehiclePlateNumber || item.permitPlateNumber || 'Unmatched token'}
                                    </div>
                                    <div className="mt-1 break-all font-mono text-xs text-slate-500">{item.submittedToken}</div>
                                  </div>
                                  <div className="text-left text-xs text-slate-500 sm:text-right">
                                    <div>{new Date(item.scannedAt).toLocaleString()}</div>
                                    <div>{item.scanSource} scan</div>
                                  </div>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.disposition === 'CLEAR' ? 'bg-emerald-100 text-emerald-800' : item.disposition === 'BLOCKED' ? 'bg-red-100 text-red-800' : item.disposition === 'FLAGGED' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>
                                    {item.disposition || item.resultType}
                                  </span>
                                  <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                    {item.resultType}
                                  </span>
                                  {item.permitPlateNumber ? (
                                    <span className="text-xs text-slate-500">Permit {item.permitPlateNumber}</span>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                            No scans recorded yet for this enforcer.
                          </div>
                        )}
                      </div>
                    ) : (
                    <div className={shouldMaximizeTerminal ? 'min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 pb-2' : 'space-y-4'}>
                      {cameraMessage ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          {cameraMessage}
                        </div>
                      ) : null}

                      {isCameraVisible ? (
                        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <QrTokenScannerPanel
                            active={!isSubmittingLookup && !shouldRenderHistoryPanel}
                            onDetected={(token) => void handleLookup(token, 'CAMERA')}
                            onCameraNotice={(message) => handleCameraNotice(message, 'manual-entry')}
                          />
                          <p className="text-sm text-slate-600">
                            Point the camera at a permit QR. If camera access is denied or unavailable, switch to manual entry.
                          </p>
                        </div>
                      ) : null}

                      {view === 'camera-ready' && shouldRenderHistoryPanel ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                          History is open. Close history to resume the live camera scanner.
                        </div>
                      ) : null}

                      {view === 'manual-entry' ? (
                        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div>
                          <label htmlFor="manual-qr-token" className="mb-2 block text-sm font-medium text-slate-700">
                            Enter the permit QR token
                          </label>
                          <input
                            id="manual-qr-token"
                            name="manualQrToken"
                            type="text"
                            autoComplete="off"
                            value={manualToken}
                            onChange={(event) => setManualToken(event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                            placeholder="Paste or type the stored QR token"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleLookup(manualToken, 'MANUAL')}
                          disabled={isSubmittingLookup}
                          className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isSubmittingLookup ? 'Checking...' : 'Check Permit'}
                        </button>
                        </div>
                      ) : null}

                      {view === 'incident-queue' && result?.incidentHandoff ? (
                        <div className="flex min-h-0 flex-1 flex-col gap-4">
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Enforcement workflow</div>
                                <h3 className="mt-2 text-lg font-semibold text-emerald-950">
                                  {result.incidentHandoff.vehicle?.plateNumber || 'Scanned vehicle'} incident review
                                </h3>
                                <p className="mt-1 text-sm text-emerald-900">
                                  {result.violationSummary?.openIncidents ?? 0} matched incident{(result.violationSummary?.openIncidents ?? 0) === 1 ? '' : 's'} ready for action.
                                </p>
                              </div>
                              <div className="flex flex-col gap-2 sm:flex-row">
                                <button
                                  type="button"
                                  onClick={handleReturnToResult}
                                  className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-900 transition-colors hover:bg-white/70"
                                >
                                  Back to Result
                                </button>
                                <button
                                  type="button"
                                  onClick={handleEmbeddedWorkflowComplete}
                                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                                >
                                  Finish and Scan Again
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
                            <EnforcerIncidentsList
                              mode="queue"
                              embeddedQrHandoffSnapshot={result.incidentHandoff}
                              onWorkflowComplete={handleEmbeddedWorkflowComplete}
                            />
                          </div>
                        </div>
                      ) : null}

                      {view === 'result' && result ? (
                        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${result.scanDisposition === 'CLEAR' ? 'bg-emerald-100 text-emerald-800' : result.scanDisposition === 'BLOCKED' ? 'bg-red-100 text-red-800' : result.scanDisposition === 'NOT_FOUND' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'}`}>
                          {result.scanDisposition}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{getResultHeadline(result)}</h3>
                        <p className="text-sm text-slate-600">Scanned token: <span className="font-mono">{result.scannedToken}</span></p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compliance summary</div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Permit validity</div>
                            <div className="mt-1 font-semibold text-slate-900">
                              {result.permitStatus === 'ACTIVE'
                                ? 'Valid'
                                : result.permitStatus
                                  ? result.permitStatus.replace(/_/g, ' ')
                                  : 'Unavailable'}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reported incidents</div>
                            <div className="mt-1 font-semibold text-slate-900">{result.violationSummary?.openIncidents ?? 0}</div>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Outstanding penalties</div>
                            <div className="mt-1 font-semibold text-slate-900">PHP {(result.violationSummary?.outstandingPenalties ?? 0).toLocaleString()}</div>
                          </div>
                        </div>
                        {result.violationSummary && result.violationSummary.openIncidents > 0 ? (
                          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Matched reports</div>
                            {result.violationSummary.recentViolations.length > 0 ? (
                              <div className="mt-2 space-y-2">
                                {result.violationSummary.recentViolations.slice(0, 3).map((incident) => (
                                  <div key={incident.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <span className="font-medium text-slate-900">{incident.incidentTypeLabel}</span>
                                      <span className="text-slate-600">{' '}• {incident.status.replace(/_/g, ' ')}</span>
                                    </div>
                                    <span className="text-xs text-slate-600">{formatIncidentDate(incident.incidentDate)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-2 text-slate-700">Unresolved matched incident reports are included in the count above.</p>
                            )}
                          </div>
                        ) : null}
                      </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                          <button
                            type="button"
                            onClick={resetToScanner}
                            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 sm:w-auto"
                          >
                            Scan Another
                          </button>
                          <button
                            type="button"
                            onClick={() => handleIncidentHandoff(result.incidentHandoff)}
                            disabled={!incidentHandoffVehicle}
                            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                          >
                            Review Incident Queue
                          </button>
                        </div>
                        {incidentActionDisabledReason ? (
                          <p className="text-sm text-amber-700">{incidentActionDisabledReason}</p>
                        ) : null}
                      </div>
                      ) : null}

                      {view === 'error' ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                          Recover by switching to manual entry, rescanning, or unlocking the terminal again if the session expired.
                        </div>
                      ) : null}
                    </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}