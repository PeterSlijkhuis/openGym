// The cycle screen's sheets: logging a day (flow, the questions of that day's phase, mood, a note)
// and the settings (reminder, who can see what, delete). Plain English: ours, not upstream's.
import { useEffect, useRef, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { fmtDate, todayISO } from '../lib/format.js'
import { FLOW, SYMPTOMS, MOODS, PHASES, PHASE_ASKS, phaseOn, withOngoing } from '../lib/cycle.js'
import { useCycle, saveDay, savePrefs, wipeCycle } from './useCycle.js'
import { NumberField, Row, Segmented, Switch, TextArea, Section } from './ui.jsx'
import { useStore } from '../store/useStore.js'
import { confirmSheet } from '../sheets.jsx'
import { importFromFlo } from './CycleImport.jsx'
import { saveCSV } from './CsvExportSheet.jsx'
import { cycleCSV } from '../lib/cycle-import.js'
import { csvField } from '../lib/export-csv.js'

const toast = m => useUI.getState().toast(m)
const fail = e => toast(e.message)
const GENERIC = ['cramps', 'headache', 'fatigue', 'bloating', 'tender']

function AskRow({ title, on, set }) {
  return <div className="lrow">
    <span className="lrow-m"><span className="lrow-t">{title}</span></span>
    <Switch checked={!!on} onChange={set} aria-label={title} />
  </div>
}

/** The questions a phase asks, as rows to switch on. Used on the cycle screen and in the day sheet. */
export function PhaseAsks({ date, day }) {
  const c = useCycle()
  const ph = phaseOn(withOngoing(c?.days || {}, todayISO()), date)
  const ids = ph ? PHASE_ASKS[ph.phase] : GENERIC
  const has = day?.sym || []
  const flip = (id, v) => saveDay(date, { ...day, sym: v ? [...new Set([...has, id])] : has.filter(x => x !== id) }).catch(fail)
  return <>{ids.map(id => <AskRow key={id} title={SYMPTOMS[id].q} on={has.includes(id)} set={v => flip(id, v)} />)}</>
}

const LH = [{ value: '', label: 'No test' }, { value: 'neg', label: 'Negative' }, { value: 'pos', label: 'Positive' }]
const toF = c => Math.round((c * 9 / 5 + 32) * 100) / 100
const toC = f => Math.round(((f - 32) * 5 / 9) * 100) / 100

export function DaySheet({ date }) {
  const c = useCycle()
  const fahrenheit = useStore(st => st.S.unit) === 'lb'
  const day = c?.days?.[date] || {}
  const filled = withOngoing(c?.days || {}, todayISO())
  const ph = phaseOn(filled, date)
  const ids = ph ? PHASE_ASKS[ph.phase] : GENERIC
  const rest = Object.keys(SYMPTOMS).filter(id => !ids.includes(id))
  const [note, setNote] = useState(day.note || '')
  const [temp, setTemp] = useState(day.temp ? (fahrenheit ? toF(day.temp) : day.temp) : null)
  const timer = useRef(null), tTimer = useRef(null), latest = useRef({})
  latest.current = { day, note, temp }
  const put = next => saveDay(date, next).catch(fail)
  const celsius = v => (v == null || v === 0 ? undefined : fahrenheit ? toC(v) : v)
  // The note and temperature are saved a moment after typing stops, and once more when the sheet closes.
  const typed = v => { setNote(v); clearTimeout(timer.current); timer.current = setTimeout(() => put({ ...latest.current.day, note: v }), 600) }
  const typedTemp = v => { setTemp(v); clearTimeout(tTimer.current); tTimer.current = setTimeout(() => put({ ...latest.current.day, temp: celsius(v) }), 800) }
  useEffect(() => () => {
    clearTimeout(timer.current); clearTimeout(tTimer.current)
    const { day: d, note: n, temp: t } = latest.current
    const tc = celsius(t)
    if ((d.note || '') !== n.trim() || (d.temp || undefined) !== tc) put({ ...d, note: n, temp: tc })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const flip = (key, id) => { const l = day[key] || []; put({ ...day, [key]: l.includes(id) ? l.filter(x => x !== id) : [...l, id] }) }
  const bleeding = !!filled[date]?.flow
  return <>
    <h3>{fmtDate(date, true, true)}</h3>
    <p className="muted small">{ph ? `${PHASES[ph.phase].label}, day ${ph.day} (an estimate)` : 'Log the first day of a period to see your phase.'}</p>
    <div className="muted small" style={{ margin: '12px 0 6px' }}>Flow</div>
    <Segmented value={day.flow || 0} onChange={v => put({ ...day, flow: v })} options={FLOW.map((label, value) => ({ value, label }))} />
    {(bleeding || day.end) && <Section footer="A period runs on by itself until you say it ended, or until your usual length is up. Switch this on for the last day of bleeding.">
      <AskRow title="Period ended on this day" on={day.end} set={v => put({ ...day, end: v ? 1 : 0 })} />
    </Section>}
    <Section title="Fertility signs" footer="Any of these pins your ovulation, which sharpens the estimate of your next period. A positive LH test means ovulation within about a day; waking temperature, taken before getting up, rises after it.">
      <AskRow title="Ovulation today" on={day.ov} set={v => put({ ...day, ov: v ? 1 : 0 })} />
      <div className="lrow" style={{ flexWrap: 'wrap', gap: 8 }}><span className="lrow-m"><span className="lrow-t">LH test</span></span>
        <Segmented value={day.lh || ''} onChange={v => put({ ...day, lh: v || undefined })} options={LH} /></div>
      <div className="lrow"><span className="lrow-m"><span className="lrow-t">Waking temperature</span></span>
        <NumberField nullable value={temp} onChange={typedTemp} placeholder={fahrenheit ? '97.7' : '36.50'} aria-label="Waking temperature" className="cy-temp" /><span className="muted">{fahrenheit ? '°F' : '°C'}</span></div>
    </Section>
    <Section title={ph ? `Often asked in your ${PHASES[ph.phase].label.toLowerCase()}` : 'How are you feeling?'}><PhaseAsks date={date} day={day} /></Section>
    <div className="muted small" style={{ margin: '12px 0 6px' }}>More symptoms</div>
    <div className="chips wrap">{rest.map(id => <button key={id} className={'chip' + ((day.sym || []).includes(id) ? ' on' : '')} onClick={() => flip('sym', id)}>{SYMPTOMS[id].label}</button>)}</div>
    <div className="muted small" style={{ margin: '12px 0 6px' }}>Mood</div>
    <div className="chips wrap">{Object.entries(MOODS).map(([id, label]) => <button key={id} className={'chip' + ((day.mood || []).includes(id) ? ' on' : '')} onClick={() => flip('mood', id)}>{label}</button>)}</div>
    <div className="muted small" style={{ margin: '12px 0 6px' }}>Notes</div>
    <TextArea rows={3} maxLength={1000} placeholder="Anything worth remembering" value={note} onChange={e => typed(e.target.value)} />
  </>
}

const LEVEL = [{ value: 'off', label: 'Off' }, { value: 'phase', label: 'Phase' }, { value: 'period', label: '+ Period' }, { value: 'care', label: 'Everything' }]

export function CycleSettings() {
  const c = useCycle()
  if (!c) return null
  const p = c.prefs || {}, share = p.share || {}
  const setLevel = (uid, v) => {
    const next = { ...share }
    if (v === 'off') delete next[uid]; else next[uid] = v
    savePrefs({ share: next }).catch(fail)
  }
  return <>
    <h3>Cycle settings</h3>
    <p className="muted small">Your log stays on the server, encrypted, and is not part of your synced profile. Only you can read it.</p>
    <Section title="Reminder" footer="One plain notification the morning before an expected period, with no detail on the lock screen. Sent to the devices where notifications are on in openGym's settings.">
      <AskRow title="Remind me the day before" on={p.push?.period} set={v => savePrefs({ push: { period: v } }).catch(fail)} />
    </Section>
    <Section title="Share with" footer="Nobody sees anything until you pick them. Phase shows only your current phase and cycle day. + Period adds when your next period is expected. Everything adds your calendar six months ahead with ovulation and fertile days, and today's flow, symptoms and moods, so they get an idea for each phase and for each thing you log. Notes and measurements are never shared. You can stop at any time.">
      {(c.people || []).length === 0 && <div className="lrow"><span className="lrow-m"><span className="lrow-s">No other accounts on this server yet.</span></span></div>}
      {(c.people || []).map(u => <div className="lrow" key={u.uid} style={{ flexWrap: 'wrap', gap: 8 }}>
        <span className="lrow-m"><span className="lrow-t">{u.name || 'Account'}</span></span>
        <Segmented value={share[u.uid] || 'off'} onChange={v => setLevel(u.uid, v)} options={LEVEL} />
      </div>)}
    </Section>
    <Section title="Import" footer="Flo sends a copy of your data on request: in Flo open Menu, Help, Contact us and ask for a data export. Choose the JSON file, not the TXT one. It is read on this device and only your period days are added to your own log; nothing is changed that you already logged. Symptoms and moods are not imported.">
      <Row icon="download" iconTint="var(--pink)" title="Import from Flo" subtitle="Your own periods, from a Flo JSON export" accessory="chevron" onClick={() => importFromFlo(c.days)} />
    </Section>
    <Section title="Your data">
      <Row icon="share" title="Export your cycle log (CSV)" subtitle="Every day you logged, to keep or take elsewhere" onClick={() => saveCSV(cycleCSV(c.days, { SYMPTOMS, MOODS, FLOW }, csvField), `opengym-cycle-${todayISO()}.csv`).then(() => toast('CSV exported'), () => {})} />
      <Row icon="trash" danger title="Delete all cycle data" onClick={() => confirmSheet({
        title: 'Delete all cycle data?', message: 'Every day you logged and your settings are removed from the server. This cannot be undone.',
        confirmText: 'Delete', danger: true,
        onConfirm: () => wipeCycle().then(() => toast('Cycle data deleted'), fail),
      })} />
    </Section>
  </>
}
