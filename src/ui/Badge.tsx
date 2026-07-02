import { statusTone, TONE_BADGE_CLASSES, type Tone } from './theme'

interface Props {
  label: string
  /** Override the tone auto-resolved from the label via statusTone(). */
  tone?: Tone
}

/** Status pill. Tone resolves from the shared statusTone() map by default. */
export default function Badge({ label, tone }: Props) {
  const t = tone ?? statusTone(label)
  return (
    <span
      className={`inline-block rounded-lg px-2.5 py-0.5 text-[11px] font-bold ${TONE_BADGE_CLASSES[t]}`}
    >
      {label.replace(/_/g, ' ')}
    </span>
  )
}
