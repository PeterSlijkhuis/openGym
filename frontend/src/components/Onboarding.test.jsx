// @vitest-environment happy-dom
/* The onboarding questions ahead of the first tour offer: Skip writes nothing, Next writes the
   answer, a starter plan lands on the chosen weekdays, and the offer card follows the last screen. */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../sheets.jsx', () => ({ beginWorkout: vi.fn(), loadStarterPlan: vi.fn() }))

import { useStore, DEF } from '../store/useStore.js'
import { loadStarterPlan } from '../sheets.jsx'
import { openTour, closeTour, tourState } from '../lib/tour.js'
import Tour from './Tour.jsx'

let root, host
const card = () => document.querySelector('.tour-card')
const btn = label => [...document.querySelectorAll('.tour-card button')].find(b => b.textContent === label)
const click = async el => { await act(async () => { el.click() }) }
const S = () => useStore.getState().S

beforeEach(async () => {
  localStorage.clear()
  useStore.setState({ S: JSON.parse(JSON.stringify(DEF)), user: null, ready: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { openTour({ kind: 'offer' }) })
  await act(async () => { root.render(<MemoryRouter><Tour /></MemoryRouter>) })
})
afterEach(async () => {
  await act(async () => { closeTour() })
  await act(async () => root.unmount())
  host.remove()
  vi.clearAllMocks()
})

describe('onboarding', () => {
  it('comes first, and skipping every screen changes nothing and leads to the offer', async () => {
    const before = JSON.stringify(S())
    expect(card().textContent).toContain('Make it yours')
    for (let i = 0; i < 5; i++) await click(btn('Skip'))
    expect(JSON.stringify(S())).toBe(before)
    expect(tourState()).toEqual({ kind: 'offer', asked: true })
    expect(card().textContent).toContain('Want a 1-minute tour?')
  })

  it('writes the answers as settings and puts a plan on the chosen days', async () => {
    await click(btn('Next'))
    await click([...card().querySelectorAll('button')].find(b => b.textContent === 'Female'))
    expect(card().textContent).toContain('Turn on cycle tracking')
    await click(card().querySelector('[role="switch"], .switch input, input[type="checkbox"]') || btn('Next'))
    await click(btn('Next'))
    expect(S()).toMatchObject({ sex: 'female', body: 'female', exFigure: 'female' })
    await click(btn('Skip'))
    const days = [...card().querySelectorAll('.ob-days button')]
    await click(days[0]); await click(days[2]); await click(days[4])
    await click(btn('Next'))
    expect(loadStarterPlan).toHaveBeenCalledWith('full-body', null, [1, 3, 5])
    await click(btn('Done'))
    expect(card().textContent).toContain('Want a 1-minute tour?')
  })

  it('Skip all goes straight to the offer', async () => {
    await click(btn('Skip all'))
    expect(card().textContent).toContain('Want a 1-minute tour?')
  })
})
