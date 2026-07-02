'use client'

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, AlertCircle, AlertTriangle, HelpCircle } from 'lucide-react'
import Button from './Button'
import Modal from './Modal'

type ToastTone = 'success' | 'error' | 'warning'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Render the confirm action in a destructive (red) tone. */
  destructive?: boolean
}

interface FeedbackContextValue {
  toast: (message: string, tone?: ToastTone) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

const TOAST_ICON: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
}

const TOAST_CLASSES: Record<ToastTone, string> = {
  success: 'text-primary',
  error: 'text-danger',
  warning: 'text-warning-dark',
}

interface ToastState {
  id: number
  message: string
  tone: ToastTone
}

interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

/**
 * App-wide feedback: bottom-center toasts + a themed confirm dialog.
 * Web twin of mobile FeedbackProvider — replaces window.confirm and ad-hoc banners.
 */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const idRef = useRef(0)

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, message, tone }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...options, resolve })
    })
  }, [])

  const settle = useCallback(
    (ok: boolean) => {
      confirmState?.resolve(ok)
      setConfirmState(null)
    },
    [confirmState],
  )

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toasts — above the mobile bottom nav via the shared height var */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2"
        style={{ bottom: 'calc(var(--mobile-bottom-nav-height) + var(--mobile-safe-area-bottom) + 1rem)' }}
      >
        {toasts.map((t) => {
          const Icon = TOAST_ICON[t.tone]
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex max-w-md items-center gap-2 rounded-xl border border-surface-border bg-surface px-4 py-3 shadow-raised"
            >
              <Icon className={`h-5 w-5 shrink-0 ${TOAST_CLASSES[t.tone]}`} />
              <p className="text-sm font-semibold text-ink-strong">{t.message}</p>
            </div>
          )
        })}
      </div>

      {/* Confirm dialog */}
      <Modal open={confirmState != null} onClose={() => settle(false)}>
        {confirmState ? (
          <div className="flex flex-col items-center pt-2 text-center">
            <div
              className={`mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-full ${
                confirmState.destructive ? 'bg-danger-soft' : 'bg-info/10'
              }`}
            >
              {confirmState.destructive ? (
                <AlertCircle className="h-11 w-11 text-danger" />
              ) : (
                <HelpCircle className="h-11 w-11 text-info" />
              )}
            </div>
            <h3 className="text-[19px] font-extrabold text-ink-strong">
              {confirmState.title ?? 'Please confirm'}
            </h3>
            <p className="mt-2 text-sm leading-5 text-ink-muted">{confirmState.message}</p>
            <div className="mt-6 flex w-full gap-2.5">
              <Button variant="secondary" className="flex-1" onClick={() => settle(false)}>
                {confirmState.cancelLabel ?? 'Cancel'}
              </Button>
              <Button
                className={`flex-1 ${confirmState.destructive ? '!bg-danger hover:!bg-red-700 !text-white' : ''}`}
                onClick={() => settle(true)}
              >
                {confirmState.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </FeedbackContext.Provider>
  )
}

// ponytail: fallback keeps components testable without the provider; the app shell always mounts it
const FALLBACK: FeedbackContextValue = {
  toast: () => {},
  confirm: ({ message }) => Promise.resolve(typeof window !== 'undefined' ? window.confirm(message) : false),
}

export function useFeedback(): FeedbackContextValue {
  return useContext(FeedbackContext) ?? FALLBACK
}
