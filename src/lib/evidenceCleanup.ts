import { del } from '@vercel/blob'
import { prisma } from '@/lib/prisma'

export const DEFAULT_EVIDENCE_CLEANUP_BATCH_SIZE = 100
export const MAX_EVIDENCE_CLEANUP_BATCH_SIZE = 500
export const RESOLVED_EVIDENCE_RETENTION_DAYS = 30

const EVIDENCE_CLEANUP_ELIGIBLE_INCIDENT_STATUSES = ['RESOLVED', 'DISMISSED'] as const

interface EvidenceCleanupFileResult {
  deletedCount: number
  errorCount: number
  markedCount: number
}

interface OldEvidenceCleanupCandidate {
  id: string
  status: string
  resolvedAt: Date | null
  evidence: Array<{
    id: string
    fileName: string
    fileSize: number | null
    fileType: string
  }>
}

export interface EvidenceCleanupPreviewResult {
  cutoffDate: Date
  totalIncidents: number
  previewedIncidents: number
  totalFiles: number
  totalSizeBytes: number
  totalSizeMB: number
  batchSize: number
  hasMore: boolean
  incidentDetails: Array<{
    id: string
    status: string
    resolvedAt: Date | null
    evidenceCount: number
  }>
}

export interface EvidenceCleanupExecutionResult {
  cutoffDate: Date
  batchSize: number
  processedIncidents: number
  processedFiles: number
  markedEvidenceRecords: number
  fileErrors: number
  hasMore: boolean
}

function coercePositiveInteger(value: unknown, fallback: number): number {
  const parsedValue = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback
  }

  return parsedValue
}

export function clampEvidenceCleanupBatchSize(value: unknown): number {
  return Math.min(
    coercePositiveInteger(value, DEFAULT_EVIDENCE_CLEANUP_BATCH_SIZE),
    MAX_EVIDENCE_CLEANUP_BATCH_SIZE,
  )
}

function buildCleanupCutoffDate(daysOld: number): Date {
  const cutoffDate = new Date()
  cutoffDate.setDate(
    cutoffDate.getDate() - coercePositiveInteger(daysOld, RESOLVED_EVIDENCE_RETENTION_DAYS),
  )
  return cutoffDate
}

function buildCleanupIncidentWhere(cutoffDate: Date, requireAvailableEvidence: boolean) {
  return {
    status: {
      in: [...EVIDENCE_CLEANUP_ELIGIBLE_INCIDENT_STATUSES],
    },
    resolvedAt: {
      lt: cutoffDate,
    },
    ...(requireAvailableEvidence
      ? {
          evidence: {
            some: {
              storageStatus: 'AVAILABLE' as const,
            },
          },
        }
      : {}),
  }
}

async function listOldEvidenceCleanupCandidates(
  cutoffDate: Date,
  batchSize: number,
): Promise<OldEvidenceCleanupCandidate[]> {
  return prisma.incident.findMany({
    where: buildCleanupIncidentWhere(cutoffDate, true),
    orderBy: [{ resolvedAt: 'asc' }, { id: 'asc' }],
    take: batchSize,
    select: {
      id: true,
      status: true,
      resolvedAt: true,
      evidence: {
        where: {
          storageStatus: 'AVAILABLE',
        },
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          fileType: true,
        },
      },
    },
  })
}

/**
 * Delete stored evidence blobs for incidents that have already passed the retention window.
 *
 * Resolved incidents keep their evidence blobs available for operational review during the
 * retention period. After that TTL expires, scheduled cleanup removes blob storage while the
 * evidence rows continue to preserve review remarks and deletion metadata for audit purposes.
 */
export async function cleanupEvidenceFiles(incidentId: string): Promise<EvidenceCleanupFileResult> {
  try {    // Get all evidence for this incident
    const evidenceList = await prisma.evidence.findMany({
      where: {
        incidentId,
        storageStatus: 'AVAILABLE'
      },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        fileType: true
      }
    })

    if (evidenceList.length === 0) {
      return {
        deletedCount: 0,
        errorCount: 0,
        markedCount: 0,
      }
    }

    let deletedCount = 0
    let errorCount = 0

    // Delete each evidence blob from persistent storage
    for (const evidence of evidenceList) {
      try {
        if (evidence.fileUrl) {
          await del(evidence.fileUrl)
          deletedCount++        } else {        }
      } catch (fileError) {
        errorCount++      }
    }

    const deletedAt = new Date()

    // Update evidence records to mark storage cleanup without touching review remarks
    const markedEvidence = await prisma.evidence.updateMany({
      where: {
        incidentId,
        storageStatus: 'AVAILABLE'
      },
      data: { 
        storageStatus: 'DELETED',
        fileDeletedAt: deletedAt
      }
    })

    return {
      deletedCount,
      errorCount,
      markedCount: markedEvidence.count,
    }
      } catch (error) {    throw error
  }
}

