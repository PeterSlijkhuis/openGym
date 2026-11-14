import { describe, it, expect } from 'vitest'
import { addDays, phaseOn, stats, periods } from './cycle.js'
import { ownDayInfo, partnerDayInfo, partnerKind } from './cycle-day.js'

const flowDays = starts => Object.fromEntries(starts.flatMap(s => [0, 1, 2, 3, 4].map(i => [addDays(s, i), { flow: 2 }])))
const days = flowDays(['2026-07-01', '2026-07-29', '2026-08-26'])
const today = '2026-09-15'

describe('cycle day info', () => {
  it('describes a logged day with the foods for what was logged and what a partner could do', () => {
    const d = { ...days, [today]: { sym: ['tender', 'cravings'], mood: ['low'] } }
    const i = ownDayInfo(d, today, today)
    expect(i).toMatchObject({ phase: 'luteal', projected: false })
    expect(i.foods.logged).toBe(true)
    expect(i.foods.symptoms.map(x => x.id)).toEqual(['tender', 'cravings'])
    expect(i.tips.map(x => x.label)).toEqual(['Tender breasts', 'Cravings', 'Low'])
    expect(i.ideas.length).toBeGreaterThan(1)
  })
  it('gives a day months ahead its phase and the range it sits in, with typical foods', () => {
    const i = ownDayInfo(days, '2026-12-10', today)
    expect(i.projected).toBe(true)
    expect(['menstrual', 'follicular', 'ovulation', 'luteal']).toContain(i.phase)
    expect(i.foods.logged).toBe(false)
    expect(ownDayInfo(days, '2026-09-24', today)).toMatchObject({ kind: 'period-est', phase: 'menstrual', f: { k: 0 } })
    // the phase of a far day follows the forecast periods: the day before an expected period is luteal
    expect(ownDayInfo(days, '2026-10-20', today).phase).toBe('luteal')
    expect(phaseOn(days, '2026-10-20')).toMatchObject({ late: expect.any(Number) })
    expect(ownDayInfo({}, today, today).phase).toBe(null)
    expect(stats(days).n).toBe(2)
    expect(periods(days)).toHaveLength(3)
  })
  it('shows a partner only what is shared: no fertile window, tips only for what is logged today', () => {
    const p = { phase: 'luteal', day: 20, cycle: 28, period: 5, next: { from: '2026-09-19', to: '2026-09-27' }, today: { sym: ['tender'] } }
    expect(partnerKind(p, today, '2026-09-23')).toBe('period-est')
    expect(partnerKind(p, today, '2026-09-20')).toBe('period-range')
    expect(partnerKind(p, today, '2026-09-30')).toBe(null)
    const t = partnerDayInfo(p, today, today)
    expect(t.tips.map(x => x.label)).toEqual(['Tender breasts'])
    expect(t.foods.symptoms.map(x => x.id)).toEqual(['tender'])
    // a mid-cycle day weeks away is never "ovulation" for a partner
    for (let n = 0; n < 60; n++) expect(partnerDayInfo(p, addDays(today, n), today).phase).not.toBe('ovulation')
    expect(partnerDayInfo(p, addDays(today, 1), today).tips).toEqual([])
    expect(partnerDayInfo({ phase: 'menstrual', day: 2, cycle: 28, period: 5 }, addDays(today, 20), today).phase).toBe('luteal')
  })
})
