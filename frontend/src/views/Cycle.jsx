// Cycle tracking: log periods and symptoms, see where you are in the cycle, the estimated next
// period and fertile window, a calendar and your own averages. Private to the account unless it
// picks who may see its phase (components/CycleSheets.jsx). Plain English: ours, not upstream's.
// Every date and phase is an ESTIMATE from the person's own logs: not contraception, not medical advice.
import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { fmtDate, todayISO, weekStartOf } from '../lib/format.js'
import { PHASES, addDays, diffDays, forecast, kindOn, ongoing, ovDay, periods, phaseOn, stats, patternsByPhase, cycleHistory, upcoming, cycleSignals } from '../lib/cycle.js'
import { PHASE_INFO, PARTNER_PHASE, partnerTips } from '../lib/cycle-care.js'
import { ownDayInfo, partnerDayInfo, partnerKind } from '../lib/cycle-day.js'
import CycleCalendar from '../components/CycleCalendar.jsx'
import { importFromFlo } from '../components/CycleImport.jsx'
import { useCycle, saveDay, savePrefs, refreshCycle } from '../components/useCycle.js'
import { DaySheet, CycleSettings, PhaseAsks } from '../components/CycleSheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button, Row, Section, Segmented } from '../components/ui.jsx'
import { CycleRing, QuickLog, Tiles, CycleLengths, Patterns } from '../components/CycleViz.jsx'
import { isOn } from '../lib/modules.js'

const openSheet = render => useUI.getState().openSheet(render)
const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return null } })()

// Months from the first logged day to today, so an imported history can be paged back to.
const monthsBack = (days, today) => { const f = Object.keys(days).sort()[0]; return f ? (+today.slice(0, 4) - +f.slice(0, 4)) * 12 + (+today.slice(5, 7) - +f.slice(5, 7)) : 0 }

export default function Cycle() {
  const nav = useNavigate()
  const c = useCycle()
  const own = isOn(useStore(s => s.S), 'cycle')
  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" data-back="/" onClick={() => nav(-1)} aria-label="Back"><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginInlineStart: 12 }}><h1>Cycle</h1><div className="sub">{own ? 'Private to you' : 'Shared with you'}</div></div>
      {c && own && <button className="iconbtn" onClick={() => openSheet(() => <CycleSettings />)} aria-label="Cycle settings"><Icon name="gear" /></button>}
    </div>
    {c === undefined && <p className="muted">Loading…</p>}
    {c === null && <div className="card"><p className="muted">This server has no cycle tracking, or it could not be reached. <Button size="sm" variant="ghost" onClick={() => refreshCycle()}>Try again</Button></p></div>}
    {c && own && <Body c={c} />}
    {c && !own && <Shared c={c} />}
  </div>
}

// Cycle tracking off for this account: only what friends choose to share with it.
function Shared({ c }) {
  const p = c.partners || []
  return <>
    {p.length ? <PartnerRows partners={p} /> : <div className="card"><p className="muted" style={{ margin: 0 }}>Nobody shares their cycle with you yet. They pick who can see it in their own Cycle settings.</p></div>}
    <p className="muted small">To log your own cycle, switch on Cycle tracking in Settings, Modules.</p>
  </>
}

function PartnerRows({ partners }) {
  return <>{partners.map(p => <Partner key={p.uid} p={p} />)}</>
}

