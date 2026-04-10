import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500

    return new Response(JSON.stringify({ error: message }), { status })
  }),
}))

const prismaMock = vi.hoisted(() => ({
  incident: {
    groupBy: vi.fn(),
    count: vi.fn(),
  },
}))

const evidenceCleanupMock = vi.hoisted(() => ({
  getEvidenceStorageStats: vi.fn(),
  previewOldEvidenceCleanup: vi.fn(),
  cleanupOldEvidenceFiles: vi.fn(),
  clampEvidenceCleanupBatchSize: vi.fn((value: unknown) => {
    const parsedValue = Number.parseInt(String(value ?? ''), 10)
    if (!Number.isFinite(parsedValue) || parsedValue < 1) {
      return 100
    }

    return Math.min(parsedValue, 500)
  }),
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_ONLY: ['ADMIN'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/evidenceCleanup', () => ({
  getEvidenceStorageStats: evidenceCleanupMock.getEvidenceStorageStats,
  previewOldEvidenceCleanup: evidenceCleanupMock.previewOldEvidenceCleanup,
  cleanupOldEvidenceFiles: evidenceCleanupMock.cleanupOldEvidenceFiles,
  clampEvidenceCleanupBatchSize: evidenceCleanupMock.clampEvidenceCleanupBatchSize,
}))

import { GET, POST } from '@/app/api/admin/storage/route'

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestRole.mockResolvedValue({ id: 'admin-1', username: 'root', userType: 'ADMIN' })
  evidenceCleanupMock.getEvidenceStorageStats.mockResolvedValue({
    byType: [],
    total: { files: 2, sizeBytes: 4096, sizeMB: 0 },
  })
  prismaMock.incident.groupBy.mockResolvedValue([])
  prismaMock.incident.count.mockResolvedValue(3)
  evidenceCleanupMock.previewOldEvidenceCleanup.mockResolvedValue({
    cutoffDate: new Date('2026-03-11T00:00:00.000Z'),
    totalIncidents: 8,
    previewedIncidents: 5,
    totalFiles: 12,
    totalSizeBytes: 1024,
    totalSizeMB: 0,
    batchSize: 5,
    hasMore: true,
    incidentDetails: [
      {
        id: 'incident-1',
        status: 'RESOLVED',
        resolvedAt: new Date('2026-03-01T00:00:00.000Z'),
        evidenceCount: 2,
      },
    ],
  })
  evidenceCleanupMock.cleanupOldEvidenceFiles.mockResolvedValue({
    cutoffDate: new Date('2026-03-11T00:00:00.000Z'),
    batchSize: 5,
    processedIncidents: 5,
    processedFiles: 10,
    markedEvidenceRecords: 10,
    fileErrors: 0,
    hasMore: true,
  })
})

describe('admin storage route', () => {
  it('returns the bounded dry-run preview without loading the full candidate set into memory', async () => {
    const res = await POST(
      new Request('http://localhost/api/admin/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysOld: 45, dryRun: true, batchSize: 5 }),
      }) as never,
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(evidenceCleanupMock.previewOldEvidenceCleanup).toHaveBeenCalledWith(45, 5)
    expect(json).toMatchObject({
      dryRun: true,
      incidents: 8,
      previewedIncidents: 5,
      totalFiles: 12,
      batchSize: 5,
      hasMore: true,
    })
  })

  it('processes cleanup in bounded batches and reports whether more work remains', async () => {
    const res = await POST(
      new Request('http://localhost/api/admin/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysOld: 45, dryRun: false, batchSize: 999 }),
      }) as never,
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(evidenceCleanupMock.cleanupOldEvidenceFiles).toHaveBeenCalledWith(45, 500)
    expect(json).toMatchObject({
      performedBy: 'root',
      batchSize: 5,
      processedIncidents: 5,
      processedFiles: 10,
      markedEvidenceRecords: 10,
      fileErrors: 0,
      hasMore: true,
    })
    expect(json.message).toMatch(/run cleanup again to continue/i)
  })

  it('still returns current storage stats for the admin dashboard contract', async () => {
    const res = await GET(new Request('http://localhost/api/admin/storage') as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toMatchObject({
      storage: {
        total: {
          files: 2,
        },
      },
      incidents: {
        oldResolvedIncidents: 3,
      },
      recommendations: {
        oldIncidentsCount: 3,
      },
    })
  })
})