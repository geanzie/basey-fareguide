import PageShell from '@/ui/PageShell'
import { SkeletonBox } from '@/ui/Skeleton'

/** Route-level loading state for /report — same shell and column as the form. */
export default function ReportPageSkeleton() {
  return (
    <PageShell
      title="Report Incident"
      subtitle="File a violation report with optional photo evidence"
      width="narrow"
    >
      <div className="rounded-card border border-surface-border bg-surface p-6 shadow-card">
        <SkeletonBox className="h-20 rounded-xl" />
        <div className="mt-6 space-y-5">
          <SkeletonBox className="h-24 rounded-xl" />
          <SkeletonBox className="h-32 rounded-xl" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SkeletonBox className="h-24 rounded-xl" />
            <SkeletonBox className="h-24 rounded-xl" />
          </div>
          <SkeletonBox className="h-32 rounded-xl" />
          <div className="flex justify-end gap-3">
            <SkeletonBox className="h-12 w-24 rounded-xl" />
            <SkeletonBox className="h-12 w-40 rounded-xl" />
          </div>
        </div>
      </div>
    </PageShell>
  )
}
