// What the Cycle screen explains (ours, not upstream's, plain English): each phase in a few
// short lines, and for a partner the phase in their words plus a concrete idea for every
// symptom, mood and flow the person logged and shared.
//
// General information about a typical cycle, not medical advice: bodies differ, and a cycle
// that changes, hurts a lot or bleeds very heavily is worth a talk with a doctor.
import { SYMPTOMS, MOODS } from './cycle.js'

/** Per phase: what is going on, what many people notice, and ideas for energy, training and food. */
export const PHASE_INFO = {
  menstrual: {
    days: 'Usually days 1 to 5',
    what: 'The lining of the womb sheds. Oestrogen and progesterone are at their lowest, which is what starts the bleed.',
    feel: 'Cramps, a low back ache, tiredness, headaches and looser stools are common, mostly on the first two days.',
    energy: 'Often lowest on days 1 and 2, rising as the bleed eases.',
    train: 'Train by feel. Moving often eases cramps; lighter sets, walks, mobility or yoga are fine choices on heavy days. Many people lift as usual.',
    food: 'Iron-rich food (red meat, lentils, spinach) with vitamin C helps replace what is lost. Warm meals, ginger tea and enough water help many people.',
    mind: 'Some people feel relief as the period starts, others want quiet and rest.',
  },
  follicular: {
    days: 'From the end of the period to around ovulation',
    what: 'A new egg matures. Oestrogen climbs steadily, which builds the lining again and lifts energy and mood.',
    feel: 'Skin often clears, energy and motivation rise, sleep tends to be good.',
    energy: 'Building day by day.',
    train: 'A good stretch to push: heavier sets, new personal records, harder intervals. Recovery is often quick.',
    food: 'Appetite is usually steady. Protein and fresh vegetables support the harder training.',
    mind: 'Often curious, social and up for new things.',
  },
  ovulation: {
    days: 'About 14 days before the next period',
    what: 'A surge of luteinising hormone releases the egg. Oestrogen peaks and testosterone rises a little. This is the most fertile time.',
    feel: 'Clear, stretchy discharge, a twinge low on one side, higher sex drive and sometimes tender breasts.',
    energy: 'Often at its highest.',
    train: 'Many people feel strongest now. Warm up well: some studies suggest joints and ligaments are a little looser around ovulation.',
    food: 'Appetite can dip. Light, fresh meals and plenty of water.',
    mind: 'Confident and talkative for many.',
  },
  luteal: {
    days: 'From ovulation to the next period, about 14 days',
    what: 'Progesterone rises to prepare for a possible pregnancy, then both hormones fall in the last days, which can bring premenstrual symptoms.',
    feel: 'Bloating, tender breasts, cravings, breakouts, lighter sleep and mood swings, mostly in the last week.',
    energy: 'Good early on, lower in the final days.',
    train: 'Body temperature and heart rate run a little higher, so hard sessions can feel harder. Steady work, technique and an easier week before the period are fine.',
    food: 'Appetite rises (the body burns a little more). Complex carbs, magnesium (nuts, seeds, dark chocolate) and less salt can ease bloating and cravings.',
    mind: 'Patience can run shorter and feelings can sit closer to the surface, especially near the end.',
  },
}

/** For a partner: what this phase can mean for them and a few ideas. */
export const PARTNER_PHASE = {
  menstrual: {
    gist: 'Period. Energy is often low and cramps are common, mostly on the first two days.',
    ideas: ['Take over a chore or cook dinner tonight', 'Have a hot water bottle or heat pad ready', 'Keep pads, tampons or painkillers stocked without being asked', 'Plan a quiet evening rather than a busy one'],
  },
  follicular: {
    gist: 'Energy and mood are usually on the way up.',
    ideas: ['Plan something active or new together', 'Train together, this is a good time to push', 'Say yes to plans and spontaneity'],
  },
  ovulation: {
    gist: 'Often a high-energy, confident and social time. Also the most fertile days of the cycle.',
    ideas: ['Plan a date night', 'Compliment and flirt', 'Go out, see friends, do something fun'],
  },
  luteal: {
    gist: 'Hormones rise and then fall before the period. Bloating, cravings, tiredness and a shorter fuse are common, mostly in the last week.',
    ideas: ['Be patient and give the benefit of the doubt', 'Keep favourite snacks in the house', 'Suggest a cosy night in', 'Help keep stress and plans light near the end'],
  },
}

