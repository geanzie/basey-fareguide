import { prisma } from '@/lib/prisma'

/**
 * Reset dailyUsageCount to 0 and update lastResetDate for all DiscountCard rows
 * whose lastResetDate is from a previous UTC calendar day (or null).
 *
 * This is the bulk complement to the lazy in-transaction reset that fires during
 * trip completion. Calling this once per day ensures cards that weren't used on a
 * given day still show an accurate daily count (0) rather than a stale value.
 *
 * Safe to call repeatedly — idempotent because the WHERE clause only matches cards
 * that haven't been reset today.
 *
 * @returns Number of discount cards whose daily count was reset.
 */
export async function resetStaleDailyDiscountUsage(now?: Date): Promise<number> {
  const ref = now ?? new Date()
  // Truncate to UTC midnight to compare against lastResetDate
  const todayMidnightUTC = new Date(
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()),
  )

  const result = await prisma.discountCard.updateMany({
    where: {
      dailyUsageCount: { gt: 0 },
      OR: [
        { lastResetDate: null },
        { lastResetDate: { lt: todayMidnightUTC } },
      ],
    },
    data: {
      dailyUsageCount: 0,
      lastResetDate: ref,
    },
  })

  return result.count
}
