'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  /** Wider dialog for tables/forms. */
  size?: 'md' | 'lg'
}

/**
 * Native <dialog>-based modal: Esc, focus trap and backdrop come for free, and
 * the top layer means no z-index to coordinate.
 *
 * Nothing renders while closed, so a modal's body never mounts (or fetches)
 * until it is opened.
 */
export default function Modal({ open, onClose, title, children, footer, size = 'md' }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog || !open || dialog.open) return
    // showModal is missing in some test environments; the open attribute still
    // renders the dialog inline there.
    if (typeof dialog.showModal === 'function') {
      dialog.showModal()
    } else {
      dialog.setAttribute('open', '')
    }
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      aria-labelledby={title ? titleId : undefined}
      onClose={onClose}
      onClick={(e) => {
        // click on ::backdrop registers on the dialog element itself
        if (e.target === ref.current) onClose()
      }}
      className={`m-0 w-full self-end justify-self-center rounded-t-3xl bg-surface p-0 shadow-raised backdrop:bg-ink-strong/45 lg:m-auto lg:self-center lg:rounded-3xl ${
        size === 'lg' ? 'lg:max-w-3xl' : 'lg:max-w-lg'
      }`}
    >
      <div className="app-mobile-sheet-safe flex max-h-[85dvh] flex-col lg:max-h-[80dvh]">
        <div className="flex items-center justify-between gap-3 px-6 pb-2 pt-5">
          {title ? (
            <h2 id={titleId} className="text-lg font-bold text-ink-strong">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-bg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">{children}</div>
        {footer ? <div className="border-t border-surface-border px-6 py-4">{footer}</div> : null}
      </div>
    </dialog>
  )
}