/** For a partner: one concrete thing to offer for each symptom that can be logged (ids in SYMPTOMS). */
export const PARTNER_SYMPTOM = {
  cramps: 'Bring a hot water bottle or heat pad, offer a painkiller and a warm drink, and a gentle lower back or belly rub if wanted. If the pain is severe or new, suggest seeing a doctor.',
  backache: 'Offer a lower back massage or a warm bath, and take over anything that means lifting or bending.',
  headache: 'Dim the lights, keep things quiet, bring water and a painkiller, and a cool cloth for the forehead.',
  tender: 'Be gentle with hugs and the chest. Offer a warm or cool compress, a soft bra-free evening on the sofa, and some chocolate.',
  bloating: 'Make a light, low-salt meal, offer peppermint or ginger tea and comfy clothes, and suggest a slow walk together.',
  nausea: 'Bring ginger tea, plain crackers and small sips of water, keep strong smells out of the kitchen, and cook something plain.',
  fatigue: 'Take a task off the list, offer an early night or a nap, and keep the evening low-key.',
  acne: 'Say nothing about it, unless it is a compliment. Fresh pillowcases help.',
  spotting: 'Keep pads or liners within reach. Spotting outside a period that keeps coming back is worth mentioning to a doctor.',
  clear: 'A sign that ovulation is near. If you are trying for a baby, or trying not to, this is the time to talk about it.',
  creamy: 'Nothing to do: a normal sign of the cycle.',
  twinge: 'A twinge at ovulation is common and usually short. Offer a heat pad; sharp or lasting pain is worth a doctor.',
  cravings: 'Bring the craving: chocolate, something salty or a favourite snack, plus something with protein so the energy lasts.',
  appetite: 'Cook a filling dinner or order in. Hunger really does rise in this phase.',
  insomnia: 'Keep the bedroom cool and dark, offer a magnesium-rich snack or herbal tea, and no screens in bed together.',
  digest: 'Keep the bathroom free, bring water and something easy on the stomach, and skip spicy dinners.',
  libido: 'Higher desire: a good moment for closeness and a date night.',
  libidoLow: 'Lower desire is normal in parts of the cycle. Offer closeness without expectations: cuddling, a massage, a film.',
  sore: 'Offer a massage or a foam-roller session, and help keep the next training day lighter.',
  strong: 'Cheer the training on, or join in: a good day to go for a personal record.',
  weak: 'Training felt heavy. Say it still counts, and suggest an easier session or a walk together.',
}

/** For a partner: what helps with each mood that can be logged (ids in MOODS). */
export const PARTNER_MOOD = {
  happy: 'Enjoy it: plan something fun together.',
  calm: 'A good moment for a long talk or a quiet walk together.',
  energetic: 'Suggest something active: a hike, a workout together, a night out.',
  low: 'Listen more than you fix. A hug, comfort food and some time together help.',
  anxious: 'Stay calm and steady, ask what would help, and take a worry off the list.',
  irritable: 'Do not take it personally. Give some space, pick up chores, avoid tough topics today.',
  sensitive: 'Choose words gently, offer reassurance, and show affection without being asked.',
  foggy: 'Help with reminders and plans, and keep decisions simple today.',
}

