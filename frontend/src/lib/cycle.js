// Cycle tracking (our own, outside upstream's code): what a day holds, the averages worked out
// from the logged periods, the estimate for the next one, and the phase a day falls in.
// Pure and shared: the Worker (contrib/cloudflare/cycle.js) imports it too, to validate a day and
// to work out what an account chooses to share.
//
// Everything here is an ESTIMATE from the person's own logs. It is not contraception and not
// medical advice; the screens say so.
export const DAY = 86400e3
const ms = iso => Date.parse(iso + 'T00:00:00Z')
export const addDays = (iso, n) => new Date(ms(iso) + n * DAY).toISOString().slice(0, 10)
export const diffDays = (a, b) => Math.round((ms(a) - ms(b)) / DAY)
const ISO = /^\d{4}-\d{2}-\d{2}$/
export const isDate = s => typeof s === 'string' && ISO.test(s) && !Number.isNaN(ms(s))

// The usual figures, used until the logs say otherwise.
// Luteal phase (ovulation to the next period): about 12 to 13 days on average in large cycle
// datasets, and fairly steady within one person. Replaced by your own once you log ovulation.
const CYCLE = 28, PERIOD = 5
export const LUTEAL = 13
const Z80 = 1.2816   // a range that holds about 8 times in 10

export const FLOW = ['None', 'Light', 'Medium', 'Heavy']

/* Symptoms: id -> label, and `q`, the question the phase screen asks. */
export const SYMPTOMS = {
  cramps: { label: 'Cramps', q: 'Any cramps?' },
  backache: { label: 'Back pain', q: 'Back pain?' },
  headache: { label: 'Headache', q: 'A headache?' },
  tender: { label: 'Tender breasts', q: 'Tender breasts?' },
  bloating: { label: 'Bloating', q: 'Bloated?' },
  nausea: { label: 'Nausea', q: 'Feeling sick?' },
  fatigue: { label: 'Tired', q: 'More tired than usual?' },
  acne: { label: 'Breakouts', q: 'Breakouts?' },
  spotting: { label: 'Spotting', q: 'Any spotting?' },
  clear: { label: 'Egg-white discharge', q: 'Clear, stretchy discharge?' },
  creamy: { label: 'Creamy discharge', q: 'Creamy discharge?' },
  twinge: { label: 'One-sided twinge', q: 'A twinge low on one side?' },
  cravings: { label: 'Cravings', q: 'Food cravings?' },
  appetite: { label: 'Big appetite', q: 'Hungrier than usual?' },
  insomnia: { label: 'Poor sleep', q: 'Trouble sleeping?' },
  digest: { label: 'Gut changes', q: 'Gut or bowel changes?' },
  libido: { label: 'Higher libido', q: 'Higher sex drive?' },
  libidoLow: { label: 'Lower libido', q: 'Lower sex drive?' },
  sore: { label: 'Sore muscles', q: 'Muscles sore for longer?' },
  strong: { label: 'Felt strong', q: 'Felt strong in training?' },
  weak: { label: 'Heavy legs', q: 'Training felt heavy?' },
}
export const MOODS = {
  happy: 'Happy', calm: 'Calm', energetic: 'Energetic', low: 'Low', anxious: 'Anxious',
  irritable: 'Irritable', sensitive: 'Sensitive', foggy: 'Foggy',
}

export const PHASES = {
  menstrual: { label: 'Period', tip: 'Train by feel. Many people lift as usual; ease off if cramps are heavy.' },
  follicular: { label: 'Follicular phase', tip: 'Energy often builds from here. A good stretch to push, if you feel like it.' },
  ovulation: { label: 'Ovulation window', tip: 'Some people feel their strongest now. Warm up well.' },
  luteal: { label: 'Luteal phase', tip: 'Recovery can feel slower and sleep lighter. An easier week is fine.' },
}

