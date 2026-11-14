// Reading a Flo data export (ours, plain English, pure). Flo sends a copy of your data on request
// (Menu, Help, Contact us) as JSON or TXT. Only the JSON can be read here: the TXT is meant for
// people and has no fixed layout.
//
// What the JSON is known to hold, from the open-source converter github.com/SaraVieira/flo-to-drip
// (MIT): `operationalData.cycles`, a list where each cycle has `period_start_date` and
// `period_end_date`. Nothing else is read: symptoms, moods and ovulation are not imported, and
// Flo has no flow strength for those days, so each period day becomes a medium flow. Only the date
// part of a timestamp is used, so a time zone can never move a day.
import { addDays, diffDays, isDate } from './cycle.js'

const DAY_PART = /^(\d{4}-\d{2}-\d{2})/
const day = v => {
  if (typeof v !== 'string') return null
  const m = DAY_PART.exec(v.trim())
  return m && isDate(m[1]) ? m[1] : null
}

/**
 * Reads the text of a Flo export. Returns { days, periods, skipped, from, to } where `days` is
 * { 'YYYY-MM-DD': { flow: 2 } }, or { error } when the file is not a readable Flo export.
 * Periods that start after `today` (a forecast, not a log), have no usable start or run longer
 * than 14 days are skipped and counted.
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
    for (let d = start; d <= end && d <= today; d = addDays(d, 1)) days[d] = { flow: 2 }
    if (end <= today) days[end].end = 1   // Flo says when it ended, so it is not stretched to the usual length
  }
  const dates = Object.keys(days).sort()
  if (!dates.length) return { error: 'No period days found in this file.' }
  return { days, periods, skipped, from: dates[0], to: dates[dates.length - 1] }
}

/** What an import would change: days that are new, and days already logged that stay as they are. */
export function planImport(have, days) {
  let added = 0, kept = 0
  for (const d of Object.keys(days)) { if (have?.[d]?.flow) kept++; else added++ }
  return { added, kept }
}
