// GET /api/fork/status, admins only: is the Cloudflare side healthy, without opening the dashboard.
// The last nightly copy in R2 (backup.js), how much D1 holds, when the cron last woke the object,
// and per account when Garmin last answered and when its key runs out. No health data, no keys.
import fs from 'node:fs';
import path from 'node:path';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

export async function serverStatus({ env, dataDir, user, lastWake = null }) {
  if (!user?.admin) return json({ error: 'admins only' }, 403);
  const { objects = [] } = await env.MEDIA.list({ prefix: 'backups/' }).catch(() => ({}));
  const days = objects.map(o => o.key.slice(8, 18)).sort();
  const last = objects.find(o => o.key.slice(8, 18) === days.at(-1));
  const row = await env.DB.prepare('SELECT count(*) AS n, sum(length(body)) AS bytes FROM files').first().catch(() => null);
  const garmin = (readJson(path.join(dataDir, 'db.json'))?.users || []).flatMap(u => {
    const rec = readJson(path.join(dataDir, 'garmin', String(u.id).replace(/[^\w-]/g, '_') + '.json'));
    return rec?.key ? [{ name: u.name || '', lastSync: rec.lastSync || null, keyExp: rec.keyExp || null, error: rec.error || null }] : [];
  });
  return json({
    backup: { last: days.at(-1) || null, count: days.length, bytes: last?.size ?? null },
    storage: { files: row?.n ?? null, bytes: row?.bytes ?? null },
    lastWake,
    garmin,
  });
}
