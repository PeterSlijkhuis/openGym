// Home: today's calories, one tap from the food diary (views/Food.jsx).
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { fmtNum, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { foodsOn, dayTotals, mealsOwed, MEAL_LABEL } from '../lib/food.js'
import { foodGoal } from '../lib/garmin.js'
import { useGarmin } from './useGarmin.js'
import CardHead from './CardHead.jsx'
import Icon from './Icon.jsx'

export default function FoodHomeCard() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const garmin = useGarmin()
  const todayKey = todayISO()
  const eaten = dayTotals(foodsOn(S, todayKey)).kcal
  const goal = foodGoal(S, garmin, todayKey).goal?.kcal || null
  const owed = S.foodNudge !== false ? mealsOwed(S, todayKey, new Date().getHours()) : []
  return <div className="card tap-host">
    <CardHead icon="flame" tint="var(--orange)" eyebrow={t('Food diary')}
      title={goal ? t('{0} of {1} kcal', fmtNum(Math.round(eaten)), fmtNum(goal)) : fmtNum(Math.round(eaten)) + ' kcal'}
      sub={owed.length ? t('Nothing logged for {0} yet', owed.map(m => t(MEAL_LABEL[m]).toLowerCase()).join(', ')) : null}
      open={{ onClick: () => nav('/food') }} action={<Icon name="chevronRight" className="chev" />} />
  </div>
}
