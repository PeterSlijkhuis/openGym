// The owner's way back in on Workers. Upstream's `node api/recover.js` asks the running api over a
// Unix socket (api/admin-socket.js), which a Durable Object cannot open. So while the api starts,
// catchAdminSocket() stands in for net.createServer and keeps the api's own socket handler; the
// route below hands it the same one-line request recover.js would send. The code is made, saved
// and audited by the api itself (issueRecovery), exactly as with the command.
//
//   POST /api/fork/recover   Authorization: Bearer <RECOVER_SECRET>   { "name": "Peter" } or { "id": "..." }
//
// Dead unless the Worker has a RECOVER_SECRET of 32+ characters (wrangler secret put RECOVER_SECRET);
// without it the route answers 404 like any unknown path. Set it, ask, delete it again.
import crypto from 'node:crypto';

/**
 * Swaps net.createServer for the length of `start()` and returns the api's socket handler, if any.
 * The Workers file system reports every directory as mode 666, which admin-socket.js reads as "open
 * to others" and refuses; `dir` (ADMIN_SOCKET_DIR) is reported private for that check, as it is:
 * nothing else runs in this object. process.umask is not implemented there either and would throw
 * mid-start, so it is a no-op for the same span.
 */
export async function catchAdminSocket(net, start, fs = null, dir = null) {
  let listener = null;
  const real = net.createServer, lstat = fs?.lstatSync, umask = process.umask;
  process.umask = () => 0o022;
  if (fs && dir) fs.lstatSync = (p, ...rest) => {
    const st = lstat.call(fs, p, ...rest);
    return p === dir ? Object.create(st, { mode: { value: (st.mode & ~0o777) | 0o700 } }) : st;
  };
  net.createServer = fn => {
    listener = fn;
    const fake = { on() { return fake; }, listen() { return fake; }, unref() { return fake; }, close() {} };
    return fake;
  };
  try { await start(); } finally { net.createServer = real; process.umask = umask; if (fs && dir) fs.lstatSync = lstat; }
  if (!listener) return null;
  // One fake connection per request: one JSON line in, one out (admin-socket.js).
  return msg => new Promise(resolve => {
    const on = {};
    listener({
      setTimeout() {}, destroy() { resolve({ error: 'timed out' }); },
      on(ev, fn) { on[ev] = fn; },
      end(line) { try { resolve(JSON.parse(line)); } catch { resolve({ error: 'bad answer' }); } },
    });
    on.data?.(JSON.stringify(msg) + '\n');
  });
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const digest = s => crypto.createHash('sha256').update(String(s)).digest();

export async function recoverRoute(request, { secret, ask }) {
  secret = typeof secret === 'string' ? secret.trim() : secret;   // a piped `wrangler secret put` may keep the newline
  if (typeof secret !== 'string' || secret.length < 32 || request.method !== 'POST') return json({ error: 'not found' }, 404);
  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!crypto.timingSafeEqual(digest(given), digest(secret))) return json({ error: 'not found' }, 404);
  if (!ask) return json({ error: 'the api did not start its recovery handler on this runtime' }, 501);
  const body = await request.json().catch(() => ({}));
  const msg = { cmd: 'recover', ...(typeof body.id === 'string' ? { id: body.id } : { name: String(body.name || '') }) };
  const r = await ask(msg);
  return json(r, r.code ? 200 : 400);
}
