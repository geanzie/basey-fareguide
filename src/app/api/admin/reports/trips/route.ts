import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'

const TREND_ROW_LIMIT = 500

/**
 * GET /api/admin/reports/trips
 *
 * Admin analytics for trip sessions, fare revenue, discount usage, and ticket
 * payment status.  Supports the same ?period= parameter as /api/admin/reports
 * (7d | 30d | 90d | 1y, default 30d).
 *
 * Response shape:
 * {
 *   success: true,
 *   data: {
 *     generatedAt: string,
 *     period: string,
 *     trips: { total, closed, totalFare, averageFare, byDiscountType, monthlyRevenue },
 *     discounts: { totalUsages, totalDiscountAmount, totalOriginalFare, byType },
 *     tickets: { total, paid, unpaid, pendingPayment, totalPenaltyAmount },
 *   }
 * }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireRequestRole(request, [...ADMIN_ONLY])

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'

    const now = new Date()
    const startDate = new Date()
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
      case '90d':
        startDate.setDate(now.getDate() - 90)
        break
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1)
        break
      default:
        startDate.setDate(now.getDate() - 30)
    }

    const periodFilter = { gte: startDate }

    const [
      totalSessions,
      closedSessions,
      fareTotals,
      recentFares,
      fareByDiscountType,
      discountTotals,
      discountByType,
      totalTickets,
      ticketsByPaymentStatus,
      ticketPenaltySums,
    ] = await Promise.all([
      // Sessions
      prisma.vehicleTripSession.count({
        where: { openedAt: periodFilter },
      }),
      prisma.vehicleTripSession.count({
        where: { openedAt: periodFilter, status: 'CLOSED' },
      }),

      // Fare aggregates
      prisma.fareCalculation.aggregate({
        where: { createdAt: periodFilter },
        _count: { _all: true },
        _sum: { calculatedFare: true },
        _avg: { calculatedFare: true },
      }),

      // Bounded rows for monthly revenue trend
      prisma.fareCalculation.findMany({
        where: { createdAt: periodFilter },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: TREND_ROW_LIMIT,
        select: { createdAt: true, calculatedFare: true },
      }),

      // Trips by discount type
      prisma.fareCalculation.groupBy({
        by: ['discountType'],
        where: { createdAt: periodFilter },
        _count: { _all: true },
        _sum: { calculatedFare: true },
      }),

      // Discount usage totals
      prisma.discountUsageLog.aggregate({
        where: { usedAt: periodFilter },
        _count: { _all: true },
        _sum: { discountAmount: true, originalFare: true },
      }),

      // Discount usage by type (via FareCalculation join through discountType)
      prisma.fareCalculation.groupBy({
        by: ['discountType'],
        where: {
          createdAt: periodFilter,
          discountType: { not: null },
          discountApplied: { gt: 0 },
        },
        _count: { _all: true },
        _sum: { discountApplied: true },
      }),

      // Ticket/incident totals
      prisma.incident.count({
        where: { createdAt: periodFilter },
      }),
      prisma.incident.groupBy({
        by: ['paymentStatus'],
        where: { createdAt: periodFilter },
        _count: { _all: true },
      }),
      prisma.incident.aggregate({
        where: { createdAt: periodFilter },
        _sum: { penaltyAmount: true },
      }),
    ])

    // Monthly revenue trend (JS aggregation, bounded rows)
    const monthlyRevenue: Record<string, { trips: number; fare: number }> = {}
    recentFares.forEach((fc) => {
      const month = fc.createdAt.toISOString().substring(0, 7)
      if (!monthlyRevenue[month]) monthlyRevenue[month] = { trips: 0, fare: 0 }
      monthlyRevenue[month].trips++
      monthlyRevenue[month].fare += Number(fc.calculatedFare ?? 0)
    })
    // Round fare values
    Object.keys(monthlyRevenue).forEach((m) => {
      monthlyRevenue[m].fare = Math.round(monthlyRevenue[m].fare * 100) / 100
    })

    // Trips by discount type
    const tripsByDiscount: Record<string, { count: number; totalFare: number }> = {}
    fareByDiscountType.forEach((row) => {
      const key = row.discountType ?? 'NONE'
      tripsByDiscount[key] = {
        count: row._count._all,
        totalFare: Math.round(Number(row._sum.calculatedFare ?? 0) * 100) / 100,
      }
    })

    // Discount savings by type
    const savingsByType: Record<string, { count: number; totalSaved: number }> = {}
    discountByType.forEach((row) => {
      if (row.discountType) {
        savingsByType[row.discountType] = {
          count: row._count._all,
          totalSaved: Math.round(Number(row._sum.discountApplied ?? 0) * 100) / 100,
        }
      }
    })

    // Ticket payment status breakdown
    const ticketPaymentObj: Record<string, number> = {}
    ticketsByPaymentStatus.forEach((row) => {
      if (row.paymentStatus) ticketPaymentObj[row.paymentStatus] = row._count._all
    })

    return NextResponse.json({
      success: true,
      data: {
        generatedAt: now.toISOString(),
        period,
        trips: {
          totalSessions,
          closedSessions,
          totalTrips: fareTotals._count._all,
          totalFare: Math.round(Number(fareTotals._sum.calculatedFare ?? 0) * 100) / 100,
          averageFare: Math.round(Number(fareTotals._avg.calculatedFare ?? 0) * 100) / 100,
          byDiscountType: tripsByDiscount,
          monthlyRevenue,
        },
        discounts: {
          totalUsages: discountTotals._count._all,
          totalDiscountAmount: Math.round(Number(discountTotals._sum.discountAmount ?? 0) * 100) / 100,
          totalOriginalFare: Math.round(Number(discountTotals._sum.originalFare ?? 0) * 100) / 100,
          byType: savingsByType,
        },
        tickets: {
          total: totalTickets,
          byPaymentStatus: ticketPaymentObj,
          totalPenaltyAmount: Math.round(Number(ticketPenaltySums._sum.penaltyAmount ?? 0) * 100) / 100,
        },
      },
    })
  } catch (error) {
    const authError = createAuthErrorResponse(error)
    if (authError.status !== 500) {
      return authError
    }
    return NextResponse.json(
      { success: false, error: 'Failed to generate trip reports' },
      { status: 500 },
    )
  }
}