/**
 * Preview the resolved incidents whose evidence blobs are old enough for scheduled cleanup.
 */
export async function previewOldEvidenceCleanup(
  daysOld: number = RESOLVED_EVIDENCE_RETENTION_DAYS,
  batchSize: number = DEFAULT_EVIDENCE_CLEANUP_BATCH_SIZE,
): Promise<EvidenceCleanupPreviewResult> {
  try {
    const cutoffDate = buildCleanupCutoffDate(daysOld)
    const effectiveBatchSize = clampEvidenceCleanupBatchSize(batchSize)
    const cleanupWhere = buildCleanupIncidentWhere(cutoffDate, true)

    const [incidents, totalIncidents, evidenceTotals] = await Promise.all([
      listOldEvidenceCleanupCandidates(cutoffDate, effectiveBatchSize),
      prisma.incident.count({
        where: cleanupWhere,
      }),
      prisma.evidence.aggregate({
        where: {
          storageStatus: 'AVAILABLE',
          incident: {
            status: {
              in: [...EVIDENCE_CLEANUP_ELIGIBLE_INCIDENT_STATUSES],
            },
            resolvedAt: {
              lt: cutoffDate,
            },
          },
        },
        _sum: {
          fileSize: true,
        },
        _count: {
          id: true,
        },
      }),
    ])

    const totalSizeBytes = evidenceTotals._sum.fileSize || 0

    return {
      cutoffDate,
      totalIncidents,
      previewedIncidents: incidents.length,
      totalFiles: evidenceTotals._count.id || 0,
      totalSizeBytes,
      totalSizeMB: Math.round((totalSizeBytes / (1024 * 1024)) * 100) / 100,
      batchSize: effectiveBatchSize,
      hasMore: totalIncidents > incidents.length,
      incidentDetails: incidents.map((incident) => ({
        id: incident.id,
        status: incident.status,
        resolvedAt: incident.resolvedAt,
        evidenceCount: incident.evidence.length,
      })),
    }
  } catch (error) {
    throw error
  }
}

export async function cleanupOldEvidenceFiles(
  daysOld: number = RESOLVED_EVIDENCE_RETENTION_DAYS,
  batchSize: number = DEFAULT_EVIDENCE_CLEANUP_BATCH_SIZE,
): Promise<EvidenceCleanupExecutionResult> {
  try {
    const cutoffDate = buildCleanupCutoffDate(daysOld)
    const effectiveBatchSize = clampEvidenceCleanupBatchSize(batchSize)
    const cleanupWhere = buildCleanupIncidentWhere(cutoffDate, true)

    const [oldResolvedIncidents, totalIncidents] = await Promise.all([
      prisma.incident.findMany({
        where: cleanupWhere,
        orderBy: [{ resolvedAt: 'asc' }, { id: 'asc' }],
        take: effectiveBatchSize,
        select: { id: true },
      }),
      prisma.incident.count({
        where: cleanupWhere,
      }),
    ])

    let processedFiles = 0
    let markedEvidenceRecords = 0
    let fileErrors = 0

    for (const incident of oldResolvedIncidents) {
      const cleanupResult = await cleanupEvidenceFiles(incident.id)
      processedFiles += cleanupResult.deletedCount
      markedEvidenceRecords += cleanupResult.markedCount
      fileErrors += cleanupResult.errorCount
    }

    return {
      cutoffDate,
      batchSize: effectiveBatchSize,
      processedIncidents: oldResolvedIncidents.length,
      processedFiles,
      markedEvidenceRecords,
      fileErrors,
      hasMore: totalIncidents > oldResolvedIncidents.length,
    }
  } catch (error) {
    throw error
  }
}

/**
 * Get storage statistics for evidence records.
 */
export async function getEvidenceStorageStats() {
  try {
    const stats = await prisma.evidence.groupBy({
      by: ['fileType'],
      where: {
        storageStatus: 'AVAILABLE'
      },
      _sum: {
        fileSize: true
      },
      _count: {
        id: true
      }
    })

    const totalStats = await prisma.evidence.aggregate({
      where: {
        storageStatus: 'AVAILABLE'
      },
      _sum: {
        fileSize: true
      },
      _count: {
        id: true
      }
    })

    return {
      byType: stats,
      total: {
        files: totalStats._count.id || 0,
        sizeBytes: totalStats._sum.fileSize || 0,
        sizeMB: Math.round((totalStats._sum.fileSize || 0) / (1024 * 1024) * 100) / 100
      }
    }
  } catch (error) {    throw error
  }
}
