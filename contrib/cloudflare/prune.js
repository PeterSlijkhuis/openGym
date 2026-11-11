// What an account leaves outside the api's own files (garmin.js, cycle.js) goes with the account:
// the cron removes garmin/<uid>.json and cycle/<uid>.json once db.json no longer lists that uid.
// The api deletes the profile itself; it does not know about these folders.
import fs from 'node:fs';
import path from 'node:path';

export const FOLDERS = ['garmin', 'cycle'];

/** Removes the files of accounts that no longer exist. Returns the removed paths (relative). */
export function prune(dataDir) {
  let users;
  try { users = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8')).users; } catch { return []; }
  // An unreadable or empty user list is a broken db.json, not "everyone left": touch nothing.
  if (!Array.isArray(users) || !users.length) return [];
  const known = new Set(users.map(u => String(u?.id || '').replace(/[^\w-]/g, '_')));
  const gone = [];
  for (const folder of FOLDERS) {
    let files = [];
    try { files = fs.readdirSync(path.join(dataDir, folder)); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.json') || known.has(f.slice(0, -5))) continue;
      fs.rmSync(path.join(dataDir, folder, f), { force: true });
      gone.push(folder + '/' + f);
    }
  }
  return gone;
}
