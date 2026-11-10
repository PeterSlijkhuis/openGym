import { describe, it, expect } from 'vitest'
import { applyYou, applyGoal, kitProfile, planFor } from './onboarding.js'

const fresh = () => ({ unit: 'kg', bodyweight: [], modules: {}, equipProfiles: [] })

describe('onboarding', () => {
  it('writes only what was answered', () => {
    const s = fresh()
    applyYou(s, {})
    applyGoal(s, {})
    expect(s).toEqual(fresh())
  })

  it('female sets the figures and leaves cycle tracking off unless asked', () => {
    const s = fresh()
    applyYou(s, { sex: 'female', figure: 'female', born: 1990, cm: 168, weight: 61.5 })
    expect(s).toMatchObject({ sex: 'female', body: 'female', exFigure: 'female', birthYear: 1990, foodPlan: { heightCm: 168 } })
    expect(s.bodyweight.at(-1).w).toBe(61.5)
    expect(s.modules.cycle).toBeUndefined()
    applyYou(s, { cycle: true })
    expect(s.modules.cycle).toBe(true)
  })

  it('keeps the figure choice apart from sex', () => {
    const s = fresh()
    applyYou(s, { sex: 'female', figure: 'male' })
    expect(s).toMatchObject({ sex: 'female', body: 'male', exFigure: 'male' })
  })

  it('ignores nonsense numbers', () => {
    const s = fresh()
    applyYou(s, { born: 3000, cm: 20, weight: 0 })
    expect(s).toEqual(fresh())
  })

  it('merges the goal into the food plan', () => {
    const s = fresh()
    applyYou(s, { cm: 180 })
    applyGoal(s, { rate: -0.5, activity: 'moderate', food: true })
    expect(s.foodPlan).toEqual({ heightCm: 180, rate: -0.5, activity: 'moderate' })
    expect(s.modules.food).toBe(true)
  })

  it('reuses a home equipment profile and makes it the filter', () => {
    const s = fresh()
    expect(kitProfile(s, 'gym', 'Gym')).toBe(null)
    const a = kitProfile(s, 'dumbbells', 'Home')
    const b = kitProfile(s, 'dumbbells', 'Home')
    expect(a.id).toBe(b.id)
    expect(s.equipProfiles).toHaveLength(1)
    expect(s).toMatchObject({ activeEquipId: a.id, equipFilterOn: true })
  })

  it('picks a plan by days and experience', () => {
    expect(planFor(3, 'new', 'gym')).toBe('full-body')
    expect(planFor(3, 'some', 'gym')).toBe('5x5')
    expect(planFor(3, 'some', 'dumbbells')).toBe('full-body')
    expect(planFor(3, 'experienced', 'gym')).toBe('ppl')
    expect(planFor(4, 'new', 'gym')).toBe('upper-lower')
    expect(planFor(6, 'experienced', 'gym')).toBe('ppl')
  })
})
