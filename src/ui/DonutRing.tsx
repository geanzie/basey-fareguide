import { TONE_HEX, type Tone } from './theme'

interface Props {
  /** Progress fraction, 0..1. Clamped. */
  percent: number
  size?: number
  strokeWidth?: number
  tone?: Tone
  /** Small caption under the big percentage in the center. */
  centerLabel?: string
}

/** Lightweight SVG progress ring — no chart library. Arc starts at 12 o'clock. */
export default function DonutRing({
  percent,
  size = 120,
  strokeWidth = 12,
  tone = 'success',
  centerLabel,
}: Props) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(percent) ? percent : 0))
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  const dash = c * clamped
  const color = TONE_HEX[tone]

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center">
        <div className="text-[26px] font-extrabold" style={{ color }}>
          {Math.round(clamped * 100)}%
        </div>
        {centerLabel ? <div className="mt-px text-[11px] font-semibold text-ink-muted">{centerLabel}</div> : null}
      </div>
    </div>
  )
}
