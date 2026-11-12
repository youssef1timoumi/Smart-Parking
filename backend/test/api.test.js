// End-to-end API test for the RFID gate flow.
// Starts the real server on a spare port with a throw-away SQLite DB, then plays
// what the ESP32 does when a MIFARE card is tapped: entry -> code -> exit -> bill.
//
//   cd backend && npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_PASSWORD = 'test-password';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-parking-test-'));
let server;
let token;

async function api(method, route, body, auth) {
  const res = await fetch(BASE + route, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1',
      DB_PATH: path.join(tmp, 'test.db'), ADMIN_SEED_PASSWORD: ADMIN_PASSWORD },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {            // wait up to 5 s for the server
    try { if ((await fetch(BASE + '/api/health')).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});

after(() => {
  server?.kill();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* DB file may still be locked on Windows */ }
});

test('health check answers', async () => {
  const r = await api('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
});

test('ESP32 heartbeat is accepted', async () => {
  const r = await api('POST', '/api/ping', { device: 'esp32-test', ip: '10.0.0.2', rssi: -60, uptimeMs: 1000 });
  assert.equal(r.body.ok, true);
});

test('an unknown card is refused (no barrier)', async () => {
  const r = await api('POST', '/api/access', { device: 'esp32-test', uid: 'DE:AD:BE:EF' });
  assert.equal(r.body.allow, false);
  assert.equal(r.body.reason, 'unknown');
});

test('admin endpoints need a login', async () => {
  const r = await api('POST', '/api/cards', { uid: '11:22:33:44', owner: 'Nobody', balance: 5 });
  assert.equal(r.status, 401);
});

test('wrong admin password is rejected, right one gives a token', async () => {
  const bad = await api('POST', '/api/login', { username: 'reiner', password: 'nope' });
  assert.equal(bad.status, 401);
  const ok = await api('POST', '/api/login', { username: 'reiner', password: ADMIN_PASSWORD });
  assert.equal(ok.body.ok, true);
  token = ok.body.token;
});

test('admin registers a card with an owner and a balance', async () => {
  const r = await api('POST', '/api/cards', { uid: '0b69ac8e', owner: 'Test Driver', balance: 20 }, token);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.card.uid, '0B:69:AC:8E');      // UIDs are normalised
});

test('a registered card without balance is refused', async () => {
  await api('POST', '/api/cards', { uid: 'AA:BB:CC:DD', owner: 'No Money', balance: 0 }, token);
  const r = await api('POST', '/api/access', { device: 'esp32-test', uid: 'AA:BB:CC:DD' });
  assert.equal(r.body.allow, false);
});

let code;
test('first tap = ENTRY with a 6-digit code for the LCD', async () => {
  const r = await api('POST', '/api/access', { device: 'esp32-test', uid: '0B:69:AC:8E' });
  assert.equal(r.body.allow, true);
  assert.equal(r.body.action, 'ENTRY');
  assert.match(r.body.code, /^\d{6}$/);
  code = r.body.code;
});

test('the code can be claimed (app mode) and the ESP32 sees it', async () => {
  const before = await api('GET', `/api/gate-status?code=${code}`);
  assert.equal(before.body.found, true);
  assert.equal(before.body.claimed, false);
  const claim = await api('POST', '/api/gate/claim', { code });
  assert.equal(claim.body.claimed, true);
  const afterClaim = await api('GET', `/api/gate-status?code=${code}`);
  assert.equal(afterClaim.body.claimed, true);
});

test('second tap = EXIT with duration and cost', async () => {
  const r = await api('POST', '/api/access', { device: 'esp32-test', uid: '0B:69:AC:8E' });
  assert.equal(r.body.allow, true);
  assert.equal(r.body.action, 'EXIT');
  assert.equal(typeof r.body.durationSec, 'number');
  assert.equal(typeof r.body.cost, 'number');
  assert.equal(r.body.mode, 'app');
});

test('the stay shows up in the parking journal', async () => {
  const r = await api('GET', '/api/stays');
  assert.ok(Array.isArray(r.body));
  const stay = r.body.find((row) => row.uid === '0B:69:AC:8E' && row.result === 'exit');
  assert.ok(stay, 'closed visit is listed');
  assert.ok(r.body.some((row) => row.uid === 'DE:AD:BE:EF' && row.result === 'denied'), 'denied tap is listed');
});

test('a blocked card is refused', async () => {
  const b = await api('POST', '/api/cards/0B:69:AC:8E/block', {}, token);
  assert.equal(b.body.card.status, 'BLOCKED');
  const r = await api('POST', '/api/access', { device: 'esp32-test', uid: '0B:69:AC:8E' });
  assert.equal(r.body.allow, false);
});
