import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catchAdminSocket, recoverRoute } from './recover.js';

const SECRET = 'x'.repeat(40);
const req = (auth, body = { name: 'Peter' }) => new Request('https://gym/api/fork/recover', {
  method: 'POST', headers: auth ? { authorization: 'Bearer ' + auth } : {}, body: JSON.stringify(body),
});

test('catches the api socket handler and talks to it like recover.js', async () => {
  const net = { createServer: () => { throw new Error('real one called'); } };
  const real = net.createServer;
  // What admin-socket.js does with a connection: read one line, answer one line.
  const ask = await catchAdminSocket(net, async () => {
    const srv = net.createServer(conn => {
      conn.setTimeout(5000, () => conn.destroy());
      conn.on('error', () => {});
      conn.on('data', async chunk => conn.end(JSON.stringify({ echo: JSON.parse(chunk), code: 'C0DE' }) + '\n'));
    });
    srv.on('error', () => {}); srv.listen('/x'); srv.unref();
  });
  assert.equal(net.createServer, real);
  assert.deepEqual(await ask({ cmd: 'recover', name: 'Peter' }), { echo: { cmd: 'recover', name: 'Peter' }, code: 'C0DE' });
});

test('no handler when the api never opened its socket', async () => {
  assert.equal(await catchAdminSocket({ createServer() {} }, async () => {}), null);
});

test('the route is a 404 without a long secret or with the wrong one', async () => {
  const ask = async () => ({ code: 'C' });
  assert.equal((await recoverRoute(req(SECRET), { secret: undefined, ask })).status, 404);
  assert.equal((await recoverRoute(req('short'), { secret: 'short', ask })).status, 404);
  assert.equal((await recoverRoute(req('y'.repeat(40)), { secret: SECRET, ask })).status, 404);
  assert.equal((await recoverRoute(req(null), { secret: SECRET, ask })).status, 404);
});

test('with the secret it returns the code the api made', async () => {
  let seen;
  const res = await recoverRoute(req(SECRET), { secret: SECRET, ask: async m => { seen = m; return { name: 'Peter', code: 'ABC', expires: 1 }; } });
  assert.equal(res.status, 200);
  assert.deepEqual(seen, { cmd: 'recover', name: 'Peter' });
  assert.equal((await res.json()).code, 'ABC');
});
