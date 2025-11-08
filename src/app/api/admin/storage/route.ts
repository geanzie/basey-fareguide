import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { cleanupOldEvidenceFiles, getEvidenceStorageStats } from '@/lib/evidenceCleanup'

async function verifyAuth(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        userType: true,
        isActive: true
      }
    })

    return user?.isActive ? user : null
  } catch {
    return null
  }
}

// GET - Get storage statistics
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can view storage statistics
    if (user.userType !== 'ADMIN') {
      return NextResponse.json({ 
        message: 'Access denied. Admin role required.' 
      }, { status: 403 })
    }

    const stats = await getEvidenceStorageStats()

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
      incidents: {
        byStatus: incidentStats,
        oldResolvedIncidents: oldResolvedCount
      },
      recommendations: {
        cleanupNeeded: stats.total.sizeMB > 50, // Recommend cleanup if over 50MB
        oldIncidentsCount: oldResolvedCount
      }
    })
      } catch (error) {    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Manual cleanup of old evidence files
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can perform manual cleanup
    if (user.userType !== 'ADMIN') {
      return NextResponse.json({ 
        message: 'Access denied. Admin role required.' 
      }, { status: 403 })
    }

    const body = await request.json()
    const { daysOld = 30, dryRun = false } = body

    if (dryRun) {
      // Just return what would be cleaned up without actually doing it
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysOld)

      const incidents = await prisma.incident.findMany({
        where: {
          OR: [
            { status: 'RESOLVED' },
            { status: 'DISMISSED' }
          ],
          resolvedAt: {
            lt: cutoffDate
          }
        },
        include: {
          evidence: {
            select: {
              id: true,
              fileName: true,
              fileSize: true,
              fileType: true
            }
          }
        }
      })

      const totalFiles = incidents.reduce((sum, incident) => sum + incident.evidence.length, 0)
      const totalSize = incidents.reduce((sum, incident) => 
        sum + incident.evidence.reduce((evidenceSum, evidence) => evidenceSum + (evidence.fileSize || 0), 0), 0)

      return NextResponse.json({
        dryRun: true,
        incidents: incidents.length,
        totalFiles,
        totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
        cutoffDate,
        incidentDetails: incidents.map(incident => ({
          id: incident.id,
          status: incident.status,
          resolvedAt: incident.resolvedAt,
          evidenceCount: incident.evidence.length
        }))
      })
    } else {
      // Actually perform the cleanup      await cleanupOldEvidenceFiles(daysOld)
      
      return NextResponse.json({
        message: `Evidence cleanup completed for incidents resolved more than ${daysOld} days ago`,
        performedBy: user.username,
        timestamp: new Date()
      })
    }

  } catch (error) {    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
