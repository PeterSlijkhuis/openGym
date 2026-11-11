// The adaptive day (ours, outside upstream's code): how ready you are today, from what the watch
// measured, your own cycle log and how your training has been going, and what that does to the
// workout you start. Deterministic rules only; the changes go through the same path as "Ask the
// Coach" mid-workout (lib/coach-adapt.js applyAdapt), so a logged set and the routine are never
// touched and the numbers round to the gym's plates.
//
// It learns per person: `learn` looks back at how you actually lifted on rough days and how hard
// the lightened sessions felt, and turns down (or up) how much the bad signs count.
import { dayOf, meanBefore, sickSigns } from './garmin-core.js'
import { trainingLoad } from './garmin-insights.js'
import { phaseOn, addDays } from './cycle.js'
import { bestSetOf, formulaOf } from './onerm.js'
import { avgRir } from './effort.js'
import { isWarmupRow, hasCompletedWork } from './workout-model.js'
import { isAssisted } from './exercises.js'

/* Today's own cycle log answers that weigh on training (ids from lib/cycle.js SYMPTOMS). */
const HEAVY_SYMPTOMS = { cramps: 'cramps', fatigue: 'tired', weak: 'heavy legs', nausea: 'nausea', headache: 'headache', insomnia: 'poor sleep' }

/**
 * Today's signs, each { id, pts, text }: negative counts against training hard, positive for.
 * `cycleDays` is this account's OWN cycle log (never a partner's shared view), or null.
 * ponytail: fixed thresholds from the usual wearable rules of thumb; tune them here.
 */
export function signals(g, iso, { cycleDays = null, workouts = [] } = {}) {
  const list = [], add = (id, pts, text) => list.push({ id, pts, text })
  const d = dayOf(g, iso)
  if (d) {
    const s = d.sleepScore
    if (s != null) { if (s < 50) add('sleep', -2, `Sleep score ${s}`); else if (s < 65) add('sleep', -1, `Sleep score ${s}`); else if (s >= 80) add('sleep', 1, `Sleep score ${s}`) }
    else if (d.sleepSec != null) {
      const h = d.sleepSec / 3600, txt = `Slept ${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`
      if (h < 5) add('sleep', -2, txt); else if (h < 6) add('sleep', -1, txt); else if (h >= 7.5) add('sleep', 1, txt)
    }
    if (d.bbMax != null) { if (d.bbMax < 30) add('bb', -2, `Body battery only reached ${d.bbMax}`); else if (d.bbMax < 50) add('bb', -1, `Body battery only reached ${d.bbMax}`); else if (d.bbMax >= 75) add('bb', 1, `Body battery up to ${d.bbMax}`) }
    const hrv = String(d.hrvStatus || '').toUpperCase()
    if (hrv === 'LOW' || hrv === 'POOR') add('hrv', -2, `HRV ${hrv.toLowerCase()}`)
    else if (hrv === 'UNBALANCED') add('hrv', -1, 'HRV unbalanced')
    const usual = meanBefore(g, 'restHr', iso)
    if (d.restHr != null && usual != null) {
      if (d.restHr >= usual + 5) add('rhr', -2, `Resting heart rate ${d.restHr}, usually ${Math.round(usual)}`)
      else if (d.restHr >= usual + 3) add('rhr', -1, `Resting heart rate ${d.restHr}, usually ${Math.round(usual)}`)
    }
  }
  const y = dayOf(g, addDays(iso, -1))
  if (y?.stress != null && y.stress >= 50) add('stress', y.stress >= 60 ? -2 : -1, `Stress yesterday averaged ${y.stress}`)
  if (g?.acts?.length) {
    const tl = trainingLoad(g, workouts, iso, 1)
    if (tl.ratio != null && tl.chronic >= 100 && tl.ratio >= 1.5) add('load', -1, `This week's training load is ${tl.ratio}× your usual`)
  }
  let phase = null
  if (cycleDays) {
    const ph = phaseOn(cycleDays, iso), today = cycleDays[iso] || {}
    phase = ph?.phase || null
    const felt = (today.sym || []).filter(x => HEAVY_SYMPTOMS[x])
    if (felt.length) add('cycle', -Math.min(2, felt.length), `You logged ${felt.map(x => HEAVY_SYMPTOMS[x]).join(', ')} today`)
    else if (phase === 'menstrual' && (ph.day <= 2 || today.flow === 3)) add('cycle', -1, `Day ${ph.day} of your period`)
  }
  return { list, sick: d ? sickSigns(g, iso).sick : false, phase, hasData: !!d || list.length > 0 }
}

export const LEVEL = {
  rest: { title: 'Recovery day', line: 'Your body is asking for rest. Half the sets and 15% lighter, or swap it for a walk.' },
  easy: { title: 'Lighter today', line: 'Weights 10% lighter and one set fewer where there are three or more.' },
  light: { title: 'A little lighter', line: 'Weights 5% lighter, same sets.' },
  normal: { title: 'Train as planned', line: '' },
  push: { title: 'Ready to push', line: 'Everything looks good. A fine day to chase a PR.' },
}

/** The day's level from the signs; `k` (from learn) scales how much the bad signs count. */
export function verdict(sig, k = 1) {
  const neg = sig.list.filter(s => s.pts < 0).reduce((n, s) => n + s.pts, 0)
  const pos = sig.list.filter(s => s.pts > 0).reduce((n, s) => n + s.pts, 0)
  const score = Math.round((neg * k + pos) * 10) / 10
  const level = sig.sick || score <= -4 ? 'rest' : score <= -2 ? 'easy' : score <= -1 ? 'light' : score >= 2 ? 'push' : 'normal'
  return { level, score, sick: !!sig.sick, k, signs: sig.list, phase: sig.phase }
}