/* The questions each phase asks first (ids in SYMPTOMS), the rest sit under "More". */
export const PHASE_ASKS = {
  menstrual: ['cramps', 'backache', 'headache', 'fatigue', 'nausea', 'digest'],
  follicular: ['strong', 'acne', 'libido', 'creamy', 'sore'],
  ovulation: ['clear', 'twinge', 'libido', 'tender', 'strong'],
  luteal: ['tender', 'bloating', 'cravings', 'insomnia', 'acne', 'fatigue', 'weak'],
}

/** A day from the wire, cleaned; null when nothing is left (the day is then deleted). */
export function cleanDay(d) {
  if (!d || typeof d !== 'object') return null
  const out = {}
  const flow = Math.round(Number(d.flow))
  if (flow >= 1 && flow <= 3) out.flow = flow
  const sym = [...new Set([].concat(d.sym || []).filter(x => typeof x === 'string' && SYMPTOMS[x]))]
  if (sym.length) out.sym = sym
  const mood = [...new Set([].concat(d.mood || []).filter(x => typeof x === 'string' && MOODS[x]))].slice(0, 4)
  if (mood.length) out.mood = mood
  if (d.ov) out.ov = 1
  if (d.end) out.end = 1
  const temp = Math.round(Number(d.temp) * 100) / 100
  if (temp >= 34 && temp <= 39) out.temp = temp   // waking temperature, always stored in °C
  if (d.lh === 'pos' || d.lh === 'neg') out.lh = d.lh
  const note = typeof d.note === 'string' ? d.note.trim().slice(0, 1000) : ''
  if (note) out.note = note
  return Object.keys(out).length ? out : null
}

const dates = days => Object.keys(days || {}).filter(isDate).sort()

/**
 * Ovulation in [from, to), from what was logged, best evidence first: a day marked as ovulation;
 * else the day after the first positive LH test (ovulation usually follows the surge within
 * 24 to 36 hours); else the day before a rise in waking temperature by the "three over six" rule
 * (three readings above the highest of the six before, the third at least 0.2 °C above it).
 * Returns { date, by: 'logged' | 'lh' | 'temp', cover? } or null.
 */
export function ovDay(days, from, to) {
  const ds = dates(days).filter(d => d >= from && d < to)
  const flag = ds.find(d => days[d].ov)
  if (flag) return { date: flag, by: 'logged' }
  const lh = ds.find(d => days[d].lh === 'pos')
  if (lh) return { date: addDays(lh, 1), by: 'lh' }
  const t = tempShift(days, ds)
  return t ? { date: addDays(t.first, -1), by: 'temp', cover: t.cover } : null
}

/** The first rise in waking temperature among `ds` by the three-over-six rule: { first, cover } or null. */
export function tempShift(days, ds) {
  const r = ds.filter(d => days[d]?.temp).map(d => [d, days[d].temp])
  for (let i = 6; i + 2 < r.length; i++) {
    const cover = Math.max(...r.slice(i - 6, i).map(x => x[1]))
    if (diffDays(r[i][0], r[i - 6][0]) > 12) continue   // the six before must be recent readings
    if (r[i][1] > cover && r[i + 1][1] > cover && r[i + 2][1] >= cover + 0.2) return { first: r[i][0], cover }
  }
  return null
}

/** The ovulation day found in [from, to) (see ovDay), or null. */
export function loggedOv(days, from, to) {
  return ovDay(days, from, to)?.date || null
}

/**
 * The ovulation day of the cycle starting at `start`: the logged one, else `luteal` days before the
 * next period (known for a past cycle, `cycle` days on for the current one).
 */
const ovOf = (days, start, nextStart, cycle, luteal = LUTEAL) => {
  const found = ovDay(days, addDays(start, 6), nextStart || addDays(start, 60))
  return { ov: found?.date || addDays(nextStart || addDays(start, cycle), -luteal), logged: !!found, by: found?.by }
}

