interface BoxProps {
  className?: string
}

/** Pulsing placeholder block. Size it with width/height utility classes. */
export function SkeletonBox({ className = '' }: BoxProps) {
  return <div className={`animate-pulse rounded-lg bg-surface-border ${className}`} />
}

export function CardSkeleton({ variant = 'simple' }: { variant?: 'simple' | 'complex' }) {
  if (variant === 'complex') {
    return (
      <div className="rounded-card border border-surface-border bg-surface p-3.5 shadow-card">
        <div className="mb-2 flex items-center justify-between">
          <SkeletonBox className="h-3.5 w-[55%]" />
          <SkeletonBox className="h-[22px] w-[68px] rounded-full" />
        </div>
        <SkeletonBox className="mt-1.5 h-3 w-3/4" />
        <SkeletonBox className="mt-1 h-3 w-3/5" />
        <div className="mt-3 flex flex-wrap gap-2">
          <SkeletonBox className="h-[30px] w-[74px] rounded-xl" />
          <SkeletonBox className="h-[30px] w-[74px] rounded-xl" />
          <SkeletonBox className="h-[30px] w-[82px] rounded-xl" />
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-card border border-surface-border bg-surface p-3.5 shadow-card">
      <SkeletonBox className="h-3.5 w-3/5" />
      <SkeletonBox className="mt-1.5 h-3 w-[45%]" />
      <SkeletonBox className="mt-1 h-2.5 w-[35%]" />
    </div>
  )
}

export function ListSkeleton({ count = 4, variant }: { count?: number; variant?: 'simple' | 'complex' }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} variant={variant} />
      ))}
    </div>
  )
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-card border border-surface-border bg-surface p-4 shadow-card">
          <SkeletonBox className="h-7 w-7 rounded-full" />
          <SkeletonBox className="mt-2 h-6 w-3/5" />
          <SkeletonBox className="mt-1 h-2.5 w-4/5" />
        </div>
      ))}
    </div>
  )
}

export function SectionSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="mb-2">
      <SkeletonBox className="mb-2.5 h-3 w-2/5" />
      <ListSkeleton count={count} />
    </div>
  )
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="flex flex-col items-center p-6">
      <SkeletonBox className="h-20 w-20 rounded-full" />
      <SkeletonBox className="mt-4 h-[18px] w-1/2" />
      <SkeletonBox className="mt-1.5 h-3 w-[35%]" />
      <div className="mt-6 flex w-full flex-col gap-4">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <SkeletonBox className="h-3 w-[30%]" />
            <SkeletonBox className="h-[46px] rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}