// One person who shares their cycle: where they are, their calendar (tap a day for what it means
// and what to offer), and (when they share how they feel) an idea for each thing they logged today.
function Partner({ p }) {
  const weekStart = weekStartOf(useStore(s => s.S))
  const today = todayISO(), info = PARTNER_PHASE[p.phase], tips = partnerTips(p.today)
  const nextOv = p.fc?.find(f => f.f[1] >= today)
  const next = p.next && (p.next.to !== p.next.from ? `${fmtDate(p.next.from)} to ${fmtDate(p.next.to)}` : fmtDate(p.next.from))
  return <>
    <div className="card cy-hero">
      <div className="cy-eyebrow">{p.name} today</div>
      {p.cycle && <CycleRing cycle={p.cycle} period={p.period} day={p.day} phase={p.phase}>
        <RingMid day={p.day} toNext={p.next ? diffDays(p.next.from, today) : null} />
      </CycleRing>}
      <div className={'cy-phase' + (p.cycle ? ' cy-center' : '')}>{PHASES[p.phase].label}</div>
      <div className={'muted' + (p.cycle ? ' cy-center' : '')}>Cycle day {p.day}</div>
      <p style={{ margin: '10px 0 0' }}>{info.gist}</p>
      {(next || nextOv) && <div className="cy-facts">
        {next && <div><span className="muted">Next period expected</span><b>{next}</b></div>}
        {nextOv && <div><span className="muted">Ovulation{nextOv.l ? '' : ' expected'}</span><b>{fmtDate(nextOv.o)}{nextOv.or && <small>Likely {span({ from: nextOv.or[0], to: nextOv.or[1] })}</small>}</b></div>}
        {nextOv && <div><span className="muted">Fertile window</span><b>{fmtDate(nextOv.f[0])} to {fmtDate(nextOv.f[1])}</b></div>}
      </div>}
    </div>
    {p.cycle && <CycleCalendar today={today} weekStart={weekStart} title={`${p.name}'s calendar`} viewer="partner" legend={p.fc ? ['period', 'period-est', 'period-range', 'ovulation', 'ovulation-est', 'ovulation-range', 'fertile-est'] : ['period', 'period-est', 'period-range']}
      kind={d => partnerKind(p, today, d)} info={d => partnerDayInfo(p, d, today)} ahead={p.fc ? 6 : 2} back={p.fc ? 12 : 6} />}
    {p.today && <Section title={`What ${p.name} logged today`} footer={tips.length ? 'Ideas, not rules. Asking what would help is always a good start.' : null}>
      {tips.length ? tips.map(t => <div className="lrow cy-tip" key={t.kind + t.id}>
        <span className="lrow-i" style={{ '--tint': t.kind === 'mood' ? 'var(--indigo)' : 'var(--pink)' }}><Icon name={t.kind === 'mood' ? 'heart' : t.kind === 'flow' ? 'dot' : 'sparkles'} /></span>
        <span className="lrow-m"><span className="lrow-t">{t.label}</span><span className="lrow-s">{t.text}</span></span>
      </div>) : <div className="lrow"><span className="lrow-m"><span className="lrow-s">Nothing logged yet today.</span></span></div>}
    </Section>}
    <Section title={`Ideas for the ${PHASES[p.phase].label.toLowerCase()}`} footer={p.today ? null : `${p.name} can also share how they feel each day (symptoms and mood) in their own Cycle settings. You then get an idea for each thing they log.`}>
      {info.ideas.map(x => <Row key={x} icon="lightbulb" iconTint="var(--yellow)" title={x} />)}
    </Section>
    <PhaseExplainer phase={p.phase} title={`What is going on in the ${PHASES[p.phase].label.toLowerCase()}`} />
  </>
}

/** The middle of the ring: how far away the next period is, or which day of it this is. */
function RingMid({ day, toNext, late = 0, periodDay }) {
  const [big, sub] = periodDay ? [`Day ${periodDay}`, 'of your period'] : late > 0 ? [String(late), `day${late === 1 ? '' : 's'} late`]
    : toNext == null ? [`Day ${day}`, 'of the cycle'] : toNext <= 0 ? ['Today', 'period expected'] : [String(toNext), `day${toNext === 1 ? '' : 's'} to the next period`]
  return <><b>{big}</b><span>{sub}</span></>
}

/** One phase explained: hormones, how it feels, energy, training, food, mind. */
function PhaseExplainer({ phase, title }) {
  const i = PHASE_INFO[phase]
  return <Section title={title} footer="General information about a typical cycle. Every body is different; a cycle that changes, hurts a lot or bleeds very heavily is worth a talk with a doctor.">
    <div className="cy-info">
      <p className="muted small" style={{ margin: 0 }}>{i.days}</p>
      <dl>
        <dt>What is happening</dt><dd>{i.what}</dd>
        <dt>Common signs</dt><dd>{i.feel}</dd>
        <dt>Energy</dt><dd>{i.energy}</dd>
        <dt>Training</dt><dd>{i.train}</dd>
        <dt>Food</dt><dd>{i.food}</dd>
        <dt>Mood</dt><dd>{i.mind}</dd>
      </dl>
    </div>
  </Section>
}