/** Periods from the days with flow: [{ start, end, len }], oldest first. Flow days up to 3 days apart are one period. */
export function periods(days) {
  const out = []
  for (const date of dates(days)) {
    if (!days[date]?.flow) continue
    const last = out[out.length - 1]
    if (last && diffDays(date, last.end) <= 3) { last.end = date; last.len = diffDays(date, last.start) + 1 }
    else out.push({ start: date, end: date, len: 1 })
  }
  return out
}

const CONFIRMED = 3   // a period logged on this many days is taken as complete

/**
 * A period keeps going until you say it ended, or by itself after your usual length. Only the
 * first day (or a few) is logged, so this fills in the rest, in a copy, without writing anything:
 *  - `end` on a day (tapped "period ended", or set in the day sheet) closes the period there;
 *  - without it, the last period runs on to today while that is within your usual length (the
 *    average of your periods that were closed or logged on 3 or more days, else 5), and for a
 *    day beyond it while you keep logging flow;
 *  - an older period logged on only 1 or 2 days and never closed is taken to have lasted your
 *    usual length.
 * Filled days carry `auto: 1`. Returns { days, open } with `open` = { start, day, L, endsOn } while
 * the latest period may still be going, else null. The same object comes back when nothing is added.
 */
export function ongoing(days, today) {
  const ps = periods(days)
  if (!ps.length) return { days, open: null }
  const marks = dates(days).filter(d => days[d].end)
  const info = ps.map((p, i) => {
    const next = ps[i + 1], m = marks.filter(d => d >= p.start && (!next || d < next.start)).pop() || null
    const end = m && m > p.end ? m : p.end
    return { p, next, closed: !!m, end, len: diffDays(end, p.start) + 1 }
  })
  const known = info.filter(x => (x.closed || x.p.len >= CONFIRMED) && x.len <= 10).slice(-6).map(x => x.len)
  const L = known.length ? Math.round(sum(known) / known.length) : PERIOD
  let out = null, open = null
  const fill = (x, to) => {
    const flow = days[x.p.end]?.flow || 2
    for (let d = addDays(x.p.end, 1); d <= to && d <= today; d = addDays(d, 1)) {
      if (days[d]?.flow) continue
      out ||= { ...days }
      out[d] = { ...days[d], flow, auto: 1 }
    }
  }
  info.forEach((x, i) => {
    const { p, next } = x, target = addDays(p.start, L - 1)
    if (x.closed) return fill(x, x.end)
    if (next) { if (p.len < CONFIRMED) fill(x, addDays(next.start, -1) < target ? addDays(next.start, -1) : target); return }
    const until = [addDays(p.start, 13), target > addDays(p.end, 1) ? target : addDays(p.end, 1)].sort()[0]
    if (today >= p.start && today <= until) {
      fill(x, until)
      open = { start: p.start, day: diffDays(today, p.start) + 1, L, endsOn: target }
    } else if (p.len < CONFIRMED) fill(x, target)
  })
  return { days: out || days, open }
}
export const withOngoing = (days, today) => ongoing(days, today).days

const sum = a => a.reduce((n, x) => n + x, 0)
const mean = a => sum(a) / a.length
const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

/**
 * What the logs say about this person's cycle, as a small statistical model:
 *  - the last 12 cycle lengths (15 to 60 days), minus outliers (further than 3 robust SDs, at least
 *    7 days, from the median: a missed log or an illness month must not drag the estimate);
 *  - an exponentially weighted mean (each older cycle counts 0.9 of the next), pulled toward the
 *    usual 28 days by one pseudo-cycle, so one or two cycles do not decide everything;
 *  - a spread (SD) pulled toward a typical 3.5 days by three pseudo-cycles, so a short run of
 *    equal cycles does not claim more certainty than it has;
 *  - your own luteal length from the cycles where you logged ovulation, else 13 days.
 * Fields: cycle (rounded mean), mean, sd, rawSd (this person's own, null under 2 cycles), n, eff
 * (effective number of cycles after weighting), period, count, min, max, lengths, known,
 * luteal, lutealSd, lutealN, confidence ('low' | 'fair' | 'good'), irregular, spread.
 */
