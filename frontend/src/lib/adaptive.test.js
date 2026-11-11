// The adaptive day (lib/adaptive.js): today's signs, the level, the lighter session and what it learns.
import { describe, it, expect } from 'vitest'
import { signals, verdict, planFor, learn, logDay } from './adaptive.js'
import { applyAdapt } from './coach-adapt.js'
import { addDays } from './cycle.js'

const TODAY = '2026-11-11'
const BENCH = '0025', CURL = '0294', SQUAT = '0043'
const week = (extra = {}, today = {}) => ({
  connected: true,
  days: [
    ...Array.from({ length: 7 }, (_, i) => ({ date: addDays(TODAY, i - 7), restHr: 52, sleepScore: 75, ...extra })),
    { date: TODAY, restHr: 52, ...today },
  ],
})
const row = (w, r, done = false) => ({ w, r, done })
const session = () => ({
  unit: 'kg', exWeights: {}, workouts: [], week: {}, dayPlan: {},
  routines: [{ id: 'push', name: 'Push', ex: [{ id: BENCH, sets: 3, reps: 5, weight: 80 }, { id: CURL, sets: 2, reps: 10, weight: 14 }] }],
  active: {
    id: 'act-1', d: TODAY, cur: 0, entries: [
      { id: BENCH, rid: 'push', target: { sets: 3, reps: 5, weight: 80 }, sets: [row(80, 5), row(80, 5), row(80, 5)] },
      { id: CURL, rid: 'push', target: { sets: 2, reps: 10, weight: 14 }, sets: [row(14, 10), row(14, 10)] },
    ],
  },
})

describe('today’s signs', () => {
  it('bad sleep and a drained body battery make an easy day, a good night a push', () => {
    const bad = verdict(signals(week({}, { sleepScore: 55, bbMax: 45 }), TODAY))
    expect(bad.level).toBe('easy')
    expect(bad.signs.map(s => s.id)).toEqual(['sleep', 'bb'])
    expect(verdict(signals(week({}, { sleepScore: 85, bbMax: 80 }), TODAY)).level).toBe('push')
    expect(verdict(signals(week({}, { sleepScore: 70 }), TODAY)).level).toBe('normal')
  })

  it('counts a raised resting heart rate and yesterday’s stress', () => {
    const g = week({}, { restHr: 58 })
    g.days[6].stress = 62
    const v = verdict(signals(g, TODAY))
    expect(v.signs.find(s => s.id === 'rhr').pts).toBe(-2)
    expect(v.signs.find(s => s.id === 'stress').pts).toBe(-2)
    expect(v.level).toBe('rest')
  })

  it('uses only the cycle log it is given: symptoms logged today, or the first days of a period', () => {
    const days = { [addDays(TODAY, -1)]: { flow: 2 }, [TODAY]: { flow: 2 } }
    expect(signals(null, TODAY, { cycleDays: days }).list).toEqual([{ id: 'cycle', pts: -1, text: 'Day 2 of your period' }])
    const sym = { ...days, [TODAY]: { flow: 2, sym: ['cramps', 'fatigue', 'acne'] } }
    expect(signals(null, TODAY, { cycleDays: sym }).list[0]).toMatchObject({ pts: -2, text: 'You logged cramps, tired today' })
    expect(signals(null, TODAY).list).toEqual([])
  })

  it('learning scales only the bad signs', () => {
    const sig = signals(week({}, { sleepScore: 55, bbMax: 45 }), TODAY)
    expect(verdict(sig, 0.5).level).toBe('light')
    expect(verdict(sig, 1.5).level).toBe('easy')
  })
})

describe('the lighter session', () => {
  it('an easy day cuts the weight 10% and one set where there are three, through the Coach’s own changes', () => {
    const S = session()
    const plan = planFor(S.active, verdict(signals(week({}, { sleepScore: 55, bbMax: 45 }), TODAY)))
    expect(plan.changes.map(c => [c.type, c.exId, c.pct ?? c.sets])).toEqual([['weight', BENCH, -10], ['sets', BENCH, 2], ['weight', CURL, -10]])
    applyAdapt(S, plan, plan.changes.map(c => c.id))
    expect(S.active.entries[0].sets.map(s => s.w)).toEqual([70, 70]) // 72 rounded down to the gym's step
    expect(S.active.entries[1].sets).toHaveLength(2)
    expect(S.routines[0].ex[0].weight).toBe(80)
  })

  it('a normal or push day changes nothing, and logged sets are left alone', () => {
    const S = session()
    expect(planFor(S.active, { level: 'normal', signs: [] })).toBeNull()
    expect(planFor(S.active, { level: 'push', signs: [] })).toBeNull()
    S.active.entries[0].sets[0].done = true
    const plan = planFor(S.active, { level: 'rest', signs: [], sick: true })
    expect(plan.changes.find(c => c.exId === BENCH && c.type === 'sets')).toMatchObject({ sets: 1, before: 2 })
  })
})

describe('learning', () => {
  it('starts neutral and turns down after lightened sessions that felt easy and undos', () => {
    expect(learn({ workouts: [] }, null, { today: TODAY }).k).toBe(1)
    const easyDay = addDays(TODAY, -3)
    const S = { workouts: [{ d: easyDay, entries: [{ id: BENCH, sets: [{ w: 70, r: 5, done: true, rir: 4 }, { w: 70, r: 5, done: true, rir: 4 }] }] }] }
    const r = learn(S, null, { today: TODAY, log: [{ d: easyDay, lv: 'easy' }, { d: addDays(TODAY, -5), lv: 'easy', u: 1 }] })
    expect(r.k).toBe(0.8)
    expect(r.notes).toHaveLength(2)
  })

  it('turns down when you lift as well on rough mornings as on good ones', () => {
    const days = [], workouts = []
    for (let i = 0; i < 8; i++) {
      const d = addDays(TODAY, -60 + i * 7)
      days.push({ date: d, sleepScore: i % 2 ? 50 : 85, bbMax: i % 2 ? 40 : 80 })
      workouts.push({ d, entries: [{ id: BENCH, sets: [{ w: 80 + i, r: 5, done: true }] }] })
    }
    // one before, so every one of the eight has a previous to compare with
    workouts.unshift({ d: addDays(TODAY, -70), entries: [{ id: BENCH, sets: [{ w: 79, r: 5, done: true }] }] })
    const r = learn({ workouts }, { days }, { today: TODAY })
    expect(r.k).toBe(0.75)
  })

  it('logDay keeps one entry a day, the newest 40', () => {
    let log = []
    for (let i = 0; i < 45; i++) log = logDay(log, addDays(TODAY, -i), 'easy')
    log = logDay(log, TODAY, 'easy', true)
    expect(log).toHaveLength(40)
    expect(log.filter(x => x.d === TODAY)).toEqual([{ d: TODAY, lv: 'easy', u: 1 }])
  })
})
