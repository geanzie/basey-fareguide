import type { TerminalIncidentHandoffSnapshotDto } from '@/lib/contracts'

export const QR_TERMINAL_HANDOFF_STORAGE_KEY = 'qr-terminal-handoff'

export function storeQrTerminalHandoff(snapshot: TerminalIncidentHandoffSnapshotDto): void {
  sessionStorage.setItem(QR_TERMINAL_HANDOFF_STORAGE_KEY, JSON.stringify(snapshot))
}

export function readQrTerminalHandoff(): TerminalIncidentHandoffSnapshotDto | null {
  const rawValue = sessionStorage.getItem(QR_TERMINAL_HANDOFF_STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as TerminalIncidentHandoffSnapshotDto
  } catch {
    return null
  }
}

export function clearQrTerminalHandoff(): void {
  sessionStorage.removeItem(QR_TERMINAL_HANDOFF_STORAGE_KEY)
}