export function stats(days) {
  const ps = periods(days)
  const lengths = ps.slice(1).map((p, i) => diffDays(p.start, ps[i].start)).filter(n => n >= 15 && n <= 60)
  let use = lengths.slice(-12)
  if (use.length >= 4) {
    const med = median(use), lim = Math.max(3 * 1.4826 * median(use.map(n => Math.abs(n - med))), 7)
    use = use.filter(n => Math.abs(n - med) <= lim)
  }
  const n = use.length, w = use.map((_, i) => 0.9 ** (n - 1 - i)), W = sum(w)
  const raw = n ? sum(w.map((x, i) => x * use[i])) / W : CYCLE
  const meanF = (W * raw + CYCLE) / (W + 1)
  const s2 = n > 1 ? (sum(w.map((x, i) => x * (use[i] - raw) ** 2)) / W) * (n / (n - 1)) : 0
  const sd = Math.max(1, Math.sqrt((3 * 3.5 ** 2 + Math.max(0, n - 1) * s2) / (3 + Math.max(0, n - 1))))
  const rawSd = n > 1 ? Math.sqrt(s2) : null
  const eff = n ? W * W / sum(w.map(x => x * x)) : 0
  // Own luteal length: days from a logged ovulation to the next period.
  const lut = []
  ps.forEach((p, i) => {
    const o = ps[i + 1] && loggedOv(days, addDays(p.start, 6), ps[i + 1].start)
    const l = o ? diffDays(ps[i + 1].start, o) : 0
    if (l >= 8 && l <= 18) lut.push(l)
  })
  const lm = lut.length ? mean(lut) : LUTEAL, ls2 = lut.length > 1 ? sum(lut.map(x => (x - lm) ** 2)) / (lut.length - 1) : 0
  const plen = ps.slice(-6).map(p => p.len).filter(x => x <= 10)
  return {
    cycle: Math.round(meanF), mean: meanF, sd, rawSd, n, eff,
    period: plen.length ? Math.round(mean(plen)) : PERIOD, count: ps.length,
    min: lengths.length ? Math.min(...lengths) : null, max: lengths.length ? Math.max(...lengths) : null,
    spread: Math.min(7, Math.round(rawSd || 0)), lengths, known: n > 0,
    luteal: Math.round((lut.length * lm + 2 * LUTEAL) / (lut.length + 2)), lutealN: lut.length,
    lutealSd: Math.sqrt((2 * 1.8 ** 2 + Math.max(0, lut.length - 1) * ls2) / (2 + Math.max(0, lut.length - 1))),
    confidence: n >= 6 && rawSd <= 3 ? 'good' : n >= 3 && rawSd <= 4.5 ? 'fair' : 'low',
    irregular: n >= 3 && rawSd > 4.5,
  }
}

/**
 * The next `count` periods after the last logged one (default six, about half a year), each with
 * the range it should fall in, the ovulation day with its range, and the fertile window:
 * [{ k, start, from, to, startRange: { from, to }, half, ovulation, ovLogged, ovBy ('logged'|'lh'|'temp'), ovRange, ovHalf,
 * fertile: { from, to } }]. [] before any period is logged.
 *
 * The ranges are about 80% ranges: of past cycles with this much history, about 8 in 10 fell
 * inside. They grow with each month ahead (errors add up: variance k * SD squared, plus the
 * uncertainty of the mean itself) and are widest when there is little history. Ovulation adds the
 * uncertainty of the luteal length: a plain 4 days squared until you log ovulation yourself.
 * A logged ovulation in the current cycle pins the next period to your luteal length after it.
 * With `today`, a period already late is expected from tomorrow on, and later ones move with it.
 */
