// The Cycle screen's calendar: a month you can page through (up to six months ahead), with the
// logged days solid and the estimates dotted, and a popover per day (hover with a mouse, tap or
// Enter on a phone or keyboard) that says what the day means, what to eat and what a partner can
// offer. One native popover is moved from day to day: no animation or popover library, and a card
// under the calendar where the browser has no Popover API. Plain English: ours, not upstream's.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fmtDate, DAYS } from '../lib/format.js'
import { PHASES, SYMPTOMS, MOODS, monthGrid } from '../lib/cycle.js'
import Icon from './Icon.jsx'
import { Button, Section } from './ui.jsx'

export const KIND = {
  period: 'Period', 'period-est': 'Expected period', 'period-range': 'Period could start', ovulation: 'Ovulation',
  'ovulation-est': 'Expected ovulation', 'ovulation-range': 'Ovulation range', 'fertile-est': 'Fertile window',
}
const LEGEND = {
  period: 'Period', 'period-est': 'Expected period', 'period-range': 'Could start', ovulation: 'Ovulation',
  'ovulation-est': 'Expected ovulation', 'ovulation-range': 'Ovulation range', 'fertile-est': 'Fertile window',
}
const POP = () => typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype
const range = (a, b) => (a === b ? fmtDate(a) : `${fmtDate(a)} to ${fmtDate(b)}`)

/** What the forecast says about a day, in words. */
function Estimate({ info }) {
  const f = info.f, k = info.kind
  if (k === 'period') return <p className="cy-pop-est">{info.logged.auto ? 'Period, filled in: it runs on until you say it ended, or for your usual length.' : 'Period, as you logged it.'}</p>
  if (k === 'ovulation') return <p className="cy-pop-est">Ovulation, as you logged it.</p>
  if (!f || !k) return null
  const far = f.k >= 3 ? ' This far ahead it is a rough guide.' : ''
  if (k === 'period-est' || k === 'period-range') {
    return <p className="cy-pop-est">{k === 'period-est' ? 'Expected period' : 'Your period could start on this day'}: most likely from {fmtDate(f.start)}, and in about 8 of 10 cycles it starts between {range(f.startRange.from, f.startRange.to)} (a range of {f.half} days either side).{far}</p>
  }
  if (f.ovRange) return <p className="cy-pop-est">Ovulation is estimated around {fmtDate(f.ovulation)}, and in about 8 of 10 cycles falls between {range(f.ovRange.from, f.ovRange.to)}. The six fertile days run up to a day after it. Logging a positive ovulation test narrows this.{far}</p>
  return <p className="cy-pop-est">Ovulation was logged on {fmtDate(f.ovulation)}. The fertile window is the five days before it and the day after.</p>
}

/** The content of a day: shared by the popover and the card under the calendar. */
export function DayCard({ info, viewer, onLog }) {
  const p = info.phase && PHASES[info.phase]
  const own = viewer === 'own'
  return <div className="cy-pop-body">
    <div className="cy-pop-h">
      <b>{fmtDate(info.date, true, true)}</b>
      {info.kind && <span className={'cy-tag cy-' + info.kind}>{KIND[info.kind]}</span>}
    </div>
    {p ? <div className="cy-pop-ph"><span className={'cy-dot cy-seg-' + info.phase} /><span>{p.label}<span className="muted"> · cycle day {info.day}{info.projected ? ', estimated' : ''}</span></span></div>
      : <p className="muted small">Log the first day of a period to see the phase.</p>}
    <Estimate info={info} />
    {info.late > 0 && !info.projected && <p className="cy-pop-est">{info.late} day{info.late === 1 ? '' : 's'} past the expected start. Cycles vary, this can be normal.</p>}
    {info.info && <>
      <h4>What this phase means</h4>
      <p>{info.info.what}</p>
      <p className="muted">{info.info.feel}</p>
      <p><b>Energy:</b> {info.info.energy} <b>Training:</b> {info.info.train}</p>
      <h4>{info.foods.logged ? 'To eat for what is logged' : 'What to eat'}</h4>
      {info.foods.symptoms.map(x => <p key={x.id}><b>{x.label}:</b> {x.text}</p>)}
      {!info.foods.logged && info.foods.symptoms.length > 0 && <p className="muted small">Often useful in this phase, whether or not you notice it.</p>}
      <ul>{info.foods.phase.map(x => <li key={x}>{x}</li>)}</ul>
      <p className="muted small">General nutrition, not treatment. Long-lasting or severe symptoms are worth a talk with a doctor.</p>
      <h4>{own ? 'What a partner could do' : 'What you can offer'}</h4>
      <p className="muted">{info.gist}</p>
      {info.tips.map(t => <p key={t.kind + t.id}><b>{t.label}:</b> {t.text}</p>)}
      <ul>{info.ideas.map(x => <li key={x}>{x}</li>)}</ul>
      {!own && !info.isToday && <p className="muted small">Phases other than today are estimated from the shared cycle length.</p>}
    </>}
    {own && (info.logged.sym?.length > 0 || info.logged.mood?.length > 0) && <p className="muted small">You logged: {[...(info.logged.sym || []).map(x => SYMPTOMS[x]?.label), ...(info.logged.mood || []).map(x => MOODS[x])].filter(Boolean).join(', ')}.</p>}
    {onLog && <Button size="sm" variant="tinted" onClick={onLog}>Log this day</Button>}
  </div>
}

