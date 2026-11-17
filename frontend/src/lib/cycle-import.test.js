import { describe, it, expect } from 'vitest'
import { parseFlo, planImport, mergeDay, cycleCSV } from './cycle-import.js'
import { SYMPTOMS, MOODS, FLOW } from './cycle.js'
import { csvField } from './export-csv.js'

const flo = cycles => JSON.stringify({ operationalData: { cycles }, other: { x: 1 } })

describe('flo import', () => {
  it('turns the period dates of each cycle into flow days, using the date part only', () => {
    const r = parseFlo(flo([
      { period_start_date: '2026-08-01', period_end_date: '2026-08-04' },
      { period_start_date: '2026-09-01T23:30:00.000Z', period_end_date: '2026-09-02T00:10:00+02:00' },
    ]), '2026-09-15')
    expect(r).toMatchObject({ periods: 2, skipped: 0, from: '2026-08-01', to: '2026-09-02' })
    expect(Object.keys(r.days)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-09-01', '2026-09-02'])
    expect(r.days['2026-08-02']).toEqual({ flow: 2 })
    expect(r.days['2026-08-04']).toEqual({ flow: 2, end: 1 })   // Flo knows when it ended
  })
  it('skips forecasts, broken and absurdly long periods, and counts them', () => {
    const r = parseFlo(flo([
      { period_start_date: '2026-09-20', period_end_date: '2026-09-24' },   // after today
      { period_start_date: 'soon', period_end_date: '2026-09-02' },
      { period_start_date: '2026-03-01', period_end_date: '2026-04-20' },   // 51 days
      { period_start_date: '2026-09-10', period_end_date: '2026-09-08' },   // ends before it starts
      { period_start_date: '2026-07-01' },                                  // no end: one day
      null,
    ]), '2026-09-15')
    expect(r).toMatchObject({ periods: 1, skipped: 5 })
    expect(Object.keys(r.days)).toEqual(['2026-07-01'])
  })
  it('stops a running period at today', () => {
    expect(Object.keys(parseFlo(flo([{ period_start_date: '2026-09-14', period_end_date: '2026-09-18' }]), '2026-09-15').days)).toEqual(['2026-09-14', '2026-09-15'])
    expect(parseFlo(flo([{ period_start_date: '2026-09-14', period_end_date: '2026-09-18' }]), '2026-09-15').days['2026-09-15']).toEqual({ flow: 2 })   // not over yet
  })
  it('explains what it cannot read', () => {
    expect(parseFlo('Cycle 1: 2026-08-01', '2026-09-15').error).toMatch(/JSON/)
    expect(parseFlo('{"a":1}', '2026-09-15').error).toMatch(/Flo/)
    expect(parseFlo(flo([]), '2026-09-15').error).toMatch(/No period/)
    expect(parseFlo('null', '2026-09-15').error).toMatch(/Flo/)
  })
  it('counts what is new and what stays as logged', () => {
    expect(planImport({ '2026-08-01': { flow: 3 }, '2026-08-02': { sym: ['cramps'] } }, { '2026-08-01': { flow: 2 }, '2026-08-02': { flow: 2 }, '2026-08-03': { flow: 2 } })).toEqual({ added: 2, kept: 1 })
  })
  it('reads flow strength by day offset, and the symptoms and moods Flo logged', () => {
    const text = JSON.stringify({
      operationalData: { cycles: [{ period_start_date: '2026-08-01 12:00:00.0', period_end_date: '2026-08-04 12:00:00.0', period_intensity: '{"0": 1, "1": 3, "2": 4, "3": -1}' }] },
      pointEventsManualData: { point_events_manual_v2: [
        { local_date: '2026-08-01 00:00:00', category: 'Symptom', subcategory: 'DrawingPain' },
        { local_date: '2026-08-01 09:00:00', category: 'Symptom', subcategory: 'AbdominalPain' },   // also cramps: once
        { local_date: '2026-08-01 00:00:00', category: 'Mood', subcategory: 'Swings' },
        { local_date: '2026-08-14 00:00:00', category: 'Fluid', subcategory: 'Eggwhite' },
        { local_date: '2026-08-14 00:00:00', category: 'Mood', subcategory: 'LowEnergy' },        // a symptom here
        { local_date: '2026-08-15 00:00:00', category: 'Sleep', subcategory: 'Sleep' },           // not ours
        { local_date: '2026-08-16 00:00:00', category: 'Weight', subcategory: 'Weight', properties: { value: 60 } },
        { local_date: '2026-09-30 00:00:00', category: 'Mood', subcategory: 'Happy' },            // after today
      ] },
      sessionsData: { user: { id: 'x' } },
    })
    const r = parseFlo(text, '2026-09-15')
    expect(r).toMatchObject({ periods: 1, logged: 2, from: '2026-08-01', to: '2026-08-14' })
    expect(r.days).toEqual({
      '2026-08-01': { flow: 1, sym: ['cramps'], mood: ['sensitive'] },
      '2026-08-02': { flow: 3 }, '2026-08-03': { flow: 3 }, '2026-08-04': { flow: 2, end: 1 },
      '2026-08-14': { sym: ['clear', 'fatigue'] },
    })
  })
  it('merges an import over the log: own flow stays, lists join, and twice is the same as once', () => {
    const have = { flow: 3, sym: ['cramps'], note: 'mine' }, inc = { flow: 1, end: 1, sym: ['cramps', 'backache'], mood: ['low'] }
    const once = mergeDay(have, inc)
    expect(once).toEqual({ flow: 3, sym: ['cramps', 'backache'], mood: ['low'], note: 'mine' })
    expect(mergeDay(once, inc)).toEqual(once)
    expect(mergeDay(undefined, { flow: 1, end: 1 })).toEqual({ flow: 1, end: 1 })
    expect(planImport({ '2026-08-01': once }, { '2026-08-01': inc, '2026-08-02': { mood: ['low'] } })).toEqual({ added: 1, kept: 1 })
  })
  it('exports your own log as CSV with readable values, quoting what needs it', () => {
    const csv = cycleCSV({ '2026-09-02': { flow: 3, sym: ['cramps', 'tender'], note: 'long day, "rough"' }, '2026-09-01': { flow: 2 }, '2026-09-14': { lh: 'pos', temp: 36.42, ov: 1, mood: ['low'] } }, { SYMPTOMS, MOODS, FLOW }, csvField)
    const lines = csv.trim().split('\r\n')
    expect(lines[0]).toBe('Date,Flow,Period ended,Ovulation,LH test,Temperature (°C),Symptoms,Moods,Note')
    expect(lines[1]).toBe('2026-09-01,Medium,,,,,,,')
    expect(lines[2]).toBe('2026-09-02,Heavy,,,,,Cramps; Tender breasts,,"long day, ""rough"""')
    expect(lines[3]).toBe('2026-09-14,,,yes,positive,36.42,,Low,')
  })
})
