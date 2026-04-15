'use client'

import { useEffect, useId, useRef } from 'react'

type ScannerHandle = {
  isScanning?: boolean
  stop: () => Promise<unknown>
  clear: () => void | Promise<void>
}

function safelyClearScanner(scanner: ScannerHandle) {
  try {
    const clearResult = scanner.clear()
    if (clearResult && typeof clearResult === 'object' && 'catch' in clearResult) {
      void clearResult.catch(() => {})
    }
  } catch {}
}

function safelyDisposeScanner(scanner: ScannerHandle) {
  if (!scanner.isScanning) {
    safelyClearScanner(scanner)
    return
  }

  try {
    void scanner.stop().catch(() => {}).finally(() => {
      safelyClearScanner(scanner)
    })
  } catch {
    safelyClearScanner(scanner)
  }
}

interface QrTokenScannerPanelProps {
  active: boolean
  onDetected: (token: string) => void
  onCameraNotice: (message: string) => void
}

export default function QrTokenScannerPanel({
  active,
  onDetected,
  onCameraNotice,
}: QrTokenScannerPanelProps) {
  const readerId = useId().replace(/:/g, '-')
  const scannerRef = useRef<ScannerHandle | null>(null)
  const isSettledRef = useRef(false)
  const onDetectedRef = useRef(onDetected)
  const onCameraNoticeRef = useRef(onCameraNotice)

  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])

  useEffect(() => {
    onCameraNoticeRef.current = onCameraNotice
  }, [onCameraNotice])

  useEffect(() => {
    if (!active) {
      return
    }

    const readerElement = document.getElementById(readerId)

    if (!readerElement) {
      return
    }

    readerElement.replaceChildren()

    if (!navigator.mediaDevices?.getUserMedia) {
      onCameraNoticeRef.current('Camera scanning is not supported by this browser.')
      return
    }

    let disposed = false

    void (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')

        if (disposed) {
          return
        }

        const scanner = new Html5Qrcode(readerId, { verbose: false })
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
          },
          (decodedText: string) => {
            if (disposed || isSettledRef.current) {
              return
            }

            isSettledRef.current = true
            onDetectedRef.current(decodedText)
          },
          () => {},
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to access the device camera.'

        if (message.includes('NotAllowedError') || message.toLowerCase().includes('permission')) {
          onCameraNoticeRef.current('Camera permission was denied. You can continue without scanning.')
          return
        }

        if (message.includes('NotFoundError') || message.toLowerCase().includes('camera')) {
          onCameraNoticeRef.current('No camera was found on this device.')
          return
        }

        onCameraNoticeRef.current('Camera scanning is unavailable right now.')
      }
    })()

    return () => {
      disposed = true
      isSettledRef.current = false

      if (scannerRef.current) {
        const currentScanner = scannerRef.current
        scannerRef.current = null
        safelyDisposeScanner(currentScanner)
      }

      readerElement.replaceChildren()
    }
  }, [active, readerId])

  return <div id={readerId} className="min-h-[220px] overflow-hidden rounded-2xl bg-black sm:min-h-[260px]" />
}