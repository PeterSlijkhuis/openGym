// "Make it yours": a few questions before the first tour (Tour.jsx shows it ahead of the "How much
// app" card), and again from Settings → About & updates. Every screen can be skipped, and every
// answer is an ordinary setting written when its screen is confirmed (lib/onboarding.js), so all
// of it stays editable in Settings afterwards. Lives in the tour's chunk and reuses its card look.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { LANGS, dateLocale } from '../lib/i18n-core.js'
import { weekStartOf, MONDAY, SUNDAY } from '../lib/format.js'
import { sexOf } from '../lib/strength-level.js'
import { ACTIVITY, ACTIVITY_LABEL } from '../lib/nutrition.js'
import { isOn } from '../lib/modules.js'
import { figureOf } from '../lib/exercises.js'
import { applyYou, applyGoal, kitProfile, planFor } from '../lib/onboarding.js'
import { loadStarterPlan } from '../sheets.jsx'
import { Button, NumberField, Segmented, Switch, Row } from './ui.jsx'

const LB = 0.45359237
const RATES = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5]
const STEPS = ['basics', 'you', 'goal', 'train', 'connect']
const dayName = d => {
  try { return new Intl.DateTimeFormat(dateLocale(), { weekday: 'short' }).format(new Date(2024, 0, 7 + d)) } catch { return String(d) }
}

