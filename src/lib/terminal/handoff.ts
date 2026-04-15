import type { TerminalIncidentHandoffSnapshotDto } from '@/lib/contracts'

export const QR_TERMINAL_HANDOFF_STORAGE_KEY = 'qr-terminal-handoff'
export const QR_TERMINAL_HANDOFF_TTL_MS = 10 * 60 * 1000

interface PersistedQrTerminalHandoffRecord {
  snapshot: TerminalIncidentHandoffSnapshotDto
  storedAt: string
  expiresAt: string
}

function getStorage(kind: 'sessionStorage' | 'localStorage'): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window[kind]
  } catch {
    return null
  }
}

function buildPersistedQrTerminalHandoffRecord(
  snapshot: TerminalIncidentHandoffSnapshotDto,
): PersistedQrTerminalHandoffRecord {
  const storedAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + QR_TERMINAL_HANDOFF_TTL_MS).toISOString()

  return {
    snapshot,
    storedAt,
    expiresAt,
  }
}

function parsePersistedQrTerminalHandoffRecord(
  rawValue: string | null,
): PersistedQrTerminalHandoffRecord | TerminalIncidentHandoffSnapshotDto | null {
  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as PersistedQrTerminalHandoffRecord | TerminalIncidentHandoffSnapshotDto
  } catch {
    return null
  }
}

function isPersistedQrTerminalHandoffRecord(
  value: PersistedQrTerminalHandoffRecord | TerminalIncidentHandoffSnapshotDto,
): value is PersistedQrTerminalHandoffRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'snapshot' in value &&
    'expiresAt' in value &&
    'storedAt' in value
  )
}

function isExpiredPersistedQrTerminalHandoffRecord(record: PersistedQrTerminalHandoffRecord): boolean {
  const expiresAt = Date.parse(record.expiresAt)

  return Number.isNaN(expiresAt) || expiresAt <= Date.now()
}

function persistQrTerminalHandoffRecord(record: PersistedQrTerminalHandoffRecord): void {
  const serializedRecord = JSON.stringify(record)

  getStorage('sessionStorage')?.setItem(QR_TERMINAL_HANDOFF_STORAGE_KEY, serializedRecord)
  getStorage('localStorage')?.setItem(QR_TERMINAL_HANDOFF_STORAGE_KEY, serializedRecord)
}

export function storeQrTerminalHandoff(snapshot: TerminalIncidentHandoffSnapshotDto): void {
  persistQrTerminalHandoffRecord(buildPersistedQrTerminalHandoffRecord(snapshot))
}

export function readQrTerminalHandoff(): TerminalIncidentHandoffSnapshotDto | null {
  const storages = [getStorage('sessionStorage'), getStorage('localStorage')].filter(
    (storage): storage is Storage => storage !== null,
  )

  for (const storage of storages) {
    const parsedRecord = parsePersistedQrTerminalHandoffRecord(
      storage.getItem(QR_TERMINAL_HANDOFF_STORAGE_KEY),
    )

    if (!parsedRecord) {
      continue
    }

    if (isPersistedQrTerminalHandoffRecord(parsedRecord)) {
      if (isExpiredPersistedQrTerminalHandoffRecord(parsedRecord)) {
        clearQrTerminalHandoff()
        return null
      }

      persistQrTerminalHandoffRecord(parsedRecord)
      return parsedRecord.snapshot
    }

    storeQrTerminalHandoff(parsedRecord)
    return parsedRecord
  }

  return null
}

export function clearQrTerminalHandoff(): void {
  getStorage('sessionStorage')?.removeItem(QR_TERMINAL_HANDOFF_STORAGE_KEY)
  getStorage('localStorage')?.removeItem(QR_TERMINAL_HANDOFF_STORAGE_KEY)
}