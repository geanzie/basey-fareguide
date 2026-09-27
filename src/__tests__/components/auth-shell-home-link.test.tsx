// @vitest-environment jsdom

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import AuthShell from '@/components/auth/AuthShell'

describe('AuthShell brand header', () => {
  it('links the Basey FareCheck wordmark to the landing page', () => {
    document.body.innerHTML = renderToStaticMarkup(
      <AuthShell title="Sign in">
        <form />
      </AuthShell>,
    )

    const link = document.querySelector('a[aria-label="Basey FareCheck home"]')
    expect(link?.getAttribute('href')).toBe('/')
    expect(link?.textContent).toContain('Basey FareCheck')
  })
})
