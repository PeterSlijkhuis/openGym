// The personalising questions before the first tour (components/Onboarding.jsx). Every answer is
// an ordinary setting that already lives in Settings, so nothing here is new state: these only
// decide what to write, and the component writes it the moment a screen is confirmed.
import { setModule } from './modules.js'
import { logWeighIn } from './bodyweight.js'
import { newProfile } from './equipment.js'

/** Sex, the figures, year of birth, height (cm) and today's weight. Unanswered fields stay as they were. */
export function applyYou(s, { sex, figure, born, cm, weight, cycle } = {}) {
  if (sex === 'female' || sex === 'male') s.sex = sex
  if (figure === 'female' || figure === 'male') { s.body = figure; s.exFigure = figure }
  const year = new Date().getFullYear()
  if (born >= 1900 && born <= year - 10) s.birthYear = Math.round(born)
  if (cm >= 100 && cm <= 250) s.foodPlan = { ...(s.foodPlan || {}), heightCm: Math.round(cm) }
  if (weight > 0) logWeighIn(s, weight)
  if (cycle) setModule(s, 'cycle', true)
}

/** Lose, keep or gain (`rate` in the profile's unit a week, already in kg), activity, and the food diary. */
export function applyGoal(s, { rate, activity, food } = {}) {
  if (Number.isFinite(rate) || activity) {
    const p = { ...(s.foodPlan || {}) }
    if (Number.isFinite(rate)) p.rate = rate
    if (activity) p.activity = activity
    s.foodPlan = p
  }
  if (food) setModule(s, 'food', true)
}

// What each equipment answer can use. A full gym fits nothing (the plan as written).
export const KIT = { gym: null, dumbbells: ['dumbbell', 'bench', 'body weight'], bodyweight: ['body weight'] }

/** The equipment profile for a home answer: reused by name, else added, and made the active filter. */
export function kitProfile(s, kit, name) {
  const eq = KIT[kit]
  if (!eq) return null
  s.equipProfiles = s.equipProfiles || []
  let p = s.equipProfiles.find(x => x.name === name)
  if (!p) { p = { ...newProfile(name), equipment: eq }; s.equipProfiles.push(p) }
  s.activeEquipId = p.id
  s.equipFilterOn = true
  return p
}

/** The starter plan (lib/starter.js) for so many days a week and this much experience. */
export function planFor(days, level, kit) {
  if (days >= 6 && level === 'experienced') return 'ppl'
  if (days >= 4) return 'upper-lower'
  if (level === 'experienced') return 'ppl'
  if (level === 'some' && kit === 'gym') return '5x5'
  return 'full-body'
}
