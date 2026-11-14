import { describe, it, expect } from 'vitest'
import { addDays, diffDays, cleanDay, periods, stats, forecast, phaseOn, kindOn, monthGrid, symptomsByPhase, sharedView, ongoing } from './cycle.js'

// Periods starting 2026-07-01, 07-29, 08-26 (28 days), five flow days each.
const flowDays = starts => Object.fromEntries(starts.flatMap(s => [0, 1, 2, 3, 4].map(i => [addDays(s, i), { flow: 2 }])))
const days = flowDays(['2026-07-01', '2026-07-29', '2026-08-26'])

describe('cycle', () => {
  it('does date maths on calendar days', () => {
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01')
    expect(diffDays('2026-11-10', '2026-10-31')).toBe(10)
  })
  it('cleans a day and drops empty ones', () => {
    expect(cleanDay({ flow: 2, sym: ['tender', 'nope', 'tender'], mood: ['low'], note: ' hi ', junk: 1 })).toEqual({ flow: 2, sym: ['tender'], mood: ['low'], note: 'hi' })
    expect(cleanDay({ flow: 0, sym: [], note: '  ' })).toBe(null)
    expect(cleanDay('x')).toBe(null)
  })
  it('groups flow days into periods, tolerating a gap day', () => {
    expect(periods(days).map(p => [p.start, p.len])).toEqual([['2026-07-01', 5], ['2026-07-29', 5], ['2026-08-26', 5]])
    expect(periods({ '2026-07-01': { flow: 1 }, '2026-07-03': { flow: 1 } })).toHaveLength(1)
    expect(periods({ '2026-07-01': { flow: 1 }, '2026-07-09': { flow: 1 } })).toHaveLength(2)
  })
  it('averages cycles and ignores implausible ones', () => {
    expect(stats(days)).toMatchObject({ cycle: 28, period: 5, count: 3, min: 28, max: 28, spread: 0 })
    expect(stats({})).toMatchObject({ cycle: 28, period: 5, known: false })
    expect(stats(flowDays(['2026-07-01', '2026-07-05'])).cycle).toBe(28)
  })
  it('forecasts the next periods with ovulation 13 days before and a six-day fertile window', () => {
    const [n] = forecast(days)
    expect(n.start).toBe('2026-09-23')
    expect(n.to).toBe('2026-09-27')
    expect(n.ovulation).toBe('2026-09-10')
    expect(n.fertile).toEqual({ from: '2026-09-05', to: '2026-09-11' })
    expect(forecast({})).toEqual([])
    expect(forecast(days)).toHaveLength(6)
  })
  it('puts a range round each forecast that widens with the months ahead and with little history', () => {
    const f = forecast(days)
    expect(f[0]).toMatchObject({ half: 4, ovHalf: 5, startRange: { from: '2026-09-19', to: '2026-09-27' }, ovRange: { from: '2026-09-05', to: '2026-09-15' } })
    expect(f.map(x => x.half)).toEqual([...f.map(x => x.half)].sort((a, b) => a - b))
    expect(f[5].half).toBeGreaterThan(f[0].half)
    expect(f.every(x => x.ovHalf >= x.half)).toBe(true)
    const many = flowDays(Array.from({ length: 9 }, (_, i) => addDays('2026-01-01', i * 28)))
    expect(forecast(many)[0].half).toBeLessThan(f[0].half)
    expect(forecast(flowDays(['2026-08-26']))[0].half).toBeGreaterThan(f[0].half)
    expect(forecast(flowDays(['2026-08-26'])).every(x => x.half <= 10)).toBe(true)
  })
  it('weights recent cycles, drops outliers and says how sure it is', () => {
    const lens = (ls, start = '2026-01-01') => { const out = [start]; for (const l of ls) out.push(addDays(out.at(-1), l)); return flowDays(out) }
    // one 50-day cycle (an illness month) does not move a steady 28
    expect(stats(lens([28, 28, 28, 28, 28, 50, 28, 28])).mean).toBeCloseTo(28, 5)
    // recent cycles count more: 26s then 32s lands above the plain mean of 29, even pulled toward 28
    expect(stats(lens([26, 26, 26, 32, 32, 32])).mean).toBeGreaterThan(29.1)
    expect(stats(lens([28, 29, 27, 28, 30, 28, 29]))).toMatchObject({ confidence: 'good', irregular: false })
    expect(stats(lens([28, 28])).confidence).toBe('low')
    expect(stats(lens([24, 35, 29, 41, 26, 33]))).toMatchObject({ confidence: 'low', irregular: true })
    expect(stats({}).sd).toBeCloseTo(3.5, 5)
  })
  it('learns the luteal length from logged ovulation days', () => {
    const d = { ...days, '2026-07-18': { ov: 1 }, '2026-08-15': { ov: 1 } }   // 11 days before the next period each time
    expect(stats(d)).toMatchObject({ lutealN: 2, luteal: 12 })
    expect(forecast(d)[0].ovulation).toBe('2026-09-11')
    expect(forecast(d)[0].ovHalf).toBeLessThanOrEqual(forecast(days)[0].ovHalf)
    expect(stats(days).luteal).toBe(13)
  })
  it('moves a period that is late to tomorrow on, and the later ones with it', () => {
    expect(forecast(days, '2026-09-26')[0].start).toBe('2026-09-27')
    expect(forecast(days, '2026-09-26')[1].start).toBe('2026-10-25')
    expect(forecast(days, '2026-09-26')[0].startRange.from).toBe('2026-09-26')
    expect(forecast(days, '2026-09-10')[0].start).toBe('2026-09-23')
  })
  it('names the phase of a day', () => {
    expect(phaseOn(days, '2026-08-27')).toMatchObject({ phase: 'menstrual', day: 2 })
    expect(phaseOn(days, '2026-08-31')).toMatchObject({ phase: 'follicular', fertile: false })
    expect(phaseOn(days, '2026-09-05')).toMatchObject({ phase: 'follicular', fertile: true })
    expect(phaseOn(days, '2026-09-09')).toMatchObject({ phase: 'ovulation', fertile: true })
    expect(phaseOn(days, '2026-09-15')).toMatchObject({ phase: 'luteal' })
    expect(phaseOn(days, '2026-09-25')).toMatchObject({ phase: 'luteal', late: 3 })
    expect(phaseOn(days, '2026-06-01')).toBe(null)
  })
  it('colours calendar cells', () => {
    expect(kindOn(days, '2026-08-26')).toBe('period')
    expect(kindOn(days, '2026-09-24')).toBe('period-est')
    expect(kindOn(days, '2026-09-20')).toBe('period-range')
    expect(kindOn(days, '2026-09-10')).toBe('ovulation-est')
    expect(kindOn(days, '2026-09-06')).toBe('ovulation-range')
    expect(kindOn(days, '2026-09-17')).toBe(null)
    // looking back: 14 days before the next logged period
    expect(kindOn(days, '2026-07-16')).toBe('ovulation-est')
    expect(kindOn(days, '2026-07-12')).toBe('fertile-est')
  })
  it('lets a logged ovulation move the estimates', () => {
    const d = { ...days, '2026-09-13': { ov: 1 } }
    expect(cleanDay({ ov: true })).toEqual({ ov: 1 })
    expect(kindOn(d, '2026-09-13')).toBe('ovulation')
    expect(kindOn(d, '2026-09-09')).toBe('fertile-est')
    expect(forecast(d)[0].start).toBe('2026-09-26')
    expect(forecast(d)[0].ovRange).toBe(null)
    expect(forecast(d)[0].half).toBeLessThan(forecast(days)[0].half)
    expect(forecast(d)[1].start).toBe('2026-10-24')
    expect(phaseOn(d, '2026-09-13')).toMatchObject({ phase: 'ovulation' })
    expect(phaseOn(d, '2026-09-25')).toMatchObject({ phase: 'luteal', late: 0 })
    // a past cycle with a logged ovulation shows no estimate
    const p = { ...days, '2026-07-17': { ov: 1 } }
    expect(kindOn(p, '2026-07-17')).toBe('ovulation')
    expect(kindOn(p, '2026-07-16')).toBe(null)
  })
  it('lays a month out in weeks', () => {
    const g = monthGrid(2026, 10, 1) // November 2026 starts on a Sunday
    expect(g[0].indexOf('2026-11-01')).toBe(6)
    expect(g.every(w => w.length === 7)).toBe(true)
    expect(g.flat().filter(Boolean)).toHaveLength(30)
  })
  it('counts the symptoms of each phase', () => {
    const d = { ...days, '2026-09-15': { sym: ['tender', 'bloating'] }, '2026-09-16': { sym: ['tender'] }, '2026-08-27': { sym: ['cramps'] } }
    const by = symptomsByPhase(d)
    expect(by.luteal[0]).toEqual(['tender', 2])
    expect(by.menstrual).toEqual([['cramps', 1]])
  })
  it('shares only what the level allows', () => {
    expect(sharedView(days, '2026-09-15', 'phase')).toEqual({ phase: 'luteal', day: 21 })
    expect(sharedView(days, '2026-09-15', 'period')).toEqual({ phase: 'luteal', day: 21, cycle: 28, period: 5, next: { from: '2026-09-19', to: '2026-09-27' } })
    const d = { ...days, '2026-09-15': { flow: 0, sym: ['tender'], mood: ['low'], note: 'private', ov: 1 } }
    expect(sharedView(d, '2026-09-15', 'care').today).toEqual({ sym: ['tender'], mood: ['low'] })
    expect(sharedView(d, '2026-09-15', 'period').today).toBe(undefined)
    expect(sharedView(days, '2026-09-15', 'everything')).toEqual({})
    expect(sharedView({}, '2026-09-15', 'phase')).toEqual({})
  })

  describe('a period that keeps going', () => {
    const one = start => ({ [start]: { flow: 2 } })
    it('runs on from the first day to today, within your usual length, and says it is open', () => {
      const r = ongoing(one('2026-09-01'), '2026-09-03')
      expect(Object.keys(r.days)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
      expect(r.days['2026-09-02']).toEqual({ flow: 2, auto: 1 })
      expect(r.open).toEqual({ start: '2026-09-01', day: 3, L: 5, endsOn: '2026-09-05' })
      expect(phaseOn(r.days, '2026-09-03')).toMatchObject({ phase: 'menstrual', day: 3 })
    })
    it('stops by itself after the usual length and keeps those days', () => {
      const r = ongoing(one('2026-09-01'), '2026-09-09')
      expect(Object.keys(r.days).pop()).toBe('2026-09-05')
      expect(r.open).toBe(null)
    })
    it('stops where you say it ended, also looking back, and ignores a later date', () => {
      const d = { '2026-09-01': { flow: 2 }, '2026-09-03': { end: 1 } }
      const r = ongoing(d, '2026-09-04')
      expect(Object.keys(r.days).sort()).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
      expect(r.open).toBe(null)
      expect(ongoing(d, '2026-09-02').days['2026-09-03']).toEqual({ end: 1 })
    })
    it('takes your usual length from the periods you closed or logged on 3 or more days', () => {
      const past = { ...flowDays(['2026-06-01']), '2026-06-04': { flow: 2, end: 1 }, '2026-06-05': undefined }
      delete past['2026-06-05']; delete past['2026-06-02']; delete past['2026-06-03']   // closed on day 4
      expect(ongoing({ ...past, '2026-07-01': { flow: 2 } }, '2026-07-02').open.L).toBe(4)
      expect(ongoing(one('2026-07-01'), '2026-07-02').open.L).toBe(5)
    })
    it('stretches an older period logged on 1 or 2 days to the usual length, never into the next one, but not a complete one', () => {
      const d = { ...one('2026-08-01'), ...flowDays(['2026-08-29']), '2026-09-26': { flow: 2 }, '2026-09-27': { flow: 2 } }
      const r = ongoing(d, '2026-10-20')
      expect(Object.keys(r.days).filter(x => x < '2026-08-29')).toEqual(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05'])
      expect(Object.keys(r.days).filter(x => x >= '2026-08-29' && x < '2026-09-26')).toHaveLength(5)
      expect(r.days['2026-09-28']).toEqual({ flow: 2, auto: 1 })   // the latest, logged twice, runs to the usual 5 days
      expect(periods(r.days).map(p => p.len)).toEqual([5, 5, 5])
    })
    it('leaves cycle lengths alone and returns the same object when nothing is added', () => {
      expect(stats(ongoing(days, '2026-09-10').days)).toMatchObject({ cycle: 28, period: 5 })
      expect(ongoing(days, '2026-09-10').days).toBe(days)
      expect(ongoing({}, '2026-09-10')).toEqual({ days: {}, open: null })
    })
    it('shares the phase from the filled days but only the flow that was logged', () => {
      const d = { '2026-09-01': { flow: 3 } }
      expect(sharedView(d, '2026-09-03', 'care')).toMatchObject({ phase: 'menstrual', day: 3, today: {} })
      expect(cleanDay({ end: true })).toEqual({ end: 1 })
    })
  })
})
