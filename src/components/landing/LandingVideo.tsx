'use client'

import { useRef, useState } from 'react'

/**
 * The two-minute promo on the landing page. Until someone presses play it is
 * only the poster, so a visitor who scrolls past never downloads the 15 MB
 * file (preload="none"). Pressing play swaps in the browser's own controls.
 *
 * The frame is bound in tikog like the hero's banig disc, and the section sits
 * on the hero's forest so the video reads as part of it rather than a box
 * dropped onto the page. The source is rendered by promo/video/ (see its README).
 */

export const PROMO_VIDEO_SRC = '/promo/basey-farecheck-promo.mp4'
export const PROMO_POSTER_SRC = '/promo/basey-farecheck-promo-poster.webp'

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3E6C4]'

const LandingVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [started, setStarted] = useState(false)

  const play = () => {
    setStarted(true)
    const video = videoRef.current
    if (!video) return
    // A browser that refuses play() still shows the native controls.
    void video.play().catch(() => undefined)
  }

  return (
    <div className="relative aspect-video overflow-hidden rounded-plate bg-[#0f3f22] shadow-[0_0_0_4px_#E6D3A8,0_0_0_5px_rgba(0,0,0,0.25),0_24px_60px_rgba(0,0,0,0.45)]">
      <video
        ref={videoRef}
        className="size-full"
        poster={PROMO_POSTER_SRC}
        preload="none"
        playsInline
        controls={started}
        aria-label="Basey FareCheck in two minutes, with Tagalog voice-over"
      >
        <source src={PROMO_VIDEO_SRC} type="video/mp4" />
      </video>

      {started ? null : (
        <button
          type="button"
          onClick={play}
          aria-label="Play the video, 2 minutes 1 second"
          className={`group absolute inset-0 flex items-end justify-start bg-gradient-to-t from-[#0f3f22]/80 via-transparent to-transparent p-3 text-left sm:p-6 ${FOCUS_RING}`}
        >
          <span className="flex items-center gap-2 rounded-full bg-[#F3E6C4] py-1.5 pl-1.5 pr-4 text-xs font-semibold text-[#14532D] shadow-lg transition group-hover:bg-white sm:gap-4 sm:py-2 sm:pl-2 sm:pr-5 sm:text-base">
            <span className="grid size-8 place-items-center rounded-full bg-[#14532D] text-[#F3E6C4] sm:size-12">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="ml-0.5 size-4 sm:size-6" fill="currentColor">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.24-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14Z" />
              </svg>
            </span>
            Play the video
            <span className="font-normal tabular-nums text-[#14532D]/70">2:01</span>
          </span>
        </button>
      )}
    </div>
  )
}

export default LandingVideo
