// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

import VehicleLookupField from '@/components/VehicleLookupField'

describe('VehicleLookupField', () => {
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

  it('wires the visible label to a stable fallback input id', async () => {
    await act(async () => {
      root.render(
        <VehicleLookupField
          label="Vehicle Search"
          onSelect={() => undefined}
          selectedVehicle={null}
        />,
      )
    })

    const label = container.querySelector('label')
    const input = container.querySelector('input[type="text"]')

    expect(label).not.toBeNull()
    expect(input).not.toBeNull()
    expect(input?.id).toBeTruthy()
    expect(label?.htmlFor).toBe(input?.id)
    expect(input?.getAttribute('name')).toBe('vehicleLookup')
    expect(input?.getAttribute('autocomplete')).toBe('off')
  })

  it('respects explicit id, name, and autocomplete props', async () => {
    await act(async () => {
      root.render(
        <VehicleLookupField
          id="incident-vehicle-search"
          name="incidentVehicle"
          autoComplete="off"
          label="Vehicle Search"
          onSelect={() => undefined}
          selectedVehicle={null}
        />,
      )
    })

    const label = container.querySelector('label')
    const input = container.querySelector('#incident-vehicle-search')

    expect(label?.htmlFor).toBe('incident-vehicle-search')
    expect(input?.getAttribute('name')).toBe('incidentVehicle')
    expect(input?.getAttribute('autocomplete')).toBe('off')
  })
})