import { PrismaClient } from '@/generated/prisma'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const prisma = new PrismaClient()

/**
 * Delete evidence files from filesystem when an incident is resolved
 * This helps manage storage space on free hosting tiers
 */
export async function cleanupEvidenceFiles(incidentId: string): Promise<void> {
  try {
    console.log(`Starting evidence cleanup for incident: ${incidentId}`)
    
    // Get all evidence for this incident
    const evidenceList = await prisma.evidence.findMany({
      where: { incidentId },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        fileType: true
      }
    })

    if (evidenceList.length === 0) {
      console.log(`No evidence files found for incident: ${incidentId}`)
      return
    }

    let deletedCount = 0
    let errorCount = 0

    // Delete each evidence file from filesystem
    for (const evidence of evidenceList) {
      try {
        // Construct file path
        const filePath = join(process.cwd(), 'public', 'uploads', 'evidence', evidence.fileName)
        
        // Check if file exists before trying to delete
        if (existsSync(filePath)) {
          await unlink(filePath)
          deletedCount++
          console.log(`✅ Deleted evidence file: ${evidence.fileName}`)
        } else {
          console.log(`⚠️ Evidence file not found (already deleted?): ${evidence.fileName}`)
        }
      } catch (fileError) {
        errorCount++
        console.error(`❌ Failed to delete evidence file: ${evidence.fileName}`, fileError)
      }
    }

    // Update evidence records to mark as cleaned up (optional - keeps audit trail)
    await prisma.evidence.updateMany({
      where: { incidentId },
      data: { 
        remarks: 'Evidence files deleted after incident resolution'
      }
    })

    console.log(`✅ Evidence cleanup completed for incident: ${incidentId}`)
    console.log(`   - Files deleted: ${deletedCount}`)
    console.log(`   - Errors: ${errorCount}`)
    console.log(`   - Total evidence records: ${evidenceList.length}`)

  } catch (error) {
    console.error(`❌ Evidence cleanup failed for incident: ${incidentId}`, error)
    throw error
  }
}

/**
 * Cleanup evidence files older than specified days (for maintenance)
 * This can be run as a scheduled job to clean up old resolved incidents
 */
export async function cleanupOldEvidenceFiles(daysOld: number = 30): Promise<void> {
  try {
    console.log(`Starting cleanup of evidence files older than ${daysOld} days`)
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    // Find resolved incidents older than cutoff date
    const oldResolvedIncidents = await prisma.incident.findMany({
      where: {
        OR: [
          { status: 'RESOLVED' },
          { status: 'DISMISSED' }
        ],
        resolvedAt: {
          lt: cutoffDate
        }
      },
      select: { id: true }
    })

    console.log(`Found ${oldResolvedIncidents.length} old resolved incidents`)

    // Cleanup evidence for each old incident
    for (const incident of oldResolvedIncidents) {
      await cleanupEvidenceFiles(incident.id)
    }

    console.log(`✅ Bulk evidence cleanup completed`)

  } catch (error) {
    console.error(`❌ Bulk evidence cleanup failed:`, error)
    throw error
  }
}

/**
 * Get storage statistics for evidence files
 */
export async function getEvidenceStorageStats() {
  try {
    const stats = await prisma.evidence.groupBy({
      by: ['fileType'],
      _sum: {
        fileSize: true
      },
      _count: {
        id: true
      }
    })

    const totalStats = await prisma.evidence.aggregate({
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
  } catch (error) {
    console.error('Failed to get evidence storage stats:', error)
    throw error
  }
}