import { HeadBucketCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMissingS3EnvVars, getS3Bucket, getS3Client } from '@/lib/s3Client'
import {
  cleanupOldEvidenceFiles,
  clampEvidenceCleanupBatchSize,
  getEvidenceStorageStats,
  previewOldEvidenceCleanup,
} from '@/lib/evidenceCleanup'

function parsePositiveInteger(value: unknown, fallback: number): number {
  const parsedValue = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback
  }

  return parsedValue
}

/**
 * Whether the evidence bucket is actually usable, not merely configured.
 *
 * The database rows say what SHOULD exist; this says whether the bucket behind
 * them answers. Admin-only, so spending one HeadBucket call is fine — the
 * unauthenticated /api/health deliberately checks configuration only.
 */
async function checkBucketReachable(): Promise<{
  configured: boolean
  missingEnvVars: string[]
  reachable: boolean | null
  bucket: string | null
  error: string | null
}> {
  const missingEnvVars = getMissingS3EnvVars()

  if (missingEnvVars.length > 0) {
    return {
      configured: false,
      missingEnvVars,
      reachable: null,
      bucket: null,
      error:
        'Object storage is not configured. Evidence uploads and discount-card ID photos will be rejected until these environment variables are set.',
    }
  }

  const bucket = getS3Bucket()

  try {
    await getS3Client().send(new HeadBucketCommand({ Bucket: bucket }))
    return { configured: true, missingEnvVars: [], reachable: true, bucket, error: null }
  } catch (error) {
    // Credentials, bucket name, region, and endpoint all surface here.
    return {
      configured: true,
      missingEnvVars: [],
      reachable: false,
      bucket,
      error: error instanceof Error ? error.message : 'Bucket is not reachable',
    }
  }
}

// GET - Get storage statistics
export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_ONLY])

    const stats = await getEvidenceStorageStats()
    const objectStorage = await checkBucketReachable()

    // Get additional statistics
    const incidentStats = await prisma.incident.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    })

    const oldResolvedCount = await prisma.incident.count({
      where: {
        OR: [
          { status: 'RESOLVED' },
          { status: 'DISMISSED' }
        ],
        resolvedAt: {
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
        }
      }
    })

    return NextResponse.json({
      storage: stats,
      objectStorage,
      incidents: {
        byStatus: incidentStats,
        oldResolvedIncidents: oldResolvedCount
      },
      recommendations: {
        cleanupNeeded: stats.total.sizeMB > 50, // Recommend cleanup if over 50MB
        oldIncidentsCount: oldResolvedCount,
        // Louder than a cleanup hint: with storage down, every incident report
        // carrying a file is rejected outright.
        storageUnavailable: !objectStorage.configured || objectStorage.reachable === false
      }
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}

// POST - Manual cleanup of old evidence files
export async function POST(request: NextRequest) {
  try {
    const user = await requireRequestRole(request, [...ADMIN_ONLY])

    const body = await request.json().catch(() => ({}))
    const daysOld = parsePositiveInteger(body.daysOld, 30)
    const dryRun = body.dryRun === true
    const batchSize = clampEvidenceCleanupBatchSize(body.batchSize)

    if (dryRun) {
      const preview = await previewOldEvidenceCleanup(daysOld, batchSize)

      return NextResponse.json({
        dryRun: true,
        incidents: preview.totalIncidents,
        totalFiles: preview.totalFiles,
        totalSizeMB: preview.totalSizeMB,
        cutoffDate: preview.cutoffDate,
        previewedIncidents: preview.previewedIncidents,
        batchSize: preview.batchSize,
        hasMore: preview.hasMore,
        incidentDetails: preview.incidentDetails.map((incident) => ({
          id: incident.id,
          status: incident.status,
          resolvedAt: incident.resolvedAt,
          evidenceCount: incident.evidenceCount,
        })),
      })
    } else {
      const cleanupResult = await cleanupOldEvidenceFiles(daysOld, batchSize)
      
      return NextResponse.json({
        message: cleanupResult.hasMore
          ? `Evidence cleanup processed ${cleanupResult.processedIncidents} incidents in this batch. Run cleanup again to continue.`
          : `Evidence cleanup completed for incidents resolved more than ${daysOld} days ago`,
        performedBy: user.username,
        timestamp: new Date(),
        cutoffDate: cleanupResult.cutoffDate,
        batchSize: cleanupResult.batchSize,
        processedIncidents: cleanupResult.processedIncidents,
        processedFiles: cleanupResult.processedFiles,
        markedEvidenceRecords: cleanupResult.markedEvidenceRecords,
        fileErrors: cleanupResult.fileErrors,
        hasMore: cleanupResult.hasMore,
      })
    }

  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