/** All four phases, folded: tap one to read it. */
function AllPhases({ current }) {
  return <Section title="The four phases">
    {Object.keys(PHASE_INFO).map(k => <details key={k} className="cy-more" open={k === current}>
      <summary className="lrow tap"><span className={'cy-dot cy-seg-' + k} /><span className="lrow-m"><span className="lrow-t">{PHASES[k].label}{k === current ? ' (now)' : ''}</span><span className="lrow-s">{PHASE_INFO[k].days}</span></span><Icon name="chevronDown" className="lrow-c" /></summary>
      <dl className="cy-info"><dt>What is happening</dt><dd>{PHASE_INFO[k].what}</dd><dt>Common signs</dt><dd>{PHASE_INFO[k].feel}</dd><dt>Energy</dt><dd>{PHASE_INFO[k].energy}</dd><dt>Training</dt><dd>{PHASE_INFO[k].train}</dd><dt>Food</dt><dd>{PHASE_INFO[k].food}</dd><dt>Mood</dt><dd>{PHASE_INFO[k].mind}</dd></dl>
    </details>)}
  </Section>
}

const span = r => (r.from === r.to ? fmtDate(r.from) : `${fmtDate(r.from)} to ${fmtDate(r.to)}`)
const days_ = n => `${n} day${n === 1 ? '' : 's'}`
const OV_BY = { logged: 'logged', lh: 'from your LH test', temp: 'from your temperature' }

/** How sure the forecast is, said plainly. */
function sureness(st) {
  if (st.irregular) return { label: 'Low', text: `Your cycles vary by about ${days_(Math.round(st.rawSd))}, so treat the dates as a rough guide.` }
  if (st.n < 3) return { label: 'Low', text: `Based on ${st.n === 0 ? 'no full cycle' : days_(st.n).replace('day', 'cycle')} so far. The ranges are wide until about six cycles are logged.` }
  return { label: st.confidence === 'good' ? 'Good' : 'Fair', text: `Based on your last ${st.n} cycles, which usually land within ${days_(Math.max(1, st.spread))} of the average.` }
}

function Forecast({ fc, st }) {
  const sure = sureness(st)
  return <Section title="Coming months" footer={`Each range is where about 8 in 10 of your periods should start. It leans on your recent cycles, and widens month by month because small differences add up. Ovulation is counted back ${days_(st.luteal)} from the period${st.lutealN ? ' (your own length, from the ovulations you logged)' : ''}; logging ovulation tests makes it sharper. Estimates only, not contraception.`}>
    <Row icon="gauge" iconTint="var(--indigo)" title="How sure is this?" value={sure.label} subtitle={sure.text} />
    {fc.map(f => <Row key={f.k} icon="calendar" iconTint="var(--pink)" title={fmtDate(f.start, true)}
      subtitle={`Likely ${span(f.startRange)}. Ovulation about ${fmtDate(f.ovulation)}${f.ovRange ? ` (${span(f.ovRange)})` : ` (${OV_BY[f.ovBy]})`}.`} value={`±${f.half} d`} />)}
  </Section>
}

/** What your own history says is coming in the next days (lib/cycle.js upcoming). */
function ComingUp({ up }) {
  if (!up) return null
  const when = up.when === 'during' ? 'In the first days of your period' : `In the week before your period${up.toNext ? `, which is about ${days_(up.toNext)} away` : ''}`
  return <Section title="Coming up" footer="From the days you logged before past periods. Plan ahead: the foods and ideas in each day's popover help.">
    <div className="lrow"><span className="lrow-m"><span className="lrow-t">{when}, you usually log:</span>
      <span className="lrow-s">{up.list.map(x => `${x.label} (${x.n} of ${x.of})`).join(', ')}</span></span></div>
  </Section>
}

/** Patterns worth knowing (lib/cycle.js cycleSignals): general information, never a diagnosis. */
function Signals({ list }) {
  if (!list.length) return null
  return <Section title="Worth knowing" footer="General information from your own logs, not a diagnosis.">
    {list.map(x => <div className="lrow cy-tip" key={x.id}><span className="lrow-i" style={{ '--tint': 'var(--orange)' }}><Icon name="info" /></span>
      <span className="lrow-m"><span className="lrow-s">{x.text}</span></span></div>)}
  </Section>
}

