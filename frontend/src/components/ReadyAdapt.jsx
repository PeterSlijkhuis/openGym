// The adaptive day at the top of a workout (ours: lib/adaptive.js). When the watch, your own cycle
// log or your training load say today is a rough day, the session you just started is made
// lighter (or offered lighter, in "ask" mode), with the reasons one tap away and an undo until the
// first set is logged. What happened is kept per account with the Garmin prefs, so it learns.
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { todayISO } from '../lib/format.js'
import { isOn } from '../lib/modules.js'
import { signals, verdict, planFor, learn, logDay, LEVEL } from '../lib/adaptive.js'
import { applyAdapt } from '../lib/coach-adapt.js'
import { isWarmupRow, hasCompletedWork } from '../lib/workout-model.js'
import { useGarmin, setGarminPrefs } from './useGarmin.js'
import { useCycle } from './useCycle.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

// What was done for a session (and its entries before, for the undo), on this device.
const KEY = id => 'ready:' + id
const read = id => { try { return JSON.parse(localStorage.getItem(KEY(id)) || 'null') } catch { return null } }
const write = (id, v) => { try { localStorage.setItem(KEY(id), JSON.stringify(v)) } catch { /* private window: the undo lasts as long as the screen */ } }

export default function ReadyAdapt() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const g = useGarmin()
  const c = useCycle()
  const A = S.active
  const iso = A?.d || todayISO()
  // Only this account's own log, and only when it tracks its cycle. A partner's share never counts.
  const cycleDays = isOn(S, 'cycle') && c?.days ? c.days : null
  const ready = g?.prefs?.ready || {}
  const mode = ready.mode || 'auto'
  const [done, setDone] = useState(() => read(A?.id))
  const [why, setWhy] = useState(false)

  const v = useMemo(() => {
    if (!g?.connected && !cycleDays) return null
    const sig = signals(g, iso, { cycleDays, workouts: S.workouts })
    if (!sig.hasData) return null
    const learnt = learn(S, g, { cycleDays, log: ready.log || [], today: iso })
    return { ...verdict(sig, learnt.k), notes: learnt.notes }
    // The day is judged once per session start, not on every logged set.
  }, [g, cycleDays, iso, A?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const started = (A?.entries || []).some(e => (e.sets || []).some(s => !isWarmupRow(s) && hasCompletedWork(s)))
  const plan = useMemo(() => (v && !started ? planFor(A, v) : null), [v, A?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const remember = (st, before) => { const x = { st, ...(before ? { before } : {}) }; write(A.id, x); setDone(x) }
  const saveLog = undone => g?.connected && setGarminPrefs({ ready: { ...ready, log: logDay(ready.log, iso, v.level, undone) } }).catch(() => {})

  const apply = () => {
    const before = JSON.parse(JSON.stringify(A.entries))
    let applied = []
    update(s => { applied = applyAdapt(s, plan, plan.changes.map(x => x.id)).applied })
    if (!applied.length) return remember('none')
    remember('applied', before)
    saveLog(false)
  }
  const keep = () => { remember('kept'); saveLog(true) }
  const undo = () => {
    update(s => { if (s.active?.id === A.id) { s.active.entries = done.before; s.active.cur = 0 } })
    remember('undone')
    saveLog(true)
    useUI.getState().toast('Back to the full plan.')
  }

  // Auto mode: lighten the session once, as soon as the day is known, before anything is logged.
  useEffect(() => {
    if (mode === 'auto' && !done && plan && !started && !A.backfill) apply()
  }, [plan, mode, done, started]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!A || A.backfill || mode === 'off' || !v || v.level === 'normal') return null
  if (v.level !== 'push' && !plan && !done) return null

  const L = LEVEL[v.level]
  const title = v.sick ? 'Your body may be fighting something' : L.title
  let line = L.line
  if (done?.st === 'undone' || done?.st === 'kept') line = 'Full plan, as you chose. Listen to your body.'
  else if (!done && plan && mode === 'ask') line = 'Make it lighter? ' + L.line

  return <div className={'card ready-adapt lv-' + v.level}>
    <div className="ra-head">
      <Icon name={v.level === 'push' ? 'bolt' : 'moon'} />
      <div className="ra-mid">
        <div className="ra-title">{title}</div>
        {line && <div className="ra-line">{line}</div>}
      </div>
      <button className="iconbtn" aria-expanded={why} aria-label="Why" title="Why" onClick={() => setWhy(x => !x)}><Icon name="info" /></button>
    </div>
    {why && <ul className="ra-why">
      {v.signs.map(s => <li key={s.id} className={s.pts < 0 ? 'bad' : 'good'}>{s.text}</li>)}
      {v.sick && <li className="bad">Resting heart rate, HRV or breathing look like you may be getting ill</li>}
      {v.notes.map(n => <li key={n} className="learnt">{n}</li>)}
      {v.k !== 1 && <li className="learnt">Tuned to you: bad signs count {Math.round(v.k * 100)}%.</li>}
    </ul>}
    {!done && plan && mode === 'ask' && <div className="ra-acts">
      <Button variant="primary" size="sm" onClick={apply}>Make it lighter</Button>
      <Button size="sm" onClick={keep}>Keep the plan</Button>
    </div>}
    {done?.st === 'applied' && !started && <div className="ra-acts"><Button size="sm" icon="undo" onClick={undo}>Undo, I feel fine</Button></div>}
  </div>
}
