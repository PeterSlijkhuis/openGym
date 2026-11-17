// Reading a Flo data export (ours, plain English, pure). Flo sends a copy of your data on request
// (Menu, Help, Contact us) as JSON or TXT. Only the JSON can be read here: the TXT is meant for
// people and has no fixed layout.
//
// What is read, checked against a real export (2026-11):
// - `operationalData.cycles`: `period_start_date`, `period_end_date` and `period_intensity`, a JSON
//   string { "<day offset from the start>": level } with levels 1 to 4 (and -1). Flo's levels are
//   light, medium, heavy, very heavy; ours stop at heavy, so 4 becomes heavy. A day without a level
//   is medium.
// - `pointEventsManualData.point_events_manual_v2`: one entry per logged item, `local_date`,
//   `category` and `subcategory` (Symptom, Mood, Fluid, Sex...). Those with a match in SYMPTOMS or
//   MOODS are kept; sleep, sport, weight and the rest are not ours to hold.
// Nothing else is read (no ids, profile, notes or wearables). Only the date part of a timestamp is
// used, so a time zone can never move a day.
import { addDays, diffDays, isDate, cleanDay } from './cycle.js'

const LEVEL = { 1: 1, 2: 2, 3: 3, 4: 3 }
const SYM = {
  'Symptom/AbdominalPain': 'cramps', 'Symptom/DrawingPain': 'cramps', 'Symptom/Backache': 'backache',
  'Symptom/Headache': 'headache', 'Symptom/TenderBreasts': 'tender', 'Symptom/Bloating': 'bloating',
  'Symptom/Nausea': 'nausea', 'Symptom/Fatigue': 'fatigue', 'Mood/LowEnergy': 'fatigue', 'Symptom/Acne': 'acne',
  'Symptom/IncreasedAppetite': 'appetite', 'Symptom/Insomnia': 'insomnia', 'Symptom/Constipation': 'digest',
  'Symptom/Diarrhea': 'digest', 'Fluid/Eggwhite': 'clear', 'Fluid/Creamy': 'creamy', 'Fluid/Bloody': 'spotting',
  'Sex/HighDrive': 'libido',
}
const MOOD = {
  'Mood/Happy': 'happy', 'Mood/Playful': 'happy', 'Mood/Neutral': 'calm', 'Mood/Energetic': 'energetic',
  'Mood/Sad': 'low', 'Mood/Depressed': 'low', 'Mood/Apathetic': 'low', 'Mood/Panic': 'anxious',
  'Mood/ObsessiveThoughts': 'anxious', 'Mood/Angry': 'irritable', 'Mood/Swings': 'sensitive',
  'Mood/FeelingGuilty': 'sensitive', 'Mood/VerySelfCritical': 'sensitive', 'Mood/Confused': 'foggy', 'Symptom/BrainFog': 'foggy',
}
const levels = v => { try { const o = typeof v === 'string' ? JSON.parse(v) : v; return o && typeof o === 'object' ? o : {} } catch { return {} } }
const add = (list, x) => (list?.includes(x) ? list : [...(list || []), x])

const DAY_PART = /^(\d{4}-\d{2}-\d{2})/
const day = v => {
  if (typeof v !== 'string') return null
  const m = DAY_PART.exec(v.trim())
  return m && isDate(m[1]) ? m[1] : null
}

/**
 * Reads the text of a Flo export. Returns { days, periods, skipped, logged, from, to } where `days`
 * is { 'YYYY-MM-DD': { flow, end, sym, mood } } and `logged` counts the days with symptoms or
 * moods, or { error } when the file is not a readable Flo export. Periods that start after `today`
 * (a forecast, not a log), have no usable start or run longer than 14 days are skipped and counted.
 */
export function parseFlo(text, today) {
  let data
  try { data = JSON.parse(text) } catch { return { error: 'This is not a JSON file. Ask Flo for the JSON version of your data (the TXT one is only for reading).' } }
  const cycles = data?.operationalData?.cycles ?? data?.cycles
  if (!Array.isArray(cycles)) return { error: 'No periods found. This does not look like a Flo data export.' }
  const days = {}
  let periods = 0, skipped = 0
  for (const c of cycles) {
    const start = day(c?.period_start_date), end = day(c?.period_end_date) || start
    if (!start || start > today || end < start || diffDays(end, start) > 13) { skipped++; continue }
    periods++
    const lv = levels(c.period_intensity)
    for (let d = start, i = 0; d <= end && d <= today; d = addDays(d, 1), i++) days[d] = { flow: LEVEL[lv[i]] || 2 }
    if (end <= today) days[end].end = 1   // Flo says when it ended, so it is not stretched to the usual length
  }
  const events = data?.pointEventsManualData?.point_events_manual_v2
  const logged = new Set()
  for (const e of Array.isArray(events) ? events : []) {
    const d = day(e?.local_date ?? e?.date), key = `${e?.category}/${e?.subcategory}`
    if (!d || d > today || !(SYM[key] || MOOD[key])) continue
    const x = (days[d] ||= {})
    if (SYM[key]) x.sym = add(x.sym, SYM[key])
    else x.mood = add(x.mood, MOOD[key])
    logged.add(d)
  }
  const dates = Object.keys(days).sort()
  if (!dates.length) return { error: 'No period days found in this file.' }
  return { days, periods, skipped, logged: logged.size, from: dates[0], to: dates[dates.length - 1] }
}

/**
 * One imported day laid over what is already logged. A day with your own flow keeps its flow and
 * end; symptoms and moods are joined. Running it twice gives the same day, so a second import of
 * the same file changes nothing. Used by the server too (contrib/cloudflare/cycle.js).
 */
export function mergeDay(have, inc) {
  const sym = [...new Set([...(have?.sym || []), ...(inc?.sym || [])])]
  const mood = [...new Set([...(have?.mood || []), ...(inc?.mood || [])])]
  return cleanDay({ ...(have?.flow ? {} : inc), ...have, sym, mood })
}

/** What an import would change: days it adds or fills in, and days it leaves as they are. */
export function planImport(have, days) {
  let added = 0, kept = 0
  for (const d of Object.keys(days)) {
    if (JSON.stringify(mergeDay(have?.[d], days[d])) === JSON.stringify(cleanDay(have?.[d]))) kept++; else added++
  }
  return { added, kept }
}

/** Your own cycle log as CSV, one row per logged day (oldest first). Temperatures in °C. */
export function cycleCSV(days, { SYMPTOMS, MOODS, FLOW }, field) {
  const head = ['Date', 'Flow', 'Period ended', 'Ovulation', 'LH test', 'Temperature (°C)', 'Symptoms', 'Moods', 'Note']
  const rows = Object.keys(days || {}).filter(isDate).sort().map(d => {
    const x = days[d]
    return [d, x.flow ? FLOW[x.flow] : '', x.end ? 'yes' : '', x.ov ? 'yes' : '', x.lh === 'pos' ? 'positive' : x.lh === 'neg' ? 'negative' : '',
      x.temp ?? '', (x.sym || []).map(s => SYMPTOMS[s]?.label || s).join('; '), (x.mood || []).map(m => MOODS[m] || m).join('; '), x.note || '']
  })
  return [head, ...rows].map(r => r.map(field).join(',')).join('\r\n') + '\r\n'
}
