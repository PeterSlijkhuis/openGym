import { describe, it, expect } from 'vitest'
import { healthRows } from './ServerHealthCard.jsx'

const NOW = Date.parse('2026-11-11T12:00:00Z')
const base = { backup: { last: '2026-11-11', count: 3, bytes: 2048 }, storage: { files: 9, bytes: 4096 }, lastWake: NOW - 60000, garmin: [] }

describe('healthRows', () => {
  it('a fresh backup, a recent cron and a synced Garmin are all fine', () => {
    const rows = healthRows({ ...base, garmin: [{ name: 'Peter', lastSync: NOW - 600000, keyExp: NOW + 90 * 864e5, error: null }] }, NOW)
    expect(rows.map(r => r.bad)).toEqual([false, false, false, false])
  })
  it('flags a missing or stale backup, a stalled cron, an expiring key and a Garmin error', () => {
    const rows = healthRows({
      ...base,
      backup: { last: '2026-11-08', count: 1, bytes: 1 },
      lastWake: NOW - 30 * 60000,
      garmin: [{ name: 'A', lastSync: NOW, keyExp: NOW + 5 * 864e5 }, { name: 'B', error: 'Garmin no longer accepts this key.' }],
    }, NOW)
    expect(rows.filter(r => r.bad).map(r => r.label)).toEqual(['Last backup', 'Reminders cron', 'Garmin · A', 'Garmin · B'])
    expect(healthRows({ ...base, backup: { last: null, count: 0 } }, NOW)[0]).toMatchObject({ value: 'none yet', bad: true })
  })
})