/**
 * `kind(date)` colours a day, `info(date)` returns what DayCard shows (lib/cycle-day.js), `onLog`
 * (own calendar) opens the day to log it. `ahead` months can be paged to from `today`.
 */
export default function CycleCalendar({ today, weekStart = 1, kind, info, viewer, legend, title, onLog, logged = () => false, ahead = 6, back = 24 }) {
  const now = new Date(today + 'T00:00:00')
  const [ym, setYm] = useState([now.getFullYear(), now.getMonth()])
  const [sel, setSel] = useState(null)
  const pop = useRef(null), anchor = useRef(null), pinned = useRef(false), timer = useRef(0)
  const native = POP()
  const idx = ym[0] * 12 + ym[1], cur = now.getFullYear() * 12 + now.getMonth()
  const go = n => { const d = new Date(ym[0], ym[1] + n, 1); setYm([d.getFullYear(), d.getMonth()]); hide(true) }
  const grid = monthGrid(ym[0], ym[1], weekStart)
  const heads = [...DAYS.slice(weekStart), ...DAYS.slice(0, weekStart)]

  const hide = force => {
    clearTimeout(timer.current)
    if (!force && pinned.current) return
    pinned.current = false
    if (!native) { if (force) setSel(null) } else if (pop.current?.matches(':popover-open')) pop.current.hidePopover()
  }
  const show = (d, el, pin) => {
    clearTimeout(timer.current)
    anchor.current = el
    pinned.current = pin
    setSel(d)
  }
  // Show and place the popover once it holds the chosen day: under the day when it fits, else above.
  useLayoutEffect(() => {
    const el = pop.current, a = anchor.current
    if (!native || !el || !a || !sel) return
    if (!el.matches(':popover-open')) el.showPopover()
    const r = a.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, vw = window.innerWidth, vh = window.innerHeight
    const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, vw - w - 8))
    const below = r.bottom + 6, above = r.top - 6 - h
    el.style.left = left + 'px'
    el.style.top = Math.max(8, below + h <= vh - 8 ? below : above >= 8 ? above : vh - h - 8) + 'px'
  }, [sel, native])
  useEffect(() => {
    const el = pop.current
    if (!el) return
    const closed = e => { if (e.newState === 'closed') { pinned.current = false; setSel(null) } }
    el.addEventListener('toggle', closed)
    return () => el.removeEventListener('toggle', closed)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])

  const detail = sel && info(sel)
  const card = detail && <DayCard info={detail} viewer={viewer} onLog={onLog && sel <= today ? () => { hide(true); onLog(sel) } : null} />
  return <Section title={title}><div className="card cy-cal">
    <div className="hdr" style={{ marginBottom: 0 }}>
      <button className="iconbtn" onClick={() => go(-1)} disabled={idx - cur <= -back} aria-label="Previous month"><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>{new Date(ym[0], ym[1], 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
      <button className="iconbtn" onClick={() => go(1)} disabled={idx - cur >= ahead} aria-label="Next month"><Icon name="chevronRight" /></button>
    </div>
    <div className="cal-grid">
      {heads.map((h, i) => <div key={i} className="cal-h">{h}</div>)}
      {grid.flat().map((d, i) => {
        if (!d) return <div key={i} />
        const k = kind(d)
        const cls = 'cal-d' + (k ? ' cy-' + k : '') + (d === today ? ' today' : '') + (d > today ? ' later' : '') + (d === sel ? ' sel' : '')
        return <button key={i} className={cls} aria-label={fmtDate(d, true) + (k ? ', ' + KIND[k] : '')}
          onClick={e => show(d, e.currentTarget, true)}
          onPointerEnter={e => { if (e.pointerType === 'mouse' && !pinned.current) { const el = e.currentTarget; clearTimeout(timer.current); timer.current = setTimeout(() => show(d, el, false), 90) } }}
          onPointerLeave={e => { if (e.pointerType === 'mouse') { clearTimeout(timer.current); timer.current = setTimeout(() => hide(false), 220) } }}>
          {Number(d.slice(8))}<i className={logged(d) ? 'done' : ''} />
        </button>
      })}
    </div>
    <div className="cal-legend cy-legend">
      {legend.map(k => <span key={k}><i className={'cy-' + k} />{LEGEND[k]}</span>)}
    </div>
    <p className="muted small" style={{ margin: '10px 0 0', textAlign: 'center' }}>Solid days are logged, dotted days are estimates and the lighter dots around them are the range. {native ? 'Hover or tap a day to see what it means.' : 'Tap a day to see what it means.'}</p>
    {native ? <div ref={pop} popover="auto" className="cy-pop" role="dialog" aria-label="About this day"
      onPointerEnter={() => clearTimeout(timer.current)} onPointerLeave={e => { if (e.pointerType === 'mouse') { clearTimeout(timer.current); timer.current = setTimeout(() => hide(false), 220) } }}>
      {card}
    </div> : card && <div className="cy-daycard">{card}</div>}
  </div></Section>
}
