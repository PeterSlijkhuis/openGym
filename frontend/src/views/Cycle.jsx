// Cycle tracking: log periods and symptoms, see where you are in the cycle, the estimated next
// period and fertile window, a calendar and your own averages. Private to the account unless it
// picks who may see its phase (components/CycleSheets.jsx). Plain English: ours, not upstream's.
// Every date and phase is an ESTIMATE from the person's own logs: not contraception, not medical advice.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { fmtDate, todayISO, weekStartOf, DAYS } from '../lib/format.js'
import { PHASES, SYMPTOMS, addDays, diffDays, forecast, kindOn, monthGrid, periods, phaseOn, stats, symptomsByPhase } from '../lib/cycle.js'
import { PHASE_INFO, PARTNER_PHASE, partnerTips } from '../lib/cycle-care.js'
import { useCycle, saveDay, savePrefs, refreshCycle } from '../components/useCycle.js'
import { DaySheet, CycleSettings, PhaseAsks } from '../components/CycleSheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button, Row, Section } from '../components/ui.jsx'
import { isOn } from '../lib/modules.js'

const openSheet = render => useUI.getState().openSheet(render)
const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return null } })()

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

// One person who shares their cycle: their phase in plain words, ideas for that phase, and (when
// they share how they feel) one concrete idea for each thing they logged today.
function Partner({ p }) {
  const weekStart = weekStartOf(useStore(s => s.S))
  const today = todayISO(), info = PARTNER_PHASE[p.phase], tips = partnerTips(p.today)
  const next = p.next && (p.next.to !== p.next.from ? `${fmtDate(p.next.from)} to ${fmtDate(p.next.to)}` : fmtDate(p.next.from))
  return <>
    <div className="card cy-hero">
      <div className="cy-eyebrow">{p.name} today</div>
      <div className="cy-phase">{PHASES[p.phase].label}</div>
      <div className="muted">Cycle day {p.day}</div>
      {p.cycle && <CycleTrack cycle={p.cycle} period={p.period} day={p.day} />}
      <p style={{ margin: '10px 0 0' }}>{info.gist}</p>
      {next && <div className="cy-facts"><div><span className="muted">Next period expected</span><b>{next}</b></div></div>}
    </div>
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
    {p.cycle && <Calendar today={today} weekStart={weekStart} title={`${p.name}'s calendar`} legend={['period', 'period-est']}
      kind={d => partnerKind(p, today, d)} />}
  </>
}

// The partner calendar: the current period (when in one) and the expected next one. The fertile
// window is never shared, so it does not show.
function partnerKind(p, today, d) {
  const start = addDays(today, -(p.day - 1))
  if (p.phase === 'menstrual' && d >= start && d < addDays(start, p.period || 5)) return d <= today ? 'period' : 'period-est'
  if (p.next && d >= p.next.from && d <= addDays(p.next.to, (p.period || 5) - 1)) return 'period-est'
  return null
}

/** The cycle as a bar of its four phases, with today marked. */
function CycleTrack({ cycle, period = 5, day }) {
  const ov = cycle - 14
  const parts = [['menstrual', period], ['follicular', Math.max(1, ov - 1 - period)], ['ovulation', 3], ['luteal', Math.max(1, cycle - ov - 1)]]
  const at = Math.min(100, ((day - 0.5) / cycle) * 100)
  return <div className="cy-track" aria-hidden="true">
    <div className="cy-track-bar">{parts.map(([k, n]) => <span key={k} className={'cy-seg cy-seg-' + k} style={{ flexGrow: n }} />)}</div>
    <i className="cy-track-at" style={{ insetInlineStart: at + '%' }} />
    <div className="cy-track-l"><span>Day 1</span><span>Ovulation ~{ov}</span><span>Day {cycle}</span></div>
  </div>
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
    {Object.keys(PHASE_INFO).map(k => <details key={k} className="cy-more" open={false}>
      <summary className="lrow tap"><span className={'cy-dot cy-seg-' + k} /><span className="lrow-m"><span className="lrow-t">{PHASES[k].label}{k === current ? ' (now)' : ''}</span><span className="lrow-s">{PHASE_INFO[k].days}</span></span><Icon name="chevronDown" className="lrow-c" /></summary>
      <dl className="cy-info"><dt>What is happening</dt><dd>{PHASE_INFO[k].what}</dd><dt>Common signs</dt><dd>{PHASE_INFO[k].feel}</dd><dt>Training</dt><dd>{PHASE_INFO[k].train}</dd><dt>Food</dt><dd>{PHASE_INFO[k].food}</dd></dl>
    </details>)}
  </Section>
}

