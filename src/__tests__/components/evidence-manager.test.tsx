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
    const overlay = dialog?.parentElement as HTMLDivElement | null

    expect(dialog).not.toBeNull()
    expect(dialog?.className).toContain('app-mobile-sheet-safe')
    expect(dialog?.className).toContain('h-full')
    expect(dialog?.className).toContain('w-full')
    expect(dialog?.className).toContain('rounded-none')
    expect(dialog?.className).toContain('sm:w-11/12')
    expect(dialog?.className).toContain('sm:max-h-[calc(100vh-2rem)]')
    expect(overlay).not.toBeNull()
    expect(overlay?.className).toContain('z-[70]')
    expect(overlay?.className).toContain('overflow-hidden')

    const uploadHeading = Array.from(container.querySelectorAll('h4')).find(
      (element) => element.textContent === 'Upload Evidence',
    )
    const uploadInput = container.querySelector('#evidence-upload') as HTMLInputElement | null
    const uploadControls = uploadInput?.parentElement as HTMLDivElement | null

    expect(uploadHeading).not.toBeNull()
    expect(uploadInput).not.toBeNull()
    expect(uploadControls).not.toBeNull()
    expect(uploadControls?.className).toContain('flex-col')
    expect(uploadControls?.className).toContain('sm:flex-row')

    expect(container.textContent).toContain('Review uploaded evidence, open files, and submit verification without leaving the incident workflow.')

    const closeButton = Array.from(container.querySelectorAll('button')).find(
      (element) => (element.textContent || '').trim() === 'Close',
    )
    const footer = closeButton?.parentElement as HTMLDivElement | null

    expect(footer).not.toBeNull()
    expect(footer?.className).toContain('flex-col-reverse')
    expect(footer?.className).toContain('sm:flex-row')
    expect(footer?.className).toContain('sticky')
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

    const viewLink = Array.from(container.querySelectorAll('a')).find((element) =>
      (element.textContent || '').includes('View'),
    ) as HTMLAnchorElement | undefined

    expect(viewLink).toBeTruthy()
    expect(viewLink?.className).toContain('w-full')
    expect(viewLink?.className).toContain('sm:w-auto')

    const reviewButton = Array.from(container.querySelectorAll('button')).find((element) =>
      (element.textContent || '').trim() === 'Review',
    ) as HTMLButtonElement | undefined

    expect(reviewButton).toBeTruthy()
    expect(reviewButton?.className).toContain('w-full')
    expect(reviewButton?.className).toContain('sm:w-auto')
  })
})