const CUT = { rest: { pct: -15, keep: 0.5 }, easy: { pct: -10, drop: 1 }, light: { pct: -5 } }
const openWork = e => (e?.sets || []).filter(s => !isWarmupRow(s) && !hasCompletedWork(s))
const loaded = s => s.w > 0 || s.sides?.L?.w > 0 || s.sides?.R?.w > 0

/**
 * The verdict as an adapt proposal for the session `active` (lib/coach-adapt.js shape), or null
 * when the day asks for nothing. Weight on assisted exercises is left alone: less assistance is harder.
 */
export function planFor(active, v) {
  const cut = CUT[v?.level]
  if (!cut || !active?.entries?.length) return null
  const why = v.signs.filter(s => s.pts < 0).map(s => s.text).join(', ') || (v.sick ? 'Signs you may be getting ill' : '')
  const changes = []
  active.entries.forEach((e, i) => {
    const open = openWork(e)
    if (!open.length) return
    if (open.some(loaded) && !isAssisted({ ...(e.target || {}), id: e.id })) changes.push({ type: 'weight', entry: i, exId: e.id, pct: cut.pct, why })
    const want = cut.keep ? Math.max(1, Math.ceil(open.length * cut.keep)) : cut.drop && open.length >= 3 ? open.length - cut.drop : open.length
    if (want < open.length) changes.push({ type: 'sets', entry: i, exId: e.id, sets: want, before: open.length, why })
  })
  if (!changes.length) return null
  return { id: 'ready-' + active.id, kind: 'adapt', activeId: active.id, summary: LEVEL[v.level].title + ': ' + why, changes: changes.map((c, n) => ({ id: 'r' + n, ...c })) }
}

/* ---------- learning ---------- */

const DAY_MS = 86400e3
const isoOf = ms => new Date(ms).toISOString().slice(0, 10)

/**
 * How much the bad signs should count for this person: k in [0.5, 1.5], 1 to start, with the
 * reasons in plain words. Three kinds of evidence over the last 90 days:
 *  - strength: estimated 1RM change on rough mornings (bad signs, not lightened) against good ones;
 *    no real drop means the watch over-warns for you, a clear drop means it under-warns.
 *  - effort: lightened sessions that still felt easy (RIR 3.5+) turn it down, ones that were a
 *    grind anyway (RIR 1 or less) turn it up.
 *  - overrides: each time you undid or declined the change.
 * `log` is [{ d, lv, u }] (u: undone/declined), kept with the Garmin prefs (PUT /api/garmin/prefs).
 * ponytail: plain nudges, not a fitted model; good enough at a few sessions a week.
 */
export function learn(S, g, { cycleDays = null, log = [], today = isoOf(Date.now()) } = {}) {
  let k = 1
  const notes = []
  const since = isoOf(Date.parse(today + 'T00:00:00Z') - 90 * DAY_MS)
  const adapted = new Map(log.filter(x => x.d >= since).map(x => [x.d, x]))
  const workouts = (S?.workouts || []).filter(w => w.d >= since && w.d < today)

  // Strength on rough vs good mornings (adapted days excluded: lighter weights would read as weaker).
  const f = formulaOf(S), prev = new Map(), rough = [], good = []
  for (const w of S?.workouts || []) {
    const pcts = []
    for (const e of w.entries || []) {
      const est = bestSetOf(e, f)?.est
      if (!est) continue
      const p = prev.get(e.id)
      if (p) pcts.push((est / p - 1) * 100)
      prev.set(e.id, est)
    }
    if (!pcts.length || w.d < since || w.d >= today || (adapted.has(w.d) && !adapted.get(w.d).u)) continue
    const neg = signals(g, w.d, { cycleDays }).list.reduce((n, s) => n + Math.min(0, s.pts), 0)
    const mean = pcts.reduce((a, b) => a + b, 0) / pcts.length
    if (neg <= -2) rough.push(mean); else if (neg === 0) good.push(mean)
  }
  if (rough.length >= 3 && good.length >= 3) {
    const avg = v => v.reduce((a, b) => a + b, 0) / v.length
    const gap = avg(rough) - avg(good)
    if (gap >= -0.5) { k -= 0.25; notes.push(`On ${rough.length} rough mornings you lifted as well as on good ones, so bad signs count for less.`) }
    else if (gap <= -2) { k += 0.25; notes.push(`On ${rough.length} rough mornings you lifted ${Math.abs(gap).toFixed(1)}% under your good days, so bad signs count for more.`) }
  }

  // How the lightened sessions felt, and the overrides.
  let easy = 0, grind = 0, undone = 0
  for (const x of adapted.values()) {
    if (x.u) { undone++; continue }
    const w = workouts.find(w => w.d === x.d)
    const r = w && avgRir((w.entries || []).flatMap(e => (e.sets || []).filter(s => s.done && !isWarmupRow(s))))
    if (r == null) continue
    if (r >= 3.5) easy++; else if (r <= 1) grind++
  }
  if (easy) { k -= 0.1 * easy; notes.push(`${easy} lightened session${easy > 1 ? 's' : ''} still felt easy.`) }
  if (grind) { k += 0.1 * grind; notes.push(`${grind} lightened session${grind > 1 ? 's were' : ' was'} still hard work.`) }
  if (undone) { k -= 0.1 * undone; notes.push(`You kept the full plan ${undone} time${undone > 1 ? 's' : ''}.`) }

  k = Math.round(Math.min(1.5, Math.max(0.5, k)) * 100) / 100
  return { k, notes }
}

/** The prefs log with today's outcome for this day: lv, and u when undone or declined. Last 40 kept. */
export function logDay(log, d, lv, undone = false) {
  return [...(log || []).filter(x => x.d !== d), { d, lv, ...(undone ? { u: 1 } : {}) }].slice(-40)
}