export function forecast(days, today = null, count = 6) {
  const ps = periods(days)
  if (!ps.length) return []
  const st = stats(days), last = ps[ps.length - 1], L = st.luteal
  const cur = ovOf(days, last.start, null, st.cycle, L)
  const sd2 = st.sd ** 2, div = st.eff + 1, lVar = st.lutealN ? st.lutealSd ** 2 / (st.lutealN + 1) : 4
  const first = cur.logged ? addDays(cur.ov, L) : addDays(last.start, Math.round(st.mean))
  const late = today && first < today ? diffDays(addDays(today, 1), first) : 0
  return Array.from({ length: count }, (_, j) => {
    const start = addDays(first, late + Math.round(j * st.mean))
    const v = cur.logged ? st.lutealSd ** 2 + j * sd2 * (1 + j / div) : (j + 1) * sd2 * (1 + (j + 1) / div)
    const half = clamp(Math.round(Z80 * Math.sqrt(v)), 1, 10)
    const ovLogged = j === 0 && cur.logged
    const ov = ovLogged ? cur.ov : addDays(start, -L)
    const ovHalf = ovLogged ? 0 : clamp(Math.round(Z80 * Math.sqrt(v + lVar)), 1, 10)
    return {
      k: j, start, from: start, to: addDays(start, st.period - 1),
      startRange: { from: today && late ? addDays(start, -Math.min(half, diffDays(start, today))) : addDays(start, -half), to: addDays(start, half) }, half,
      ovulation: ov, ovLogged, ovBy: ovLogged ? cur.by : null, ovRange: ovLogged ? null : { from: addDays(ov, -ovHalf), to: addDays(ov, ovHalf) }, ovHalf,
      fertile: { from: addDays(ov, -5), to: addDays(ov, 1) },
    }
  })
}

/**
 * Where `date` falls: { phase, day, fertile, late } or null with no period logged yet before it.
 * `day` counts from the first day of that period. `late` is how many days past the expected start.
 */
export function phaseOn(days, date, ps = periods(days), st = stats(days)) {
  let last = null, next = null
  for (const p of ps) if (p.start <= date) last = p; else if (!next) next = p
  if (!last) return null
  const day = diffDays(date, last.start) + 1
  if (date <= last.end) return { phase: 'menstrual', day, fertile: false, late: 0 }
  const { ov, logged } = ovOf(days, last.start, next?.start, st.cycle, st.luteal)
  const late = next ? 0 : Math.max(0, diffDays(date, logged ? addDays(ov, st.luteal) : addDays(last.start, st.cycle)) + 1)
  if (date < addDays(ov, -1)) return { phase: 'follicular', day, fertile: date >= addDays(ov, -5), late }
  if (date <= addDays(ov, 1)) return { phase: 'ovulation', day, fertile: true, late }
  return { phase: 'luteal', day, fertile: false, late }
}

/**
 * How a calendar cell is coloured. Logged days are solid: 'period' (flow) and 'ovulation'.
 * Estimates are dotted: 'period-est' (the expected days), 'period-range' (the days around them it
 * may start on), 'ovulation-est' (the day), 'ovulation-range' (the days around it), 'fertile-est'
 * (the six-day window); looking back, the ovulation of the cycles already behind.
 */
export function kindOn(days, date, fc = forecast(days), ps = periods(days), st = stats(days)) {
  if (days?.[date]?.flow) return 'period'
  if (days?.[date]?.ov) return 'ovulation'
  for (const f of fc) if (f.ovLogged && date === f.ovulation) return 'ovulation'
  for (const f of fc) if (date >= f.from && date <= f.to) return 'period-est'
  for (const f of fc) if (date >= f.startRange.from && date <= f.startRange.to) return 'period-range'
  for (const f of fc) if (!f.ovLogged && date === f.ovulation) return 'ovulation-est'
  for (const f of fc) if (f.ovRange && date >= f.ovRange.from && date <= f.ovRange.to) return 'ovulation-range'
  for (const f of fc) if (date >= f.fertile.from && date <= f.fertile.to) return 'fertile-est'
  for (let i = 0; i + 1 < ps.length; i++) {
    if (date < ps[i].start || date >= ps[i + 1].start) continue
    const { ov, logged } = ovOf(days, ps[i].start, ps[i + 1].start, st.cycle, st.luteal)
    if (logged) return date === ov ? 'ovulation' : null   // a found ovulation is that cycle's answer
    if (date < addDays(ov, -5) || date > addDays(ov, 1)) return null
    return date === ov ? 'ovulation-est' : 'fertile-est'
  }
  return null
}

