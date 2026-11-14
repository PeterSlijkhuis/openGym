import { describe, it, expect } from 'vitest'
import { addDays, cleanDay, ovDay, tempShift, forecast, kindOn, stats, upcoming, cycleSignals } from './cycle.js'

const flowDays = starts => Object.fromEntries(starts.flatMap(s => [0, 1, 2, 3, 4].map(i => [addDays(s, i), { flow: 2 }])))
const days = flowDays(['2026-07-01', '2026-07-29', '2026-08-26'])
// waking temperatures from 08-31: six low, then a clear rise from 09-12
const temps = (from, list) => Object.fromEntries(list.map((t, i) => [addDays(from, i), { temp: t }]))

describe('cycle: temperature, LH tests, what to expect, signals', () => {
  it('keeps a plausible temperature in °C and the LH result', () => {
    expect(cleanDay({ temp: '36.456', lh: 'pos' })).toEqual({ temp: 36.46, lh: 'pos' })
    expect(cleanDay({ temp: 98.2, lh: 'maybe' })).toBe(null)
  })
  it('finds a temperature rise by the three-over-six rule, and not a blip', () => {
    const d = temps('2026-09-04', [36.3, 36.4, 36.3, 36.35, 36.4, 36.3, 36.3, 36.3, 36.5, 36.55, 36.65, 36.6])
    const ds = Object.keys(d).sort()
    expect(tempShift(d, ds)).toEqual({ first: '2026-09-12', cover: 36.4 })
    const blip = temps('2026-09-04', [36.3, 36.4, 36.3, 36.35, 36.4, 36.3, 36.6, 36.3, 36.35, 36.3])
    expect(tempShift(blip, Object.keys(blip).sort())).toBe(null)
  })
  it('dates ovulation from the best evidence: a marked day, then LH, then temperature', () => {
    const t = temps('2026-09-04', [36.3, 36.4, 36.3, 36.35, 36.4, 36.3, 36.3, 36.3, 36.5, 36.55, 36.65, 36.6])
    expect(ovDay(t, '2026-09-01', '2026-10-01')).toMatchObject({ date: '2026-09-11', by: 'temp' })
    const lh = { ...t, '2026-09-08': { ...t['2026-09-08'], lh: 'pos' } }
    expect(ovDay(lh, '2026-09-01', '2026-10-01')).toEqual({ date: '2026-09-09', by: 'lh' })
    expect(ovDay({ ...lh, '2026-09-10': { ov: 1 } }, '2026-09-01', '2026-10-01')).toEqual({ date: '2026-09-10', by: 'logged' })
    expect(ovDay(days, '2026-09-01', '2026-10-01')).toBe(null)
  })
  it('lets a positive LH test pin the next period and show as ovulation on the calendar', () => {
    const d = { ...days, '2026-09-11': { lh: 'pos' } }
    expect(forecast(d)[0]).toMatchObject({ ovulation: '2026-09-12', ovLogged: true, ovBy: 'lh', start: '2026-09-25' })
    expect(kindOn(d, '2026-09-12')).toBe('ovulation')
    // in a past cycle too, and it teaches the luteal length
    const past = { ...days, '2026-07-15': { lh: 'pos' } }   // ovulation 07-16, next period 07-29: 13 days
    expect(kindOn(past, '2026-07-16')).toBe('ovulation')
    expect(stats(past).lutealN).toBe(1)
  })
  it('says what usually comes before and during a period, from windows where something was logged', () => {
    const d = { ...days }
    for (const p of ['2026-07-29', '2026-08-26']) {
      d[addDays(p, -2)] = { sym: ['bloating', 'tender'] }
      d[addDays(p, -1)] = { sym: ['cravings'] }
      d[addDays(p, 0)] = { flow: 2, sym: ['cramps'] }
    }
    d['2026-07-01'] = { flow: 2, sym: ['cramps', 'headache'] }
    const before = upcoming(d, '2026-09-19')
    expect(before).toMatchObject({ when: 'before', toNext: 4 })
    expect(before.list.map(x => x.id).sort()).toEqual(['bloating', 'cravings', 'tender'])
    expect(before.list[0]).toMatchObject({ n: 2, of: 2 })
    const during = upcoming({ ...d, '2026-09-23': { flow: 2 }, '2026-09-24': { flow: 2 } }, '2026-09-24')
    expect(during.when).toBe('during')
    expect(during.list.map(x => x.id)).toEqual(['cramps'])
    expect(upcoming(d, '2026-09-05')).toBe(null)   // mid-cycle
    expect(upcoming(days, '2026-09-19')).toBe(null)   // nothing logged
  })
  it('flags short, long and varying cycles, long periods and a late or missing period, and stays quiet otherwise', () => {
    const lens = (ls, start = '2026-01-01') => { const out = [start]; for (const l of ls) out.push(addDays(out.at(-1), l)); return flowDays(out) }
    expect(cycleSignals(days, '2026-09-10')).toEqual([])
    expect(cycleSignals(lens([19, 20, 28, 28]), '2026-04-10').map(x => x.id)).toContain('short')
    expect(cycleSignals(lens([40, 38, 28]), '2026-05-01').map(x => x.id)).toContain('long')
    expect(cycleSignals(lens([24, 36, 27, 30]), '2026-04-10').map(x => x.id)).toContain('vary')
    const longP = { ...days, ...Object.fromEntries([5, 6, 7, 8].map(i => [addDays('2026-08-26', i), { flow: 1 }])) }
    expect(cycleSignals(longP, '2026-09-10').map(x => x.id)).toEqual(['longPeriod'])
    expect(cycleSignals(days, '2026-10-01').map(x => x.id)).toEqual(['late'])
    expect(cycleSignals(days, '2026-12-01').map(x => x.id)).toEqual(['gap'])
  })
})
