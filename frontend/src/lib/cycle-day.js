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

/** The shared forecast item for a date, shaped like lib/cycle.js forecast() for the day popover. */
const fcItem = f => ({ k: f.k, start: f.s, to: f.e, from: f.s, startRange: { from: f.r[0], to: f.r[1] }, half: f.h, ovulation: f.o, ovLogged: !!f.l,
  ovRange: f.or ? { from: f.or[0], to: f.or[1] } : null, fertile: { from: f.f[0], to: f.f[1] } })

/** The calendar colour of a shared day: from the full forecast when everything is shared, else the current period and the next one. */
export function partnerKind(p, today, d) {
  const per = p.period || 5
  if (p.fc) {
    if (p.past?.some(x => d >= x.s && d <= x.e)) return d <= today ? 'period' : 'period-est'
    const lo = p.ovs?.find(o => o.d === d)
    if (lo) return lo.l ? 'ovulation' : 'ovulation-est'
    for (const f of p.fc) if (f.l && d === f.o) return 'ovulation'
    for (const f of p.fc) if (d >= f.s && d <= f.e) return 'period-est'
    for (const f of p.fc) if (f.k < 3 && d >= f.r[0] && d <= f.r[1]) return 'period-range'
    for (const f of p.fc) if (!f.l && d === f.o) return 'ovulation-est'
    for (const f of p.fc) if (f.or && f.k < 3 && d >= f.or[0] && d <= f.or[1]) return 'ovulation-range'
    for (const f of p.fc) if (d >= f.f[0] && d <= f.f[1]) return 'fertile-est'
    if (p.ovs?.some(o => d >= addDays(o.d, -5) && d <= addDays(o.d, 1))) return 'fertile-est'
    return null
  }
  const cur = addDays(today, -(p.day - 1))
  if (p.phase === 'menstrual' && d >= cur && d < addDays(cur, per)) return d <= today ? 'period' : 'period-est'
  if (!p.next || d < p.next.from) return null
  const start = addDays(p.next.from, diffDays(p.next.to, p.next.from) >> 1)
  if (d >= start && d < addDays(start, per)) return 'period-est'
  return d <= p.next.to ? 'period-range' : null
}

/** The popover for `date` in what someone shares: the shared forecast, or the phase estimated from the shared cycle length. */
export function partnerDayInfo(p, date, today) {
  const kind = partnerKind(p, today, date)
  const isToday = date === today
  let phase = p.phase, day = p.day
  if (!isToday && p.cycle) {
    const pos = (((p.day - 1 + diffDays(date, today)) % p.cycle) + p.cycle) % p.cycle + 1, per = p.period || 5
    phase = pos <= per ? 'menstrual' : pos > p.cycle - 11 ? 'luteal' : 'follicular'   // without the forecast, mid-cycle stays "follicular"
    day = pos
    if (p.fc) {
      const next = p.fc.find(f => date < f.s) || p.fc[p.fc.length - 1]
      const inP = p.past?.some(x => date >= x.s && date <= x.e) || p.fc.some(f => date >= f.s && date <= f.e)
      if (inP) phase = 'menstrual'
      else if (date >= next.f[0] && date <= next.f[1]) phase = 'ovulation'
      else if (date > next.f[1] && date < next.s) phase = 'luteal'
      else if (date < next.f[0]) phase = 'follicular'
    }
  }
  const fi = p.fc && p.fc.find(f => date >= (f.or?.[0] ?? f.f[0]) && date <= f.e) || null
  const f = kind && fi ? fcItem(fi) : null
  const logged = isToday ? p.today || {} : {}
  return {
    date, kind, f, phase, day, projected: !isToday, logged, shared: !!p.today, isToday,
    info: PHASE_INFO[phase], foods: foodsFor(phase, logged.sym),
    ideas: PARTNER_PHASE[phase].ideas, gist: PARTNER_PHASE[phase].gist, tips: partnerTips(logged),
  }
}