/** Waking temperatures of the current cycle, with the cover line once a rise is found. */
function TempChart({ days, start, today, fahrenheit }) {
  const pts = []
  for (let d = start; d <= today; d = addDays(d, 1)) if (days[d]?.temp) pts.push([diffDays(d, start), days[d].temp, d])
  if (pts.length < 3) return null
  const shown = c => (fahrenheit ? Math.round((c * 9 / 5 + 32) * 10) / 10 : c)
  const ov = ovDay(days, addDays(start, 6), addDays(today, 1))
  const ys = pts.map(p => p[1]), lo = Math.min(...ys) - 0.1, hi = Math.max(...ys) + 0.1
  const span = Math.max(diffDays(today, start), 14), W = 320, H = 110
  const x = n => 8 + (n / span) * (W - 16), y = v => 8 + (1 - (v - lo) / (hi - lo)) * (H - 24)
  return <Section title="Waking temperature" footer={ov?.by === 'temp' ? `A rise was found: ovulation about ${fmtDate(ov.date)}. The dashed line is the highest of the six readings before it.` : 'Take it before getting up, at about the same time each day. Three readings above the highest of the six before mark ovulation.'}>
    <div className="card cy-temp-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Waking temperature, ${pts.length} readings this cycle`}>
        {ov?.by === 'temp' && <line x1="8" x2={W - 8} y1={y(ov.cover)} y2={y(ov.cover)} className="cy-cover" />}
        <polyline points={pts.map(p => `${x(p[0])},${y(p[1])}`).join(' ')} className="cy-tline" />
        {pts.map(p => <circle key={p[2]} cx={x(p[0])} cy={y(p[1])} r="3" className="cy-tdot"><title>{`${fmtDate(p[2])}: ${shown(p[1])} ${fahrenheit ? '°F' : '°C'}`}</title></circle>)}
        <text x="8" y={H - 4} className="cy-tlab">Day 1</text>
        <text x={W - 8} y={H - 4} textAnchor="end" className="cy-tlab">{`${shown(lo + 0.1)} to ${shown(hi - 0.1)} ${fahrenheit ? '°F' : '°C'}`}</text>
      </svg>
    </div>
  </Section>
}

const TABS = [{ value: 'today', label: 'Today' }, { value: 'calendar', label: 'Calendar' }, { value: 'insights', label: 'Insights' }]