function Body({ c }) {
  const S = useStore(s => s.S)
  const days = c.days, today = todayISO()
  const ps = useMemo(() => periods(days), [days])
  const st = useMemo(() => stats(days), [days])
  const fc = useMemo(() => forecast(days), [days])
  const ph = phaseOn(days, today, ps, st)
  // The wearer's own clock decides "today" for reminders and for what a friend sees.
  useEffect(() => { if (TZ && c.prefs.tz !== TZ) savePrefs({ tz: TZ }).catch(() => {}) }, [c.prefs.tz])
  const next = fc[0]
  const range = next && st.spread > 0 ? `${fmtDate(addDays(next.start, -st.spread))} to ${fmtDate(addDays(next.start, st.spread))}` : next && fmtDate(next.start)
  const toNext = next ? diffDays(next.start, today) : 0
  const startToday = () => saveDay(today, { ...days[today], flow: 2 }).catch(e => useUI.getState().toast(e.message))
  return <>
    <div className="card cy-hero">
      {!ph && <>
        <div className="cy-phase">Welcome</div>
        <p className="muted" style={{ margin: '6px 0 12px' }}>Log the first day of your last period and openGym will start estimating your cycle. The more you log, the better it gets.</p>
        <Button variant="primary" onClick={startToday}>Period started today</Button>
      </>}
      {ph && <>
        <div className="cy-eyebrow">Today</div>
        <div className="cy-phase">{PHASES[ph.phase].label}</div>
        <div className="muted">Cycle day {ph.day}{ph.late > 0 ? `, ${ph.late} day${ph.late === 1 ? '' : 's'} past the expected start. Cycles vary, this can be normal.` : ''}</div>
        <CycleTrack cycle={st.cycle} period={st.period} day={ph.day} />
        <p style={{ margin: '10px 0 0' }}>{PHASES[ph.phase].tip}</p>
        <div className="cy-facts">
          {next && ph.late === 0 && <div><span className="muted">Next period</span><b>{range}{toNext > 0 ? ` (in ${toNext} day${toNext === 1 ? '' : 's'})` : ''}</b></div>}
          {next && ph.late === 0 && next.fertile.to >= today && <div><span className="muted">Fertile window</span><b>{fmtDate(next.fertile.from)} to {fmtDate(next.fertile.to)}</b></div>}
          {next && ph.late === 0 && next.ovulation >= today && <div><span className="muted">Ovulation{next.ovLogged ? ' (logged)' : ''}</span><b>{fmtDate(next.ovulation)}</b></div>}
        </div>
        {!days[today]?.flow && <Button size="sm" variant="tinted" onClick={startToday}>Period started today</Button>}
      </>}
      <p className="muted small cy-note">Estimates from your own logs. Not contraception and not medical advice.</p>
    </div>

    <Section title={ph ? `How are you feeling? ${PHASES[ph.phase].label}` : 'How are you feeling?'}>
      <PhaseAsks date={today} day={days[today]} />
      <Row icon="pencil" iconTint="var(--pink)" title="Flow, mood, more symptoms and notes" accessory="chevron" onClick={() => openSheet(() => <DaySheet date={today} />)} />
    </Section>

    {ph && <PhaseExplainer phase={ph.phase} title={`Your ${PHASES[ph.phase].label.toLowerCase()}`} />}
    <Calendar today={today} weekStart={weekStartOf(S)} legend={['period', 'period-est', 'ovulation', 'ovulation-est', 'fertile-est']}
      kind={d => kindOn(days, d, fc, ps, st)} logged={d => days[d] && (days[d].sym?.length || days[d].mood?.length || days[d].note)}
      onPick={d => openSheet(() => <DaySheet date={d} />)} />
    <History days={days} ps={ps} st={st} />
    <AllPhases current={ph?.phase} />
    {c.partners?.length > 0 && <PartnerRows partners={c.partners} />}
  </>
}

const KIND = {
  period: 'Period', 'period-est': 'Expected period', ovulation: 'Ovulation', 'ovulation-est': 'Expected ovulation', 'fertile-est': 'Fertile window',
}

