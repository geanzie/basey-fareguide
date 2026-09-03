import PageShell from '@/ui/PageShell'
import { SkeletonBox } from '@/ui/Skeleton'

/**
 * Route-level loading state for /calculator. It renders the real PageShell, so
 * the band and column width are already final when the calculator arrives —
 * only the body swaps. The shape mirrors RoutePlannerCalculator's first phase:
 * a back/title row, then one card of ride choices.
 */
export default function CalculatorPageSkeleton() {
  return (
    <PageShell
      title="Fare Calculator"
      subtitle="Plan a route and get the official fare under Ordinance 105"
      width="narrow"
    >
      <div className="mx-auto w-full max-w-xl space-y-4">
        <div className="flex items-center gap-2">
          <SkeletonBox className="h-10 w-10 rounded-full" />
          <SkeletonBox className="h-6 w-40" />
        </div>

        <div className="rounded-sheet border border-surface-border bg-surface p-4 shadow-card">
          <SkeletonBox className="h-4 w-full" />
          <SkeletonBox className="mt-2 h-4 w-4/5" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <SkeletonBox className="h-24 rounded-2xl" />
            <SkeletonBox className="h-24 rounded-2xl" />
            <SkeletonBox className="h-24 rounded-2xl" />
            <SkeletonBox className="h-24 rounded-2xl" />
          </div>
        </div>
      </div>
    </PageShell>
  )
}
