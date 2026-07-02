// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

import Card from '@/ui/Card'
import GradientHeader from '@/ui/GradientHeader'

describe('surface system wrappers', () => {
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
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  })

  it('applies the shared hero and card surface classes', async () => {
    await act(async () => {
      root.render(
        <div>
          <GradientHeader title="Surface Test" subtitle="Verifies hero band classes" />
          <Card>Content body</Card>
        </div>,
      )
      await Promise.resolve()
    })

    expect(container.querySelector('.bg-brand')).not.toBeNull()
    expect(container.querySelector('.rounded-card')).not.toBeNull()
    expect(container.textContent).toContain('Surface Test')
    expect(container.textContent).toContain('Content body')
  })
})
