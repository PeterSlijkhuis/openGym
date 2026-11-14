// What one calendar day tells, for the popover on the Cycle screen (ours, plain English): the
// phase and what it means, the foods that help, and ideas for a partner. Pure.
//
// `ownDayInfo` is for the person who logs the cycle, with everything they logged. `partnerDayInfo`
// is for someone it is shared with, built only from what sharedView hands out (lib/cycle.js): the
// phase and cycle day, the expected period, and (at the feelings level) today's feelings. A partner
// never gets ovulation or the fertile window, so a mid-cycle day is shown as part of the follicular
// phase there.
import { PHASE_ASKS, SYMPTOMS, addDays, diffDays, forecast, kindOn, periods, phaseOn, stats } from './cycle.js'
import { PHASE_INFO, PARTNER_PHASE, SYMPTOM_FOOD, PHASE_FOOD, partnerTips } from './cycle-care.js'

const foodsFor = (phase, sym) => {
  const ids = sym?.length ? sym : PHASE_ASKS[phase].filter(id => SYMPTOM_FOOD[id]).slice(0, 3)
  return {
    phase: PHASE_FOOD[phase],
    symptoms: ids.filter(id => SYMPTOM_FOOD[id]).map(id => ({ id, label: SYMPTOMS[id].label, text: SYMPTOM_FOOD[id] })),
    logged: !!sym?.length,
  }
}

/** The popover for `date` in your own log: { date, kind, phase, day, f, projected, logged, info, foods, ideas, tips }. */
export function ownDayInfo(days, date, today) {
  const ps = periods(days), st = stats(days), fc = forecast(days, today)
  const kind = kindOn(days, date, fc, ps, st)
  // After today, the cycles still to come count as periods, so a day months ahead has its phase.
  const ahead = date > today && fc.length
  const all = ahead ? [...ps, ...fc.map(f => ({ start: f.start, end: f.to, len: st.period }))] : ps
  const ph = phaseOn(days, date, all, st)
  const f = fc.find(x => (date >= x.startRange.from && date <= x.to) || (x.ovRange && date >= x.ovRange.from && date <= x.ovRange.to) || date === x.ovulation) || null
  const logged = days[date] || {}
  if (!ph) return { date, kind, phase: null, f, logged, projected: !!ahead, st }
  return {
    date, kind, phase: ph.phase, day: ph.day, late: ph.late, f, logged, projected: !!ahead, st,
    info: PHASE_INFO[ph.phase], foods: foodsFor(ph.phase, logged.sym),
    ideas: PARTNER_PHASE[ph.phase].ideas, gist: PARTNER_PHASE[ph.phase].gist, tips: partnerTips(logged),
  }
}

/** The calendar colour of a shared day: the current period, the expected one and the days it may start on. */
export function partnerKind(p, today, d) {
  const per = p.period || 5
  const cur = addDays(today, -(p.day - 1))
  if (p.phase === 'menstrual' && d >= cur && d < addDays(cur, per)) return d <= today ? 'period' : 'period-est'
  if (!p.next || d < p.next.from) return null
  const start = addDays(p.next.from, diffDays(p.next.to, p.next.from) >> 1)
  if (d >= start && d < addDays(start, per)) return 'period-est'
  return d <= p.next.to ? 'period-range' : null
}

/** The popover for `date` in what someone shares: phase estimated from the shared cycle length. */
export function partnerDayInfo(p, date, today) {
  const kind = partnerKind(p, today, date)
  const isToday = date === today
  let phase = p.phase, day = p.day
  if (!isToday && p.cycle) {
    const pos = (((p.day - 1 + diffDays(date, today)) % p.cycle) + p.cycle) % p.cycle + 1, per = p.period || 5
    phase = pos <= per ? 'menstrual' : pos > p.cycle - 11 ? 'luteal' : 'follicular'   // mid-cycle stays "follicular": no fertile window is shared
    day = pos
  }
  const logged = isToday ? p.today || {} : {}
  return {
    date, kind, phase, day, projected: !isToday, logged, shared: !!p.today, isToday,
    info: PHASE_INFO[phase], foods: foodsFor(phase, logged.sym),
    ideas: PARTNER_PHASE[phase].ideas, gist: PARTNER_PHASE[phase].gist, tips: partnerTips(logged),
  }
}