/** The weeks of a month as ISO dates, each week `weekStart` (0 Sunday, 1 Monday) first; days outside the month are null. */
export function monthGrid(year, month, weekStart = 1) {
  const first = new Date(Date.UTC(year, month, 1)), n = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const lead = (first.getUTCDay() - weekStart + 7) % 7
  const cells = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => new Date(Date.UTC(year, month, i + 1)).toISOString().slice(0, 10))]
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
}

/** Per phase, the symptoms logged most often: { luteal: [['tender', 4], ...], ... } (top 3). */
export function symptomsByPhase(days) {
  const ps = periods(days), st = stats(days), count = {}
  for (const date of dates(days)) {
    const sym = days[date]?.sym
    const ph = sym?.length && phaseOn(days, date, ps, st)
    if (!ph) continue
    const c = (count[ph.phase] ||= {})
    for (const s of sym) c[s] = (c[s] || 0) + 1
  }
  return Object.fromEntries(Object.entries(count).map(([p, c]) => [p, Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 3)]))
}

/**
 * The sharing levels an account can give another account, each adding to the one before:
 * 'phase' the phase and cycle day, 'period' when the next period is expected and the usual
 * lengths, 'care' (shown as "Everything") also today's flow, symptoms and moods and the calendar:
 * six months of forecast with ovulation and fertile days, and the periods and ovulations behind.
 * Notes, temperatures and tests are never shared.
 */
export const LEVELS = ['phase', 'period', 'care']

/** The ovulation of each finished cycle: [{ d, l }], `l` 1 when it was logged or found from a test. */
export function pastOvulations(days, ps = periods(days), st = stats(days)) {
  const out = []
  for (let i = 0; i + 1 < ps.length; i++) {
    const { ov, logged } = ovOf(days, ps[i].start, ps[i + 1].start, st.cycle, st.luteal)
    out.push({ d: ov, l: logged ? 1 : 0 })
  }
  return out
}

/** What an account shows an account it shares with, at that level. */
export function sharedView(raw, today, level) {
  const days = withOngoing(raw, today)
  const ph = phaseOn(days, today)
  if (!ph || !LEVELS.includes(level)) return {}
  const out = { phase: ph.phase, day: ph.day }
  if (level === 'period' || level === 'care') {
    const st = stats(days), next = forecast(days, today)[0]
    out.cycle = st.cycle
    out.period = st.period
    if (next && next.start >= today) out.next = { from: next.startRange.from, to: next.startRange.to }
  }
  if (level === 'care') {
    const d = raw?.[today] || {}   // what was logged, not the days filled in
    out.today = {}
    if (d.flow) out.today.flow = d.flow
    if (d.sym?.length) out.today.sym = d.sym
    if (d.mood?.length) out.today.mood = d.mood
    // Everything but notes and measurements: the six months ahead, the periods and ovulations
    // behind. Worked out here at every read, so each log changes what a partner sees.
    const ps = periods(days), st = stats(days)
    out.fc = forecast(days, today).map(f => ({ k: f.k, s: f.start, e: f.to, r: [f.startRange.from, f.startRange.to], h: f.half, o: f.ovulation, l: f.ovLogged ? 1 : 0, or: f.ovRange ? [f.ovRange.from, f.ovRange.to] : null, f: [f.fertile.from, f.fertile.to] }))
    out.past = ps.slice(-12).map(x => ({ s: x.start, e: addDays(x.start, x.len - 1) }))
    out.ovs = pastOvulations(days, ps, st).slice(-12)
  }
  return out
}

