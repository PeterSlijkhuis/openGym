import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prune } from './prune.js';

function data(users) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-'));
  if (users) fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify({ users }));
  for (const f of ['garmin', 'cycle']) {
    fs.mkdirSync(path.join(dir, f));
    for (const uid of ['a1', 'gone']) fs.writeFileSync(path.join(dir, f, uid + '.json'), '{}');
  }
  return dir;
}

test('removes the Garmin and cycle files of deleted accounts only', () => {
  const dir = data([{ id: 'a1' }]);
  assert.deepEqual(prune(dir).sort(), ['cycle/gone.json', 'garmin/gone.json']);
  assert.ok(fs.existsSync(path.join(dir, 'garmin/a1.json')));
  assert.ok(fs.existsSync(path.join(dir, 'cycle/a1.json')));
});

test('a missing or empty user list removes nothing', () => {
  for (const dir of [data(null), data([])]) {
    assert.deepEqual(prune(dir), []);
    assert.equal(fs.readdirSync(path.join(dir, 'garmin')).length, 2);
  }
});
