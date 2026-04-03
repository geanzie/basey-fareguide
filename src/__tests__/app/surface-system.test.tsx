// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

import PageWrapper, { PageSection } from '@/components/PageWrapper'

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

  it('applies the shared page and card surface classes', async () => {
    await act(async () => {
      root.render(
        <PageWrapper title="Surface Test" subtitle="Verifies gradient wrapper classes">
          <PageSection title="Section">Content body</PageSection>
        </PageWrapper>,
      )
      await Promise.resolve()
    })

    expect(container.querySelector('.app-page-bg')).not.toBeNull()
    expect(container.querySelector('.app-surface-card')).not.toBeNull()
    expect(container.textContent).toContain('Section')
    expect(container.textContent).toContain('Content body')
  })
})
