// Home: where you are in the cycle, one tap from the Cycle screen. Shows only with the Cycle
// module on and only on a server that has cycle tracking.
import { useNavigate } from 'react-router-dom'
import { todayISO, fmtDate } from '../lib/format.js'
import { PHASES, forecast, phaseOn, withOngoing } from '../lib/cycle.js'
import { partnerTips } from '../lib/cycle-care.js'

const loggedToday = p => { const t = partnerTips(p.today); return t.length ? `Today: ${t.map(x => x.label).join(', ')}. Tap for ideas.` : null }
import { useCycle } from './useCycle.js'
import CardHead from './CardHead.jsx'
import Icon from './Icon.jsx'

// `own`: this account tracks its own cycle (module on). Without it the card appears only when a
// friend shares theirs, and says so.
export default function CycleHomeCard({ own }) {
  const nav = useNavigate()
  const c = useCycle()
  if (!c) return null
  if (!own) {
    const p = c.partners || []
    if (!p.length) return null
    return <div className="card tap-host">
      <CardHead icon="moon" tint="var(--pink)" eyebrow="Cycle" title={p.length === 1 ? `${p[0].name}: ${PHASES[p[0].phase].label}, day ${p[0].day}` : `${p.length} people share their cycle`}
        sub={p.length !== 1 ? null : loggedToday(p[0]) || (p[0].next ? `Next period expected ${fmtDate(p[0].next.from)}` : null)}
        open={{ onClick: () => nav('/cycle') }} action={<Icon name="chevronRight" className="chev" />} />
    </div>
  }
  const today = todayISO(), days = withOngoing(c.days, today)
  const ph = phaseOn(days, today), next = forecast(days, today)[0]
  return <div className="card tap-host">
    <CardHead icon="moon" tint="var(--pink)" eyebrow="Cycle" title={ph ? `${PHASES[ph.phase].label}, day ${ph.day}` : 'Start tracking your cycle'}
      sub={ph && next && ph.late === 0 ? `Next period expected ${fmtDate(next.start)}` : ph ? null : 'Log the first day of your last period'}
      open={{ onClick: () => nav('/cycle') }} action={<Icon name="chevronRight" className="chev" />} />
  </div>
}