// A month of the cycle. `kind(date)` colours a day (lib/cycle.js kindOn): logged days solid,
// estimates pastel with a dotted ring. `onPick` makes past days tappable (own calendar only).
function Calendar({ today, weekStart = 1, kind, logged = () => false, onPick, legend, title }) {
  const now = new Date(today + 'T00:00:00')
  const [ym, setYm] = useState([now.getFullYear(), now.getMonth()])
  const grid = monthGrid(ym[0], ym[1], weekStart)
  const go = n => { const d = new Date(ym[0], ym[1] + n, 1); setYm([d.getFullYear(), d.getMonth()]) }
  const heads = [...DAYS.slice(weekStart), ...DAYS.slice(0, weekStart)]
  return <Section title={title}><div className="card cy-cal">
    <div className="hdr" style={{ marginBottom: 0 }}>
      <button className="iconbtn" onClick={() => go(-1)} aria-label="Previous month"><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>{new Date(ym[0], ym[1], 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
      <button className="iconbtn" onClick={() => go(1)} aria-label="Next month"><Icon name="chevronRight" /></button>
    </div>
    <div className="cal-grid">
      {heads.map((h, i) => <div key={i} className="cal-h">{h}</div>)}
      {grid.flat().map((d, i) => {
        if (!d) return <div key={i} />
        const k = kind(d), cls = 'cal-d' + (k ? ' cy-' + k : '') + (d === today ? ' today' : '') + (d > today ? ' later' : '')
        const label = fmtDate(d, true) + (k ? ', ' + KIND[k] : '')
        if (!onPick) return <div key={i} className={cls} aria-label={label}>{Number(d.slice(8))}<i /></div>
        return <button key={i} className={cls} disabled={d > today} aria-label={label} onClick={() => onPick(d)}>
          {Number(d.slice(8))}<i className={logged(d) ? 'done' : ''} />
        </button>
      })}
    </div>
    <div className="cal-legend cy-legend">
      {legend.map(k => <span key={k}><i className={'cy-' + k} />{KIND[k]}</span>)}
    </div>
    {onPick && <p className="muted small" style={{ margin: '10px 0 0', textAlign: 'center' }}>Solid days are logged, dotted days are estimates. Tap a day to log it.</p>}
  </div></Section>
}

function History({ days, ps, st }) {
  const by = useMemo(() => symptomsByPhase(days), [days])
  if (!ps.length) return null
  const lens = st.lengths.slice(-6)
  const top = Math.max(...lens, st.cycle)
  return <>
    <Section title="Your averages" footer={st.known ? 'From your last six cycles. Cycles of fewer than 15 or more than 60 days are left out.' : 'Until two periods are logged, the usual 28-day cycle and 5-day period are used.'}>
      <Row title="Average cycle" value={`${st.cycle} days`} subtitle={st.known && st.min !== st.max ? `Between ${st.min} and ${st.max}` : null} />
      <Row title="Average period" value={`${st.period} day${st.period === 1 ? '' : 's'}`} />
      <Row title="Cycle regularity" value={!st.known || st.lengths.length < 3 ? 'Too early to say' : st.spread <= 2 ? 'Regular' : st.spread <= 4 ? 'Fairly regular' : 'Varies'}
        subtitle={st.known && st.lengths.length >= 3 ? `Cycles usually within ${st.spread} day${st.spread === 1 ? '' : 's'} of the average` : null} />
      <Row title="Ovulation, usually around" value={`Cycle day ${st.cycle - 14}`} />
      <Row title="Periods logged" value={String(st.count)} />
    </Section>
    <Section title="Period history">
      {ps.slice(-12).reverse().map((p, i, a) => {
        const nextStart = i === 0 ? null : a[i - 1].start
        return <Row key={p.start} title={fmtDate(p.start, true)} subtitle={`${p.len} day${p.len === 1 ? '' : 's'} of bleeding`}
          value={nextStart ? `${diffDays(nextStart, p.start)}-day cycle` : 'Latest'} />
      })}
    </Section>
    {lens.length > 0 && <Section title="Recent cycles">
      {lens.map((n, i) => {
        const p = ps[ps.length - lens.length - 1 + i]
        return <div className="lrow" key={i}>
          <span className="lrow-m"><span className="lrow-t">{fmtDate(p.start)}</span>
            <span className="cy-bar"><span style={{ width: `${(n / top) * 100}%` }} /></span></span>
          <span className="lrow-v">{n} days</span>
        </div>
      })}
    </Section>}
    {Object.keys(by).length > 0 && <Section title="What you log most, by phase">
      {Object.entries(by).map(([phase, list]) => <Row key={phase} title={PHASES[phase].label} subtitle={list.map(([id, n]) => `${SYMPTOMS[id].label} (${n})`).join(', ')} />)}
    </Section>}
  </>
}