function Body({ c }) {
  const S = useStore(s => s.S)
  const [q, setQ] = useSearchParams()
  const tab = TABS.some(t => t.value === q.get('tab')) ? q.get('tab') : 'today'
  const raw = c.days, today = todayISO()
  // The period that is still going is filled in (lib/cycle.js ongoing); `raw` is what was logged.
  const { days, open } = useMemo(() => ongoing(raw, today), [raw, today])
  const ps = useMemo(() => periods(days), [days])
  const st = useMemo(() => stats(days), [days])
  const fc = useMemo(() => forecast(days, today), [days, today])
  // Past three cycles ahead the ranges are too wide to draw: only the expected days show there.
  const fcView = useMemo(() => fc.map(f => (f.k < 3 ? f : { ...f, startRange: { from: f.start, to: f.start }, ovRange: null })), [fc])
  const ph = phaseOn(days, today, ps, st)
  // The wearer's own clock decides "today" for reminders and for what a friend sees.
  useEffect(() => { if (TZ && c.prefs.tz !== TZ) savePrefs({ tz: TZ }).catch(() => {}) }, [c.prefs.tz])
  const next = fc[0]
  const toNext = next ? diffDays(next.start, today) : 0
  const put = (d, v) => saveDay(d, v).catch(e => useUI.getState().toast(e.message))
  const startToday = () => put(today, { ...raw[today], flow: 2 })
  const endOn = d => put(d, { ...raw[d], end: 1 })
  return <>
    {ph && <Segmented className="cy-tabs" options={TABS} value={tab} onChange={v => setQ(v === 'today' ? {} : { tab: v }, { replace: true })} />}

    {tab === 'today' && <>
      <div className="card cy-hero">
        {!ph && <>
          <div className="cy-phase">Welcome</div>
          <p className="muted" style={{ margin: '6px 0 12px' }}>Log the first day of your last period and openGym will start estimating your cycle. The more you log, the better it gets.</p>
          <Button variant="primary" onClick={startToday}>Period started today</Button>{' '}
          <Button variant="ghost" onClick={() => importFromFlo(days)}>Import from Flo</Button>
        </>}
        {ph && <>
          <CycleRing cycle={st.cycle} period={st.period} day={ph.day} luteal={st.luteal} phase={ph.phase}>
            <RingMid day={ph.day} toNext={next ? toNext : null} late={ph.late} periodDay={open?.day} />
          </CycleRing>
          <div className="cy-phase cy-center">{PHASES[ph.phase].label}</div>
          <div className="muted cy-center">Cycle day {ph.day}{ph.late > 0 ? `, ${days_(ph.late)} past the expected start. Cycles vary, this can be normal.` : ''}</div>
          <p className="cy-center" style={{ margin: '8px 0 0' }}>{PHASES[ph.phase].tip}</p>
          <div className="cy-facts">
            {next && <div><span className="muted">Next period</span><b>{fmtDate(next.start)}{toNext > 0 ? ` (in ${days_(toNext)})` : ''}<small>{next.half > 0 ? `Likely ${span(next.startRange)}` : ''}</small></b></div>}
            {next && next.ovulation >= today && <div><span className="muted">Ovulation{next.ovLogged ? ` (${OV_BY[next.ovBy]})` : ''}</span><b>{fmtDate(next.ovulation)}{next.ovRange && <small>Likely {span(next.ovRange)}</small>}</b></div>}
            {next && next.fertile.to >= today && <div><span className="muted">Fertile window</span><b>{fmtDate(next.fertile.from)} to {fmtDate(next.fertile.to)}</b></div>}
          </div>
          {open && <div className="cy-open">
            <p style={{ margin: '0 0 8px' }}><b>Period day {open.day}.</b> {open.day < open.L ? `It goes on by itself until ${fmtDate(open.endsOn)}, or until you say it ended.` : open.day === open.L ? 'Today is your usual last day. It stops after today unless you log more flow.' : 'Still going while you log flow. Say when it ended.'}</p>
            <Button size="sm" variant="tinted" onClick={() => endOn(today)}>Period ended today</Button>{' '}
            {open.day > 1 && <Button size="sm" variant="ghost" onClick={() => endOn(addDays(today, -1))}>Ended yesterday</Button>}
          </div>}
          {!days[today]?.flow && <Button size="sm" variant="tinted" onClick={startToday}>Period started today</Button>}
        </>}
        <p className="muted small cy-note">Estimates from your own logs. Not contraception and not medical advice.</p>
      </div>

      <Section title={ph ? `How are you feeling? ${PHASES[ph.phase].label}` : 'How are you feeling?'}>
        <QuickLog day={raw[today]} put={v => put(today, v)} />
        <PhaseAsks date={today} day={raw[today]} />
        <Row icon="pencil" iconTint="var(--pink)" title="More symptoms, fertility signs and notes" accessory="chevron" onClick={() => openSheet(() => <DaySheet date={today} />)} />
      </Section>

      <ComingUp up={upcoming(days, today, ps, fc)} />
      <Signals list={cycleSignals(days, today, ps, st)} />
      {ph && <PhaseExplainer phase={ph.phase} title={`Your ${PHASES[ph.phase].label.toLowerCase()}`} />}
      {c.partners?.length > 0 && <PartnerRows partners={c.partners} />}
    </>}

    {tab === 'calendar' && <>
      <CycleCalendar today={today} weekStart={weekStartOf(S)} viewer="own" legend={['period', 'period-est', 'period-range', 'ovulation', 'ovulation-est', 'ovulation-range', 'fertile-est']}
        kind={d => kindOn(days, d, fcView, ps, st)} info={d => ownDayInfo(days, d, today)}
        logged={d => days[d] && (days[d].sym?.length || days[d].mood?.length || days[d].note)}
        back={Math.max(24, monthsBack(raw, today))}
        onLog={d => openSheet(() => <DaySheet date={d} />)}
        onEnd={d => put(d, { ...raw[d], end: raw[d]?.end ? 0 : 1 })} />
      {fc.length > 0 && <Forecast fc={fc} st={st} />}
    </>}

    {tab === 'insights' && <>
      <History days={days} ps={ps} st={st} />
      {ps.length > 0 && <TempChart days={days} start={ps[ps.length - 1].start} today={today} fahrenheit={S.unit === 'lb'} />}
      <AllPhases current={ph?.phase} />
    </>}
  </>
}

