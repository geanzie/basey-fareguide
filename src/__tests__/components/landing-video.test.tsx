// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

import LandingVideo, {
  PROMO_POSTER_SRC,
  PROMO_VIDEO_SRC,
} from '@/components/landing/LandingVideo'

describe('LandingVideo', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    vi.restoreAllMocks()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  })

  it('shows only the poster until play, so the file is not downloaded on page load', async () => {
    await act(async () => {
      root.render(<LandingVideo />)
    })

    const video = container.querySelector('video')!
    expect(video.getAttribute('preload')).toBe('none')
    expect(video.getAttribute('poster')).toBe(PROMO_POSTER_SRC)
    expect(video.hasAttribute('controls')).toBe(false)
    expect(container.querySelector('source')?.getAttribute('src')).toBe(PROMO_VIDEO_SRC)

    // No captions track: the video is voice-over only.
    expect(container.querySelector('track')).toBeNull()
  })

  it('starts playback and hands over to the native controls when play is pressed', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)

    await act(async () => {
      root.render(<LandingVideo />)
    })

    const button = container.querySelector('button')!
    expect(button.textContent).toContain('Play the video')

    await act(async () => {
      button.click()
    })

    expect(play).toHaveBeenCalledTimes(1)
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('video')!.hasAttribute('controls')).toBe(true)
  })
})
