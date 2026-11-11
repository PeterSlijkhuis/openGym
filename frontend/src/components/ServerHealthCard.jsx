import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { fmtDate } from '../lib/format.js'

// Admin screen, Cloudflare deploy only (contrib/cloudflare/status.js): the nightly backup, the
// database size, the cron and each Garmin connection, so a broken one shows here instead of weeks
// later. Anywhere else the route does not exist and the card renders nothing.
const DAY = 864e5
const ago = ts => {
  const m = Math.floor(Math.max(0, Date.now() - ts) / 60000)
  return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.floor(m / 60) + ' h ago' : Math.floor(m / 1440) + ' d ago'
}
const mb = b => (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + ' MB'
const isoOf = ts => new Date(ts).toISOString().slice(0, 10)

/** The rows to show, each { label, value, bad }: pure, so the thresholds are tested. */
export function healthRows(s, now = Date.now()) {
  const rows = []
  const lastBackup = s.backup?.last
  rows.push({
    label: 'Last backup',
    value: lastBackup ? fmtDate(lastBackup) + ' · ' + s.backup.count + ' kept' + (s.backup.bytes != null ? ' · ' + mb(s.backup.bytes) : '') : 'none yet',
    bad: !lastBackup || now - new Date(lastBackup + 'T03:00:00Z').getTime() > 2 * DAY,
  })
  if (s.storage?.bytes != null) rows.push({ label: 'Database', value: mb(s.storage.bytes) + ' in ' + s.storage.files + ' rows, of 5 GB included', bad: s.storage.bytes > 4 * 1024 ** 3 })
  rows.push({ label: 'Reminders cron', value: s.lastWake ? 'ran ' + ago(s.lastWake) : 'no run since the last restart', bad: !!s.lastWake && now - s.lastWake > 20 * 60000 })
  for (const g of s.garmin || []) {
    const soon = g.keyExp && g.keyExp - now < 14 * DAY
    rows.push({
      label: 'Garmin · ' + g.name,
      value: g.error ? g.error : (g.lastSync ? 'synced ' + ago(g.lastSync) : 'not synced yet') + (g.keyExp ? ' · key until ' + fmtDate(isoOf(g.keyExp)) : ''),
      bad: !!g.error || soon || (!!g.lastSync && now - g.lastSync > 3 * 3600000),
    })
  }
  return rows
}

export default function ServerHealthCard({ tick }) {
  const [s, setS] = useState(null)
  useEffect(() => { api('/api/fork/status').then(setS).catch(() => setS(null)) }, [tick])
  if (!s?.backup) return null
  const rows = healthRows(s)
  return <div className="card">
    <h2 style={{ margin: 0 }}>Server health</h2>
    <div className="adm-lead">The Cloudflare side: backups, storage, the cron that sends reminders, and each Garmin connection. Red needs a look.</div>
    {rows.map(r => <div key={r.label} className="row between" style={{ padding: '7px 2px', borderBottom: 'var(--hair) solid var(--sep)', gap: 12 }}>
      <div className="small" style={{ fontWeight: 600 }}>{r.label}</div>
      <div className="small" style={{ textAlign: 'end', color: r.bad ? 'var(--red)' : 'var(--label-2)' }}>{r.value}</div>
    </div>)}
  </div>
}
