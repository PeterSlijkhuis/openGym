import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serverStatus } from './status.js';

const env = {
  MEDIA: { list: async () => ({ objects: [{ key: 'backups/2026-11-10.json', size: 10 }, { key: 'backups/2026-11-11.json', size: 12 }] }) },
  DB: { prepare: () => ({ first: async () => ({ n: 7, bytes: 3000 }) }) },
};

function data() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'status-'));
  fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify({ users: [{ id: 'a1', name: 'Peter' }, { id: 'b2', name: 'Valeria' }] }));
  fs.mkdirSync(path.join(dir, 'garmin'));
  fs.writeFileSync(path.join(dir, 'garmin/a1.json'), JSON.stringify({ key: 'sealed', lastSync: 5, keyExp: 9, days: { secret: 1 } }));
  return dir;
}

test('admins get backups, storage and Garmin sync times, without health data', async () => {
  const res = await serverStatus({ env, dataDir: data(), user: { admin: true }, lastWake: 1 });
  const body = await res.json();
  assert.deepEqual(body.backup, { last: '2026-11-11', count: 2, bytes: 12 });
  assert.deepEqual(body.storage, { files: 7, bytes: 3000 });
  assert.deepEqual(body.garmin, [{ name: 'Peter', lastSync: 5, keyExp: 9, error: null }]);
  assert.equal(body.lastWake, 1);
});

test('everyone else is refused', async () => {
  const res = await serverStatus({ env, dataDir: data(), user: { admin: false } });
  assert.equal(res.status, 403);
});
