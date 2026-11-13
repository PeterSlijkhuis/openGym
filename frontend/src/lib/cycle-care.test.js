import { describe, it, expect } from 'vitest'
import { SYMPTOMS, MOODS, PHASES } from './cycle.js'
import { PHASE_INFO, PARTNER_PHASE, PARTNER_SYMPTOM, PARTNER_MOOD, partnerTips } from './cycle-care.js'

describe('cycle care', () => {
  it('explains every phase and has partner advice for every symptom and mood', () => {
    for (const p of Object.keys(PHASES)) {
      expect(Object.keys(PHASE_INFO[p])).toEqual(['days', 'what', 'feel', 'energy', 'train', 'food', 'mind'])
      expect(PARTNER_PHASE[p].ideas.length).toBeGreaterThan(1)
    }
    expect(Object.keys(PARTNER_SYMPTOM).sort()).toEqual(Object.keys(SYMPTOMS).sort())
    expect(Object.keys(PARTNER_MOOD).sort()).toEqual(Object.keys(MOODS).sort())
  })
  it('turns what was shared today into tips, flow first', () => {
    const t = partnerTips({ flow: 3, sym: ['tender', 'nope'], mood: ['low'] })
    expect(t.map(x => x.label)).toEqual(['Heavy flow', 'Tender breasts', 'Low'])
    expect(t[1].text).toMatch(/compress/)
    expect(partnerTips()).toEqual([])
  })
})
