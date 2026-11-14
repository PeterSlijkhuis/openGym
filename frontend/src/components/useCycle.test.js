import { describe, it, expect, vi } from 'vitest'

const calls = []
let fail = false
vi.mock('../lib/api.js', () => ({
  api: vi.fn(async (path, init) => {
    calls.push([init?.method || 'GET', path])
    if (path === '/api/cycle' && !init) return { days: { '2026-09-01': { flow: 2 } }, prefs: {}, people: [], partners: [] }
    if (path.endsWith('/import') && !fail) return { added: 2, kept: 1, days: { '2026-09-01': { flow: 2 }, '2026-09-02': { flow: 2 } } }
    if (fail) throw new Error('nope')
    return path.endsWith('/prefs') ? { prefs: JSON.parse(init.body) } : {}
  }),
}))
vi.mock('../store/useStore.js', () => ({ useStore: () => 'u1' }))
const { refreshCycle, saveDay, savePrefs, wipeCycle, importDays } = await import('./useCycle.js')
const { renderToString } = await import('react-dom/server')

describe('useCycle', () => {
  it('shows a day at once, puts it back when the server refuses, and deletes with an empty day', async () => {
    const seen = []
    const { useCycle } = await import('./useCycle.js')
    const React = await import('react')
    const Probe = () => { seen.push(useCycle()); return null }
    renderToString(React.createElement(Probe))   // sets the owner
    await refreshCycle()
    await saveDay('2026-09-02', { flow: 1 })
    fail = true
    await expect(saveDay('2026-09-03', { flow: 3 })).rejects.toThrow('nope')
    await expect(savePrefs({ share: { u2: 'phase' } })).rejects.toThrow('nope')
    fail = false
    await saveDay('2026-09-01', {})
    await savePrefs({ share: { u2: 'phase' } })
    await wipeCycle()
    expect(calls.filter(c => c[0] === 'PUT').length).toBe(5)
    expect(calls.at(-1)).toEqual(['DELETE', '/api/cycle'])
  })
  it('imports period days and shows what the server holds afterwards', async () => {
    fail = false
    await refreshCycle()
    const r = await importDays({ '2026-09-01': { flow: 2 } })
    expect(r).toEqual({ added: 2, kept: 1 })
    expect(calls.at(-1)).toEqual(['POST', '/api/cycle/import'])
    fail = true
    await expect(importDays({ '2026-09-01': { flow: 2 } })).rejects.toThrow('nope')
    fail = false
  })
})
