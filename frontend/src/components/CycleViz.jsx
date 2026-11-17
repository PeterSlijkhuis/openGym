// The cycle screen's pictures: the ring of the four phases with today marked, one-tap logging of
// flow and mood, the length of every logged cycle, and what gets logged in each phase.
// Plain SVG and CSS (theme-taste.css, .cy-*). Plain English: ours, not upstream's.
import { FLOW, MOODS, PHASES, LUTEAL } from '../lib/cycle.js'
import { fmtDate } from '../lib/format.js'
import Glyph from './Glyph.jsx'

// The four phases as [phase, days] for a cycle of `cycle` days; the same split as the bar it replaced.
export function phaseParts(cycle, period = 5, luteal = LUTEAL) {
  const ov = cycle + 1 - luteal
  return [['menstrual', period], ['follicular', Math.max(1, ov - 2 - period)], ['ovulation', 3], ['luteal', Math.max(1, cycle - ov - 1)]]
}

/** The cycle as a ring of its phases, today as a dot, and `children` in the middle. */
export function CycleRing({ cycle, period, day, luteal, phase, children }) {
  const parts = phaseParts(cycle, period, luteal), total = parts.reduce((n, p) => n + p[1], 0)
  const R = 92, C = 110
  const a = ((Math.min(day, total) - 0.5) / total) * 2 * Math.PI - Math.PI / 2
  let at = 0
  return <div className={'cy-ring cy-ring-' + phase}>
    <svg viewBox="0 0 220 220" aria-hidden="true">
      <circle cx={C} cy={C} r={R} className="cy-ring-track" />
      <g className="cy-ring-arcs">{parts.map(([k, n]) => {
        const off = at; at += n
        return <circle key={k} cx={C} cy={C} r={R} pathLength={total} className={'cy-arc cy-arc-' + k}
          strokeDasharray={`${Math.max(0.2, n - 0.35)} ${total}`} strokeDashoffset={-off} transform={`rotate(-90 ${C} ${C})`} />
      })}</g>
      <circle cx={C + R * Math.cos(a)} cy={C + R * Math.sin(a)} r="13" className="cy-ring-at" />
    </svg>
    <div className="cy-ring-mid">{children}</div>
  </div>
}

// Our icon by default, the emoji with Settings, Icons, Emoji (components/Glyph.jsx).
const MOOD_ICON = Object.fromEntries([['happy', 'smile', '😊'], ['calm', 'sunrise', '😌'], ['energetic', 'bolt', '⚡'], ['low', 'arrowDown', '😔'], ['anxious', 'warning', '😟'], ['irritable', 'flame', '😤'], ['sensitive', 'heart', '🥺'], ['foggy', 'cloud', '🌫️']].map(([id, ...g]) => [id, g]))

/** Flow and mood for one day, one tap each. `put(next)` saves the whole day. */
export function QuickLog({ day = {}, put }) {
  const moods = day.mood || []
  return <div className="cy-quick">
    <div className="cy-quick-l">Flow</div>
    <div className="cy-flow">{FLOW.map((label, v) => <button key={label} className={'cy-flow-b' + ((day.flow || 0) === v ? ' on' : '')} aria-pressed={(day.flow || 0) === v}
      onClick={() => put({ ...day, flow: v })}><span className={'cy-drops cy-drops-' + v} aria-hidden="true">{[1, 2, 3].map(i => <i key={i} />)}</span>{label}</button>)}</div>
    <div className="cy-quick-l">Mood</div>
    <div className="cy-moods">{Object.entries(MOODS).map(([id, label]) => <button key={id} className={'cy-mood' + (moods.includes(id) ? ' on' : '')} aria-pressed={moods.includes(id)}
      onClick={() => put({ ...day, mood: moods.includes(id) ? moods.filter(x => x !== id) : [...moods, id] })}><Glyph icon={MOOD_ICON[id][0]} emoji={MOOD_ICON[id][1]} />{label}</button>)}</div>
  </div>
}

/** Big numbers in a grid: [[label, value, sub]]. */
export function Tiles({ items }) {
  return <div className="cy-tiles">{items.map(([l, v, s]) => <div key={l} className="cy-tile"><span>{l}</span><b>{v}</b>{s && <small>{s}</small>}</div>)}</div>
}

/** Every cycle's length as a bar, the usual range shaded and the median dashed (lib/cycle.js cycleHistory). */
export function CycleLengths({ h }) {
  const W = 320, H = 140, top = 8, bottom = 22, right = 40, n = h.list.length
  const lo = Math.min(h.shortest, h.band[0]) - 3, hi = Math.max(h.longest, h.band[1]) + 2
  const y = v => top + (1 - (v - lo) / (hi - lo)) * (H - top - bottom)
  const bw = (W - 8 - right) / n, x = i => 8 + i * bw
  // A label for each year, skipped when it would touch the one before.
  let last = -99
  const years = h.list.map((c, i) => [c.start.slice(0, 4), i]).filter(([yr], i, a) => (i === 0 || a[i - 1][0] !== yr) && x(i) - last >= 30 && (last = x(i)))
  return <div className="card cy-lens">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${n} cycles, from ${h.shortest} to ${h.longest} days, usually ${h.band[0]} to ${h.band[1]}`}>
      <rect x="8" width={W - 8 - right} y={y(h.band[1] + 0.5)} height={y(h.band[0] - 0.5) - y(h.band[1] + 0.5)} className="cy-lens-band" />
      {h.list.map((c, i) => <rect key={c.start} x={x(i) + bw * 0.15} width={Math.max(1, bw * 0.7)} y={y(c.len)} height={H - bottom - y(c.len)} rx={Math.min(3, bw * 0.3)}
        className={'cy-lens-bar' + (c.len < h.band[0] || c.len > h.band[1] ? ' off' : '')} style={{ '--i': i }}><title>{`${fmtDate(c.start)}: ${c.len} days`}</title></rect>)}
      <line x1="8" x2={W - right + 2} y1={y(h.median)} y2={y(h.median)} className="cy-lens-med" />
      <text x={W - right + 6} y={y(h.median) + 3} className="cy-tlab">{`${h.median} d`}</text>
      {years.map(([yr, i]) => <text key={yr} x={x(i) + 1} y={H - 6} className="cy-tlab">{yr}</text>)}
    </svg>
  </div>
}

/** What gets logged in each phase, as bars of how often (lib/cycle.js patternsByPhase). */
export function Patterns({ by }) {
  return <div className="card cy-pat">{Object.keys(PHASES).filter(p => by[p]).map(p => <div key={p} className={'cy-pat-ph cy-ph-' + p}>
    <div className="cy-pat-h"><span className={'cy-dot cy-seg-' + p} /><b>{PHASES[p].label}</b><span className="muted small">{by[p].days} day{by[p].days === 1 ? '' : 's'} logged</span></div>
    {by[p].top.map(x => <div key={x.kind + x.id} className="cy-pat-r">
      <span>{x.label}</span><span className="cy-bar"><span style={{ width: `${x.pct}%` }} /></span><span className="muted small">{x.pct}%</span>
    </div>)}
  </div>)}</div>
}