const WINDOW = 7

/**
 * What your own history says is coming: in the week before a period (`when: 'before'`) the
 * symptoms you logged in the 7 days before most past periods, during a period (`'during'`) those
 * of its first 5 days. Only windows where something was logged count, so days you did not log do
 * not water it down; a symptom shows from 2 windows and half of them. null when there is nothing
 * to say. `toNext` is days to the expected period.
 */
export function upcoming(days, today, ps = periods(days), fc = forecast(days, today)) {
  const count = (from, to) => {
    const seen = new Set(); let any = false
    for (let d = from; d <= to; d = addDays(d, 1)) { const x = days[d]; if (x?.sym?.length || x?.mood?.length) any = true; (x?.sym || []).forEach(s => seen.add(s)) }
    return any ? seen : null
  }
  const tally = wins => {
    const used = wins.filter(Boolean), c = {}
    used.forEach(set => set.forEach(s => { c[s] = (c[s] || 0) + 1 }))
    return Object.entries(c).filter(([, n]) => n >= 2 && n * 2 >= used.length).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([id, n]) => ({ id, label: SYMPTOMS[id]?.label || id, n, of: used.length }))
  }
  const last = ps[ps.length - 1], ph = phaseOn(days, today, ps)
  if (ph?.phase === 'menstrual' && ph.day <= 5) {
    const list = tally(ps.filter(p => addDays(p.start, 4) < today).map(p => count(p.start, addDays(p.start, 4))))
    return list.length ? { when: 'during', list } : null
  }
  const toNext = fc[0] ? diffDays(fc[0].start, today) : null
  if (toNext == null || toNext < 0 || toNext > WINDOW || !last) return null
  const list = tally(ps.slice(1).map(p => count(addDays(p.start, -WINDOW), addDays(p.start, -1))))
  return list.length ? { when: 'before', toNext, list } : null
}

/**
 * Patterns worth knowing about, as general information (not a diagnosis): [{ id, text }].
 * Usual adult ranges are cycles of 21 to 35 days and periods of up to about 7 days.
 */
export function cycleSignals(days, today, ps = periods(days), st = stats(days)) {
  const out = [], lens = st.lengths.slice(-6), last = ps[ps.length - 1]
  const doc = ' If it keeps happening, it is worth mentioning to a doctor.'
  if (lens.filter(n => n < 21).length >= 2) out.push({ id: 'short', text: `${lens.filter(n => n < 21).length} of your last ${lens.length} cycles were shorter than 21 days.` + doc })
  if (lens.filter(n => n > 35).length >= 2) out.push({ id: 'long', text: `${lens.filter(n => n > 35).length} of your last ${lens.length} cycles were longer than 35 days.` + doc })
  if (lens.length >= 4 && Math.max(...lens) - Math.min(...lens) > 9) out.push({ id: 'vary', text: `Your cycle length varies by ${Math.max(...lens) - Math.min(...lens)} days. Stress, sleep, illness, travel and hard training blocks can all do this.` + doc })
  const longP = ps.slice(-3).filter(p => p.len > 8)
  if (longP.length) out.push({ id: 'longPeriod', text: `A recent period lasted ${longP[longP.length - 1].len} days. Bleeding for more than about 7 days, or soaking through protection every hour or two, is worth a doctor's advice.` })
  const ph = last && phaseOn(days, today, ps, st)
  if (last && diffDays(today, last.start) > 90) out.push({ id: 'gap', text: 'No period logged for more than three months. If you have not just stopped logging, a missed period for this long is worth checking with a doctor.' })
  else if (ph?.late >= 7) out.push({ id: 'late', text: `Your period is ${ph.late} days later than expected. If pregnancy is possible, a test can tell you. Stress, illness, travel and heavy training can also delay a period.` })
  return out
}
