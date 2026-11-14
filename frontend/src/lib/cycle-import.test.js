import { describe, it, expect } from 'vitest'
import { parseFlo, planImport } from './cycle-import.js'

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
})
