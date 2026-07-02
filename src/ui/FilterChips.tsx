'use client'

export interface ChipOption {
  label: string
  value: string
  count?: number
}

interface Props {
  options: ChipOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

/** Single-select chip row. Scrolls horizontally on small screens, wraps on lg+. */
export default function FilterChips({ options, value, onChange, className = '' }: Props) {
  return (
    <div className={`flex gap-2 overflow-x-auto py-0.5 lg:flex-wrap lg:overflow-visible ${className}`}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`shrink-0 rounded-full border-[1.5px] px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? 'border-primary bg-surface-tint text-primary'
                : 'border-surface-border bg-surface-bg text-ink-muted hover:border-ink-faint'
            }`}
          >
            {opt.label}
            {opt.count != null ? ` (${opt.count})` : ''}
          </button>
        )
      })}
    </div>
  )
}