const regularity = st => (!st.known || st.lengths.length < 3 ? 'Too early' : st.spread <= 2 ? 'Regular' : st.spread <= 4 ? 'Fairly regular' : 'Varies')
const trendText = t => (Math.abs(t) < 1 ? 'About the same as the year before' : `${Math.abs(t)} day${Math.abs(t) === 1 ? '' : 's'} ${t > 0 ? 'longer' : 'shorter'} than the year before`)

function History({ days, ps, st }) {
  const by = useMemo(() => patternsByPhase(days, ps, st), [days, ps, st])
  const h = useMemo(() => cycleHistory(ps), [ps])
  if (!ps.length) return <div className="card"><p className="muted" style={{ margin: 0 }}>Log a period, or import your Flo history, to see your averages and patterns here.</p></div>
  const rev = [...ps].reverse()
  const row = (p, i) => <Row key={p.start} title={fmtDate(p.start, true)} subtitle={`${p.len} day${p.len === 1 ? '' : 's'} of bleeding`}
    value={i === 0 ? 'Latest' : `${diffDays(rev[i - 1].start, p.start)}-day cycle`} />
  return <>
    <Section title="Your averages" footer={st.known ? 'From your last cycles, unusual ones left out. Cycles of fewer than 15 or more than 60 days are not counted.' : 'Until two periods are logged, the usual 28-day cycle and 5-day period are used.'}>
      <Tiles items={[
        ['Average cycle', `${st.cycle} days`, st.known && st.min !== st.max ? `${st.min} to ${st.max}` : null],
        ['Average period', `${st.period} day${st.period === 1 ? '' : 's'}`, null],
        ['Regularity', regularity(st), st.known && st.lengths.length >= 3 ? `Within ${days_(st.spread)}` : null],
        ['Periods logged', String(st.count), h ? `Since ${fmtDate(ps[0].start, true)}` : null],
      ]} />
      <Row title="Ovulation, usually around" value={`Cycle day ${st.cycle - st.luteal + 1}`} />
      <Row title="Luteal phase" value={`${st.luteal} days`} subtitle={st.lutealN ? `From ${st.lutealN} ovulation${st.lutealN === 1 ? '' : 's'} you logged` : 'The usual length. Log ovulation tests to learn yours.'} />
    </Section>
    {h && h.list.length >= 3 && <Section title="Every cycle" footer={`Each bar is one cycle. The band is your usual range, where 8 in 10 of your cycles land; orange bars fall outside it.${h.trend != null ? ' The trend compares the median of your last 12 cycles with the 12 before.' : ''}`}>
      <CycleLengths h={h} />
      <Tiles items={[
        ['Usual range', `${h.band[0]} to ${h.band[1]} days`, null],
        ['Shortest, longest', `${h.shortest} and ${h.longest} days`, null],
        ...(h.trend != null ? [['Trend', h.trend === 0 ? 'Steady' : `${h.trend > 0 ? '+' : ''}${h.trend} days`, trendText(h.trend)]] : []),
      ]} />
    </Section>}
    {Object.keys(by).length > 0 && <Section title="What you log, by phase" footer="How often each thing came up on the days you logged anything in that phase, from your whole history.">
      <Patterns by={by} />
    </Section>}
    <Section title="Period history">
      {rev.slice(0, 12).map(row)}
      {rev.length > 12 && <details className="cy-more">
        <summary className="lrow tap"><span className="lrow-m"><span className="lrow-t">All {rev.length} periods</span></span><Icon name="chevronDown" className="lrow-c" /></summary>
        {rev.slice(12).map((p, i) => row(p, i + 12))}
      </details>}
    </Section>
  </>
}