export default function Onboarding({ onDone, onLeave }) {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const cardRef = useRef(null)
  const [i, setI] = useState(0)
  const [a, setA] = useState(() => ({
    lang: S.lang || '', unit: S.unit || 'kg', weekStart: weekStartOf(S),
    sex: sexOf(S) || '', figure: figureOf(S), cycle: false,
    born: Number(S.birthYear) > 0 ? Number(S.birthYear) : null, cm: S.foodPlan?.heightCm || null, weight: null,
    rate: Number.isFinite(S.foodPlan?.rate) ? S.foodPlan.rate : null, activity: S.foodPlan?.activity || 'light', food: false,
    days: [], level: 'new', kit: 'gym', plan: !S.routines.length,
  }))
  const set = k => v => setA(o => ({ ...o, [k]: v }))
  useEffect(() => { cardRef.current?.focus() }, [i])

  const step = STEPS[i]
  const next = () => (i + 1 < STEPS.length ? setI(i + 1) : onDone())
  const save = () => {
    if (step === 'basics') {
      update(s => { if (a.lang && a.lang !== s.lang) { s.lang = a.lang; s.langAuto = false }; s.weekStart = a.weekStart })
      if (a.unit !== (S.unit || 'kg')) useStore.getState().setUnit(a.unit)
    }
    if (step === 'you') update(s => applyYou(s, { ...a, sex: a.sex || null, figure: a.sex ? a.figure : null, weight: a.weight, cycle: a.sex === 'female' && a.cycle }))
    if (step === 'goal') update(s => applyGoal(s, { rate: a.rate ?? NaN, activity: a.rate == null ? null : a.activity, food: a.food }))
    if (step === 'train') {
      let prof = null
      update(s => { prof = kitProfile(s, a.kit, a.kit === 'dumbbells' ? t('Home dumbbells') : t('Body weight only')) })
      if (a.plan && a.days.length) loadStarterPlan(planFor(a.days.length, a.level, a.kit), prof, [...a.days].sort((x, y) => x - y))
    }
    next()
  }
  // A shortcut on the last screen: the questions are done, the tour can wait for Settings.
  const go = path => { onLeave(); nav(path) }

  const wt = v => a.unit === 'lb' ? Math.round(v / LB * 10) / 10 + ' lb' : v + ' kg'
  const rateLabel = r => r < 0 ? t('Lose {0} a week', wt(-r)) : r > 0 ? t('Gain {0} a week', wt(r)) : t('Keep my weight')
  const num = (label, k, unit) => <label className="measure-field">
    <span>{label}</span>
    <span className="measure-input"><NumberField nullable decimal={k === 'weight'} value={a[k]} onChange={set(k)} /><i>{unit}</i></span>
  </label>
  const days = [1, 2, 3, 4, 5, 6, 0]
  if (a.weekStart === SUNDAY) days.unshift(days.pop())

  const body = {
    basics: () => <>
      <h2 id="ob-t">{t('Make it yours')}</h2>
      <p>{t('A few quick questions to set the app up for you. Skip any of them, change all of them later in Settings.')}</p>
      <label className="ob-field"><span>{t('Language')}</span>
        <select value={a.lang} onChange={e => set('lang')(e.target.value)}>
          {!a.lang && <option value="">{t('Automatic')}</option>}
          {Object.entries(LANGS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select></label>
      <div className="ob-field"><span>{t('Weight unit')}</span>
        <Segmented value={a.unit} onChange={set('unit')} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} /></div>
      <div className="ob-field"><span>{t('Week starts on')}</span>
        <Segmented value={a.weekStart} onChange={set('weekStart')} options={[{ value: MONDAY, label: t('Monday') }, { value: SUNDAY, label: t('Sunday') }]} /></div>
    </>,
    you: () => <>
      <h2 id="ob-t">{t('About you')}</h2>
      <p>{t('Used for strength levels, the calorie target and the drawings. It stays in your own data.')}</p>
      <Segmented value={a.sex} onChange={v => setA(o => ({ ...o, sex: v, figure: v || o.figure }))}
        options={[{ value: 'female', label: t('Female') }, { value: 'male', label: t('Male') }, { value: '', label: t('Rather not say') }]} />
      {a.sex && <div className="ob-field"><span>{t('Exercise drawings')}</span>
        <Segmented value={a.figure} onChange={set('figure')} options={[{ value: 'female', label: t('Female') }, { value: 'male', label: t('Male') }]} /></div>}
      {a.sex === 'female' && !isOn(S, 'cycle') && <div className="ob-field ob-sw"><span>{t('Turn on cycle tracking')}<small>{t('Private to you unless you share.')}</small></span>
        <Switch checked={a.cycle} onChange={set('cycle')} /></div>}
      <div className="measure-form ob-nums">
        {num(t('Year of birth'), 'born', '')}
        {num(t('Height'), 'cm', 'cm')}
        {num(t('Weight today'), 'weight', a.unit)}
      </div>
    </>,
    goal: () => <>
      <h2 id="ob-t">{t('Your goal')}</h2>
      <p>{t('Sets the daily calorie and macro target in the food diary.')}</p>
      <label className="ob-field"><span>{t('Weekly goal')}</span>
        <select value={a.rate ?? ''} onChange={e => set('rate')(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">{t('Not now')}</option>
          {RATES.map(r => <option key={r} value={r}>{rateLabel(r)}</option>)}
        </select></label>
      {a.rate != null && <label className="ob-field"><span>{t('How active are you?')}</span>
        <select value={a.activity} onChange={e => set('activity')(e.target.value)}>
          {Object.keys(ACTIVITY).map(k => <option key={k} value={k}>{t(ACTIVITY_LABEL[k])}</option>)}
        </select></label>}
      {a.rate != null && !isOn(S, 'food') && <div className="ob-field ob-sw"><span>{t('Count calories in the food diary')}</span>
        <Switch checked={a.food} onChange={set('food')} /></div>}
    </>,
    train: () => <>
      <h2 id="ob-t">{t('Your training')}</h2>
      <p>{t('Which days do you want to train?')}</p>
      <div className="chips ob-days">
        {days.map(d => <button key={d} type="button" aria-pressed={a.days.includes(d)} className={'chip nocap' + (a.days.includes(d) ? ' on' : '')}
          onClick={() => set('days')(a.days.includes(d) ? a.days.filter(x => x !== d) : [...a.days, d])}>{dayName(d)}</button>)}
      </div>
      <div className="ob-field"><span>{t('Experience')}</span>
        <Segmented value={a.level} onChange={set('level')} options={[{ value: 'new', label: t('New') }, { value: 'some', label: t('Some') }, { value: 'experienced', label: t('Experienced') }]} /></div>
      <div className="ob-field"><span>{t('Equipment')}</span>
        <Segmented value={a.kit} onChange={set('kit')} options={[{ value: 'gym', label: t('Gym') }, { value: 'dumbbells', label: t('Dumbbells') }, { value: 'bodyweight', label: t('Body weight') }]} /></div>
      {a.days.length > 0 && <div className="ob-field ob-sw"><span>{t('Put a starter plan on these days')}<small>{t('Your own routines stay. Change it any time in Plan.')}</small></span>
        <Switch checked={a.plan} onChange={set('plan')} /></div>}
    </>,
    connect: () => <>
      <h2 id="ob-t">{t('Connect more')}</h2>
      <p>{t('Optional, and each one is also in Settings.')}</p>
      <div className="ob-rows">
        {isOn(S, 'health') && <Row icon="watch" iconTint="var(--indigo)" title="Garmin Connect" accessory="chevron" onClick={() => go('/garmin')} />}
        <Row icon="bell" iconTint="var(--red)" title={t('Reminders')} accessory="chevron" onClick={() => go('/settings/reminders')} />
        {(isOn(S, 'cycle') || a.cycle) && <Row icon="moon" iconTint="var(--pink)" title={t('Cycle tracking')} subtitle={t('Choose who sees your phase')} accessory="chevron" onClick={() => go('/cycle')} />}
      </div>
    </>,
  }[step]

  return <div className="tour tour-ask">
    <div className="tour-block tour-dim" />
    <div className="tour-card tour-center ob-card" ref={cardRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ob-t"
      onKeyDown={e => { if (e.key === 'Escape') onDone() }}>
      <div className="tour-top">
        <span className="tour-count">{t('{0} of {1}', i + 1, STEPS.length)}</span>
        <button type="button" className="tour-skip" onClick={onDone}>{t('Skip all')}</button>
      </div>
      {body()}
      <div className="tour-acts">
        {i > 0 && <Button onClick={() => setI(i - 1)}>{t('Back')}</Button>}
        <Button onClick={next}>{t('Skip')}</Button>
        <Button variant="primary" onClick={save}>{i + 1 < STEPS.length ? t('Next') : t('Done')}</Button>
      </div>
    </div>
  </div>
}
