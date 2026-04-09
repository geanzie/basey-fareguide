// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

import EvidenceManager from '@/components/EvidenceManager'

describe('EvidenceManager', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ evidence: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    vi.stubGlobal(
      'fetch',
      fetchMock,
    )
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  })

  it('uses the mobile sheet modal pattern and stacked controls', async () => {
    await act(async () => {
      root.render(React.createElement(EvidenceManager, { incidentId: 'incident-1', onClose: vi.fn() }))
      await Promise.resolve()
    })

    const dialog = container.querySelector('[role="dialog"]')

    expect(dialog).not.toBeNull()
    expect(dialog?.className).toContain('app-mobile-sheet-safe')
    expect(dialog?.className).toContain('w-[calc(100%-1rem)]')
    expect(dialog?.className).toContain('sm:w-11/12')
    expect(dialog?.className).toContain('max-h-[calc(100vh-2rem)]')

    const uploadHeading = Array.from(container.querySelectorAll('h4')).find(
      (element) => element.textContent === 'Upload Evidence',
    )
    const uploadControls = uploadHeading?.nextElementSibling as HTMLDivElement | null

    expect(uploadControls).not.toBeNull()
    expect(uploadControls?.className).toContain('flex-col')
    expect(uploadControls?.className).toContain('sm:flex-row')

    const closeButton = Array.from(container.querySelectorAll('button')).find(
      (element) => (element.textContent || '').trim() === 'Close',
    )
    const footer = closeButton?.parentElement as HTMLDivElement | null

    expect(footer).not.toBeNull()
    expect(footer?.className).toContain('flex-col-reverse')
    expect(footer?.className).toContain('sm:flex-row')
  })

  it('lets long filenames wrap without pushing the mobile layout wide', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          evidence: [
            {
              id: 'ev-1',
              fileName: 'very-long-evidence-file-name-without-natural-breakpoints-1234567890-camera-upload-version-final-proof.png',
              fileUrl: '/uploads/proof.png',
              fileType: 'IMAGE',
              fileSize: 2048,
              status: 'PENDING_REVIEW',
              createdAt: '2026-04-09T10:00:00.000Z',
              uploader: {
                firstName: 'Ana',
                lastName: 'Dela Cruz',
                email: 'ana@example.com',
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    await act(async () => {
      root.render(React.createElement(EvidenceManager, { incidentId: 'incident-2', onClose: vi.fn() }))
      await Promise.resolve()
      await Promise.resolve()
    })

    const fileName = Array.from(container.querySelectorAll('h5')).find((element) =>
      (element.textContent || '').includes('very-long-evidence-file-name-without-natural-breakpoints'),
    )

    expect(fileName).not.toBeNull()
    expect(fileName?.className).toContain('break-all')
    expect(fileName?.className).toContain('min-w-0')

    const fileNameRow = fileName?.parentElement as HTMLDivElement | null
    expect(fileNameRow).not.toBeNull()
    expect(fileNameRow?.className).toContain('flex-col')
    expect(fileNameRow?.className).toContain('sm:flex-row')

    const statusBadge = fileNameRow?.querySelector('span:last-child') as HTMLSpanElement | null
    expect(statusBadge).not.toBeNull()
    expect(statusBadge?.className).toContain('shrink-0')
    expect(statusBadge?.className).toContain('self-start')
  })
})