/** For a partner: the flow logged today (1 light, 2 medium, 3 heavy). */
export const PARTNER_FLOW = {
  1: 'Light flow today: probably an easy day, still keep supplies within reach.',
  2: 'Medium flow today: a warm drink, a heat pad and a relaxed evening help.',
  3: 'Heavy flow today: tiring. Make an iron-rich dinner, take over chores and keep plans light. Very heavy bleeding, soaking through every hour or two, is worth a doctor.',
}

/** The tips a partner sees for what was shared today: [{ kind, id, label, text }]. */
export function partnerTips(today = {}) {
  const out = []
  if (PARTNER_FLOW[today.flow]) out.push({ kind: 'flow', id: String(today.flow), label: ['', 'Light flow', 'Medium flow', 'Heavy flow'][today.flow], text: PARTNER_FLOW[today.flow] })
  for (const id of today.sym || []) if (PARTNER_SYMPTOM[id]) out.push({ kind: 'sym', id, label: SYMPTOMS[id].label, text: PARTNER_SYMPTOM[id] })
  for (const id of today.mood || []) if (PARTNER_MOOD[id]) out.push({ kind: 'mood', id, label: MOODS[id], text: PARTNER_MOOD[id] })
  return out
}

/** Foods and drinks that tend to ease each symptom (ids in SYMPTOMS). General nutrition, not treatment. */
export const SYMPTOM_FOOD = {
  cramps: 'Magnesium and omega-3: nuts, seeds, dark chocolate, oily fish. Ginger or chamomile tea and a warm meal.',
  backache: 'Anti-inflammatory foods: oily fish, berries, olive oil, leafy greens. Plenty of water.',
  headache: 'Water first. Magnesium (almonds, banana, spinach), regular meals and less caffeine.',
  tender: 'Less caffeine and salt help some people. Fibre-rich meals, oats, flaxseed. The evidence is modest.',
  bloating: 'Less salt and fizzy drinks. Potassium (banana, avocado, spinach), peppermint or fennel tea, eating slowly.',
  nausea: 'Ginger tea or chews, plain crackers, small frequent meals. Cold food smells less.',
  fatigue: 'Iron with vitamin C (lentils, beef, spinach with lemon), protein at every meal, steady carbs, water.',
  acne: 'Steady blood sugar: whole grains and fewer sugary snacks. Zinc (pumpkin seeds, chickpeas) and water.',
  cravings: 'Complex carbs with protein (oats, yoghurt, eggs). A square or two of dark chocolate counts.',
  appetite: 'Protein and fibre fill you for longest: eggs, beans, oats, vegetables.',
  insomnia: 'Magnesium-rich snacks (pumpkin seeds, banana), chamomile or warm milk, caffeine before noon only.',
  digest: 'Fibre (oats, chia, vegetables), water and fermented foods like kefir. Gentle foods on loose days.',
  sore: 'Protein after training (eggs, fish, tofu), tart cherry juice, omega-3 and water.',
  weak: 'Carbs before training (oats, rice, banana) and iron-rich foods.',
}

/** What to eat in each phase to feel well. */
export const PHASE_FOOD = {
  menstrual: ['Iron-rich foods with vitamin C: red meat or lentils with spinach and lemon', 'Warm, soothing meals: soups, stews, ginger or chamomile tea', 'Magnesium and omega-3: dark chocolate, nuts, oily fish', 'Water, since fluid is lost too'],
  follicular: ['Lean protein and fresh vegetables to support harder training', 'Whole grains for steady energy', 'Fermented foods and fibre (yoghurt, kimchi, oats)'],
  ovulation: ['Light, fresh meals: raw vegetables and fruit', 'Fibre and zinc: seeds, chickpeas, whole grains', 'Plenty of water'],
  luteal: ['Complex carbs: oats, sweet potato, brown rice', 'Magnesium: nuts, seeds, dark chocolate, leafy greens', 'Less salt and alcohol to ease bloating', 'Calcium and vitamin B6 (yoghurt, banana, chickpeas, salmon) help some people with premenstrual symptoms'],
}
