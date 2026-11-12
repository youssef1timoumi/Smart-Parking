const path = require('path');
const os = require('os');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { buildDocs } = require('./docs');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // LAN by default; 127.0.0.1 behind nginx on the VPS
const ONLINE_WINDOW_MS = 15000;            // a device is "online" if it pinged within this window
const RATE_PER_HOUR = Number(process.env.PARK_RATE) || 1.5;   // DT/h (Task 5: potentiometer)
const SLOT_FRESH_MS = 8000;                // slot data counts as "live" only within this window
let lastSlotsAt = null;                    // ms of the last /api/slots report (null = never)
// Water sensor (sent with the slot report). Rain closes the outdoor Place 2:
// only the covered Place 1 is offered, and the gate refuses entry once it's taken.
const rainState = { rain: false, water: null, since: null };
const isRaining = () => sensorsLive() && rainState.rain;
const SESSION_TTL_MS = 12 * 3600 * 1000;   // admin login lifetime
const startedAt = new Date();
let lastDecision = null;                   // {message, at} - last allow/deny
// Live slot occupancy from the ESP32's HC-SR04 sensors (in memory; resets on restart).
// Slot 1 is covered, Slot 2 is outdoor.
const slotStates = {
  1: { covered: true,  occupied: false, since: null, lastUpdate: null },
  2: { covered: false, occupied: false, since: null, lastUpdate: null },
};
// Card Inspector: the admin "arms" a scan; the ESP32 dumps the next card and posts it here.
// While armed, the gate's next card tap is ONLY inspected (no entry/exit, no servo).
// job = what the ESP32 does: op 'read' (dump all sectors; `key` unlocks `sector`)
// or 'write' (auth `sector` with `key`, write `data` = 3 encrypted blocks, set `newKey`).
const INSPECT_TTL_MS = 60000;                       // an armed scan waits 60 s for a card
const inspect = { armed: false, job: null, until: 0, by: null };
let lastCardScan = null;                            // latest sector dump for the page
let lastInspectResult = null;                       // {op, sector, ok, error, newCode?, text?}

// ---- Protected sectors: each write gets a DECRYPTION CODE (e.g. "K7Q2-M9XD") ----
// From the code (and the sector) we derive both the sector's MIFARE key and the
// AES-256 key of its content, so the card only holds ciphertext behind a key nobody
// else has. The server keeps the ciphertext + a hash of the code, never the code.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O/1/I confusion
const DEFAULT_KEY = 'FFFFFFFFFFFF';                         // factory MIFARE key A
const SECTOR_BYTES = 48;                                    // 3 data blocks x 16
const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest();
function newDecryptCode() {
  let s = '';
  for (const b of crypto.randomBytes(8)) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}
const sectorKeyHex = (sector, code) => sha256(`sp-key|${sector}|${normCode(code)}`).subarray(0, 6).toString('hex').toUpperCase();
function sectorAes(sector, code) {
  return { key: sha256(`sp-enc|${sector}|${normCode(code)}`), iv: sha256(`sp-iv|${sector}|${normCode(code)}`).subarray(0, 16) };
}
function encryptSector(sector, code, text) {
  const plain = Buffer.alloc(SECTOR_BYTES);
  Buffer.from(text, 'utf8').copy(plain);
  const { key, iv } = sectorAes(sector, code);
  const c = crypto.createCipheriv('aes-256-ctr', key, iv);
  return Buffer.concat([c.update(plain), c.final()]).toString('hex').toUpperCase();
}
function decryptSector(sector, code, hex, length) {
  const { key, iv } = sectorAes(sector, code);
  const d = crypto.createDecipheriv('aes-256-ctr', key, iv);
  const plain = Buffer.concat([d.update(Buffer.from(hex, 'hex')), d.final()]);
  return plain.subarray(0, length).toString('utf8');
}
const hashCode = (code, salt) => crypto.scryptSync(normCode(code), salt, 32).toString('hex');
function codeMatches(secret, code) {
  const a = Buffer.from(hashCode(code, secret.code_salt), 'hex'), b = Buffer.from(secret.code_hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function currentInspectJob() {
  if (inspect.armed && Date.now() > inspect.until) {   // nobody tapped in time
    inspect.armed = false; inspect.job = null;
    lastInspectResult = { ok: false, error: 'timeout', at: nowIso() };
  }
  return inspect.armed ? inspect.job : null;
}
// What the ESP32 needs (never the codes or the plaintext).
const jobForDevice = (j) => ({ op: j.op, sector: j.sector, key: j.key || '', newKey: j.newKey || '', data: j.data || '' });

// Mobile app (the "/app" web): one-time 6-digit codes, phone sessions, login throttling.
const otpCodes = new Map();      // code -> { uid, owner, expires, visitId }
const phoneSessions = new Map(); // sessionId -> { uid, visitId, startedAt, place, receipt? }
const loginFails = new Map();    // ip -> { count, until }
const gen6 = () => String(Math.floor(100000 + Math.random() * 900000));
function issueCode(uid, owner, visitId) {
  for (const [c, v] of otpCodes) if (v.uid === uid) otpCodes.delete(c);  // one code per card
  const code = gen6();
  otpCodes.set(code, { uid, owner, issuedAt: Date.now(), expires: Date.now() + 120000, visitId, claimed: false });  // 2 min
  return code;
}
// The app must log in while the gate is still waiting (the LCD counts down 20 s);
// +5 s slack for the phone's network. Later = the gate already went no-app.
const APP_LOGIN_WINDOW_MS = 25000;
// Barrier state, estimated from the gate flow (the ESP32 doesn't report it):
// a cycle = ~1 s up + BARRIER_HOLD 4 s + ~1 s down. Entry opens when the code is
// claimed (next 1 s poll) or when the 20 s window ends; exit opens right away.
const BARRIER_CYCLE_MS = 6500;
const barrierWindows = [];       // [{ from, to, which: 'entry'|'exit' }] ms
function barrierAt(fromMs, which = 'entry') {
  const now = Date.now();
  while (barrierWindows.length && barrierWindows[0].to < now) barrierWindows.shift();
  const w = { from: fromMs, to: fromMs + BARRIER_CYCLE_MS, which };
  barrierWindows.push(w);
  barrierWindows.sort((a, b) => a.from - b.from);
  return w;
}
function barrierCancel(w) { const i = barrierWindows.indexOf(w); if (i >= 0) barrierWindows.splice(i, 1); }
function barrierOpen(which) {     // which: 'entry' (servo 1), 'exit' (servo 2), or either
  const now = Date.now();
  return barrierWindows.some((w) => w.from <= now && now <= w.to && (!which || w.which === which));
}
// Health of each part, from the ESP32's ping (1 = answers, 0 = not detected).
const hwStatus = { lcd: null, rfid: null, servo1: null, servo2: null, at: null };
// The ESP32 counts as online if it pinged recently (ping every 5 s).
function gateOnline() {
  const now = Date.now();
  return db.getDevices().some((d) => now - Date.parse(d.last_seen) < ONLINE_WINDOW_MS);
}
// The phone session of a card that is still parked (not yet billed), if any.
function livePhoneSession(uid) {
  for (const s of phoneSessions.values()) if (s.uid === uid && !s.receipt) return s;
  return null;
}

// No-app "paid parking": you pay by how long you stayed — 1 TND per started block.
// GATE_DEMO makes a block 30 s (so the cost visibly climbs during a test); set it
// false for real 30-minute blocks.
const GATE_DEMO = true;
const GATE_BLOCK_SEC = GATE_DEMO ? 30 : 1800;
const GATE_PER_BLOCK = 1.0;
const noappCost = (sec) => (sec <= 0 ? 0 : db.round2(Math.ceil(sec / GATE_BLOCK_SEC) * GATE_PER_BLOCK));

// App tariffs (DT per hour), paid from the card balance. A driver who says how long
// they'll stay gets the cheaper "planned" rate; minutes past that time, and the
// open-ended "free time", use the higher free rate. GATE_DEMO runs the clock 60x
// (1 h is billed per minute) — same scale as the 30 s no-app block = 30 min.
const RATE_PLANNED_H = 1.0;
const RATE_FREE_H = RATE_PER_HOUR;             // 1.5
const TIME_SCALE = GATE_DEMO ? 60 : 1;
const PLAN_MINUTES = [30, 60, 120, 180];
function appCost(durationSec, plan) {
  const billedSec = durationSec * TIME_SCALE;
  if (plan && plan.minutes) {
    const within = Math.min(billedSec, plan.minutes * 60);
    const over = Math.max(0, billedSec - plan.minutes * 60);
    return db.round2((within / 3600) * RATE_PLANNED_H + (over / 3600) * RATE_FREE_H);
  }
  return db.round2((billedSec / 3600) * RATE_FREE_H);
}
// The one tariff table shown by the app and the dashboard.
function tarifsPublic() {
  const noappH = GATE_PER_BLOCK * (3600 / (GATE_BLOCK_SEC * TIME_SCALE));
  return {
    planifie: RATE_PLANNED_H, libre: RATE_FREE_H,                       // DT/h with the app
    sansApp: { prix: GATE_PER_BLOCK, minutes: (GATE_BLOCK_SEC * TIME_SCALE) / 60, parHeure: noappH },
    durees: PLAN_MINUTES, demo: GATE_DEMO, echelle: TIME_SCALE,
    remisePlanifie: Math.round((1 - RATE_PLANNED_H / noappH) * 100),   // % saved vs no-app
    remiseLibre: Math.round((1 - RATE_FREE_H / noappH) * 100),
  };
}

const app = express();
app.set('trust proxy', 'loopback'); // real client IP when behind nginx
app.use(cors());                    // open: lets a frontend dev call the API from localhost
app.use(express.json());
// API answers are live state: never let a browser cache them. (A cached 410 from a
// finished /api/session was replayed to the phone's NEXT session -> "session ended".)
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

/* ======================================================================
   Helpers
   ====================================================================== */
const nowIso = () => new Date().toISOString();
const fmtDur = (sec) => { const m = Math.floor(sec / 60), s = sec % 60; return m > 0 ? `${m}m ${s}s` : `${s}s`; };

// MIFARE UID -> "AA:BB:CC:DD" (uppercase). Returns null if it isn't valid hex.
function normUid(raw) {
  const hex = String(raw || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (hex.length < 8 || hex.length % 2 !== 0) return null;
  return hex.match(/../g).join(':');
}

// The gate only lets in a card the admin set up: ACTIVE, with a name and a balance > 0.
const cardAssigned = (c) => !!(c && c.status === 'ACTIVE' && String(c.owner || '').trim() && Number(c.balance) > 0);

function cardView(c) {
  return {
    uid: c.uid, owner: c.owner, balance: c.balance, status: c.status,
    active: c.status === 'ACTIVE', blocked: c.status === 'BLOCKED',
    registered: true, updated_at: c.updated_at,
  };
}

/* ======================================================================
   Admin authentication (users table, in-memory tokens)
   ====================================================================== */
function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}
function seedAdmin() {
  const username = 'reiner';
  if (db.getUser(username)) return;
  // Set ADMIN_SEED_PASSWORD before the first start; otherwise a random one is generated and printed once.
  const password = process.env.ADMIN_SEED_PASSWORD || crypto.randomBytes(6).toString('hex');
  if (!process.env.ADMIN_SEED_PASSWORD) console.log(`[auth] no ADMIN_SEED_PASSWORD set - generated admin password: ${password}`);
  const salt = crypto.randomBytes(16).toString('hex');
  db.createUser({ username, salt, hash: hashPassword(password, salt), at: nowIso() });
  console.log(`[auth] seeded admin user "${username}"`);
}
seedAdmin();

const sessions = new Map(); // token -> { username, expires }
function issueToken(username) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { username, expires: Date.now() + SESSION_TTL_MS });
  return token;
}
function userFor(req) {
  let token = '';
  const auth = req.get('authorization') || '';
  if (auth.startsWith('Bearer ')) token = auth.slice(7).trim();
  if (!token) token = req.get('x-admin-token') || '';
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (s.expires < Date.now()) { sessions.delete(token); return null; }
  return s.username;
}
function requireAuth(req, res, next) {
  const username = userFor(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Authentification requise.' });
  req.username = username;
  next();
}

app.post('/api/login', (req, res) => {
  const body = req.body || {};
  // ---- Mobile app: log in with the 6-digit code shown after a card tap ----
  if (body.code !== undefined) return mobileLogin(req, res);
  // ---- Admin (dashboard): username + password ----
  const { username, password } = body;
  const user = username && db.getUser(String(username));
  let ok = false;
  if (user) {
    const given = hashPassword(password || '', user.salt);
    const a = Buffer.from(given, 'hex');
    const b = Buffer.from(user.hash, 'hex');
    ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  if (!ok) return res.status(401).json({ ok: false, error: 'Identifiants invalides.' });
  console.log(`[auth] login: ${user.username}`);
  res.json({ ok: true, token: issueToken(user.username), username: user.username });
});

// Mobile code login: 5 tries per IP then a 5-minute lock (matches the app's error contract).
function mobileLogin(req, res) {
  const ip = (req.ip || '').replace('::ffff:', '');
  const now = Date.now();
  const fail = loginFails.get(ip) || { count: 0, until: 0 };
  if (fail.until > now) return res.status(429).json({ code: 'login_bloque', erreur: 'Trop de codes incorrects.', blocageSecondes: Math.ceil((fail.until - now) / 1000) });
  const rejected = (codeName, extra) => {
    fail.count += 1;
    if (fail.count >= 5) { fail.until = now + 5 * 60000; fail.count = 0; loginFails.set(ip, fail); return res.status(429).json({ code: 'login_bloque', erreur: 'Trop de codes incorrects.', blocageSecondes: 300 }); }
    loginFails.set(ip, fail);
    return res.status(401).json(Object.assign({ code: codeName, erreur: 'Code refusé.', tentativesRestantes: 5 - fail.count }, extra));
  };
  const code = String(body6(req));
  const entry = otpCodes.get(code);
  if (!entry || entry.claimed) return rejected('code_invalide');   // unknown, or already used
  if (entry.expires < now || now - entry.issuedAt > APP_LOGIN_WINDOW_MS) return rejected('code_expire');
  const card = db.getCard(entry.uid);
  if (!card) { otpCodes.delete(code); return res.status(404).json({ code: 'carte_introuvable', erreur: 'Carte introuvable.' }); }
  if (card.status === 'BLOCKED') { otpCodes.delete(code); return res.status(403).json({ code: 'carte_bloquee', erreur: 'Carte bloquée.' }); }
  // Claim the code (kept, not deleted): the ESP32's /api/gate-status poll now sees
  // claimed:true -> "App connected", and the gate EXIT bills this visit in app mode.
  entry.claimed = true;
  barrierCancel(entry.noappBarrier);   // the gate opens now instead of after the window
  barrierAt(now + 1000);
  loginFails.delete(ip);
  const sessionId = crypto.randomBytes(16).toString('hex');
  const place = (slotStates[1].occupied && !isRaining()) ? 'Place 2' : 'Place 1 couverte';   // rain: covered only
  phoneSessions.set(sessionId, { uid: entry.uid, visitId: entry.visitId, startedAt: now, place });
  lastDecision = { message: `Code ${code} utilisé (app)`, at: nowIso() };
  console.log(`[mobile] login ${entry.uid} (${card.owner || ''})  code ${code} claimed`);
  res.json({ nom: card.owner || entry.uid, solde: card.balance, sessionId });
}
function body6(req) { return (req.body || {}).code; }

app.post('/api/logout', requireAuth, (req, res) => {
  const auth = req.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : (req.get('x-admin-token') || '');
  sessions.delete(token);
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => res.json({ ok: true, username: req.username }));

/* ======================================================================
   Device: health, heartbeat, raw card log
   ====================================================================== */
app.get('/api/health', (req, res) => {
  res.json({ ok: true, startedAt: startedAt.toISOString(), now: nowIso() });
});

app.post('/api/ping', (req, res) => {
  const { device = 'unknown', ip, rssi, uptimeMs, lcd, rfid, servo1, servo2 } = req.body || {};
  const flag = (v) => (v === 1 || v === true ? 1 : v === 0 || v === false ? 0 : null);
  Object.assign(hwStatus, { lcd: flag(lcd), rfid: flag(rfid), servo1: flag(servo1), servo2: flag(servo2), at: Date.now() });
  const at = nowIso();
  const sourceIp = (req.ip || '').replace('::ffff:', '');
  db.recordPing({ deviceId: String(device), ip: ip || sourceIp, rssi, uptimeMs, at, lcd });
  console.log(`[ping] ${at}  device=${device}  ip=${ip || sourceIp}  rssi=${rssi}  uptime=${uptimeMs}ms  lcd=${lcd}`);
  res.json({ ok: true, serverTime: at });
});

// Slot occupancy from the ESP32 (HC-SR04). No login — it's a device endpoint.
app.post('/api/slots', (req, res) => {
  const { slots, rain, water } = req.body || {};
  const at = nowIso();
  lastSlotsAt = Date.now();
  if (typeof rain === 'boolean') {
    if (rain !== rainState.rain) console.log(`[rain] ${rain ? 'RAIN — only the covered Place 1 is available' : 'dry — both places available'} (water=${water})`);
    if (rain && !rainState.rain) rainState.since = at;
    rainState.rain = rain;
    rainState.water = Number.isFinite(Number(water)) ? Number(water) : null;
  }
  if (Array.isArray(slots)) {
    for (const s of slots) {
      const id = Number(s && s.id);
      if (id !== 1 && id !== 2) continue;
      const occ = !!(s && s.occupied);
      const cur = slotStates[id];
      if (occ && !cur.occupied) cur.since = at;   // just became occupied
      if (!occ) cur.since = null;                 // freed
      cur.occupied = occ;
      cur.cm = Number.isFinite(Number(s.cm)) ? Number(s.cm) : null;   // -1 = no echo (sensor fault)
      cur.lastUpdate = at;
    }
  }
  const reply = { ok: true };
  // A Card Inspector scan is armed -> the gate's next tap is inspected only.
  const job = currentInspectJob();
  if (job) reply.inspect = jobForDevice(job);
  // An app "Quit parking" waiting for the gate -> tell the ESP32 to open the exit barrier.
  const ex = takePendingExit();
  if (ex) {
    barrierAt(Date.now(), 'exit');
    console.log(`[exit] gate picked up the app exit of ${ex.owner || '?'} -> exit barrier`);
    reply.exit = { durationSec: ex.durationSec, cost: ex.cost };
  }
  res.json(reply);
});

// Card Inspector job for the ESP32 (it also gets it in its /api/slots reply).
app.get('/api/inspect-poll', (req, res) => {
  const j = currentInspectJob();
  res.json(j ? { ok: true, armed: true, inspect: jobForDevice(j) } : { ok: true, armed: false });
});

// Card Inspector: the ESP32 posts the sector dump of the inspected card (+ the write result).
// {uid, type, op, sector, wrote, keyChanged, error, sectors:[{s, prot, blocks:[hex x4]}]}
app.post('/api/card-scan', (req, res) => {
  const { uid, type, op, sector, wrote, keyChanged, error, sectors } = req.body || {};
  const norm = normUid(uid) || String(uid || '');
  const at = nowIso();
  const job = inspect.job;
  lastCardScan = { uid: norm, type: type || null, sectors: Array.isArray(sectors) ? sectors : [], at,
                   registered: !!db.getCard(norm) };
  const result = { op: op || (job && job.op) || 'read', sector: Number(sector), ok: true, uid: norm, at };
  if (job && job.op === 'write') {
    if (wrote) {
      // Keep the ciphertext + the code's HASH so the admin can view it later with the code.
      const salt = crypto.randomBytes(16).toString('hex');
      db.saveSecret({ uid: norm, sector: job.sector, cipherHex: job.data, length: job.length,
                      salt, hash: hashCode(job.newCode, salt), at });
      Object.assign(result, { newCode: job.newCode, keyChanged: !!keyChanged });
    } else {
      Object.assign(result, { ok: false, error: error || 'write_failed' });
    }
  } else if (job && job.op === 'read' && job.code) {
    // Unlock: decrypt the sector we just read with the code the admin typed.
    const sec = lastCardScan.sectors.find((x) => Number(x.s) === job.sector);
    const secret = db.getSecret(norm, job.sector);
    if (!sec || sec.prot || !Array.isArray(sec.blocks)) Object.assign(result, { ok: false, error: 'wrong_code' });
    else if (secret && !codeMatches(secret, job.code)) Object.assign(result, { ok: false, error: 'wrong_code' });
    else {
      const hex = sec.blocks.slice(0, 3).join('');
      result.text = decryptSector(job.sector, job.code, hex, secret ? secret.length : SECTOR_BYTES).replace(/\0+$/, '');
    }
  }
  lastInspectResult = result;
  inspect.armed = false; inspect.job = null;        // one tap = one inspection
  console.log(`[inspect] ${result.op} ${norm} sector=${result.sector} ok=${result.ok}${result.error ? ' ' + result.error : ''}`);
  res.json({ ok: true });
});

// Log-only (Task 2). The ESP32 now uses /api/access, which also logs the read.
app.post('/api/card', (req, res) => {
  const { device = 'unknown', uid, type } = req.body || {};
  const norm = normUid(uid);
  if (!norm) return res.status(400).json({ ok: false, error: 'uid invalide' });
  const at = nowIso();
  db.recordCardRead({ uid: norm, type, deviceId: String(device), at });
  console.log(`[card] ${at}  device=${device}  uid=${norm}  type=${type}`);
  res.json({ ok: true, uid: norm, receivedAt: at });
});

/* ======================================================================
   ESP32 decision endpoint: UID -> allow / deny (source of truth)
   Tap in = ENTRY, next tap = EXIT (billed). No auth (the device can't log in;
   a device key comes in Task 6).
   ====================================================================== */
app.post('/api/access', (req, res) => {
  const { device = 'esp32', uid, type } = req.body || {};
  const norm = normUid(uid);
  const at = nowIso();
  if (!norm) return res.status(400).json({ ok: false, allow: false, error: 'uid invalide' });

  db.recordCardRead({ uid: norm, type, deviceId: String(device), at });

  // kind 'unknown' = the LCD shows "Unknown card" (not registered / no name / no balance).
  const deny = (reason, owner, kind = 'refused') => {
    db.addDenial({ uid: norm, owner: owner ?? null, reason, at });
    lastDecision = { message: reason, at };
    console.log(`[access] DENY  ${norm}  ${reason}`);
    return res.json({ ok: true, allow: false, uid: norm, owner: owner ?? null, message: reason, reason: kind });
  };

  const card = db.getCard(norm);
  if (!card) return deny('Carte inconnue', null, 'unknown');
  if (card.status === 'BLOCKED') return deny('Carte bloquée', card.owner);
  if (card.status === 'EXPIRED') return deny('Carte expirée', card.owner);

  // A car already inside can always leave (even if its card was changed meanwhile).
  const open = db.getOpenVisit(norm);
  if (open) {
    const { durationSec, cost, mode, message } = exitVisit(card, open, at, 'gate');
    barrierAt(Date.now(), 'exit');
    return res.json({ ok: true, allow: true, uid: norm, owner: card.owner, action: 'EXIT',
      durationSec, cost, price: cost, mode, message });
  }

  // Entry only for a card the admin set up: a name AND a balance above 0.
  if (!cardAssigned(card)) {
    return deny(!card.owner ? 'Carte non attribuée (sans nom)' : 'Carte sans solde', card.owner, 'unknown');
  }

  // Rain: only the covered Place 1 is open — refuse the entry if it's already taken.
  if (isRaining() && slotStates[1].occupied) return deny('Complet (pluie)', card.owner);

  // ENTRY: any ACTIVE card may enter; they pay on the way out by how long they stayed.
  const visitId = db.openVisit({ uid: norm, owner: card.owner, at });
  const code = issueCode(norm, card.owner, visitId);   // 6-digit code shown on the LCD
  // Not claimed -> the ESP32 opens the entry barrier when its 20 s window ends.
  otpCodes.get(code).noappBarrier = barrierAt(Date.now() + 21000);
  const message = `Bienvenue ${card.owner || ''} — Code ${code}`.replace('  ', ' ');
  lastDecision = { message, at };
  console.log(`[access] ENTRY ${norm}  code=${code}`);
  res.json({ ok: true, allow: true, uid: norm, owner: card.owner, action: 'ENTRY', code, message });
});

// Close a visit and bill it. The ONE exit path: a card tap at the gate (source
// 'gate') and the app's "Quit parking" button (source 'app') both land here.
//  - app mode (code claimed / phone session): tariff from the plan, debited from the balance
//  - no-app: 1 TND per started block, balance untouched
function exitVisit(card, open, at, source) {
  const durationSec = Math.max(0, Math.round((Date.parse(at) - Date.parse(open.entry_at)) / 1000));
  let claimed = false;
  for (const [c, v] of otpCodes) if (v.uid === card.uid) { claimed = claimed || v.claimed; otpCodes.delete(c); }
  const phone = livePhoneSession(card.uid);
  const mode = (claimed || phone) ? 'app' : 'noapp';
  let cost;
  if (mode === 'app') {
    const plan = phone ? phone.plan : null;
    cost = db.round2(Math.min(appCost(durationSec, plan), card.balance));
    const soldeFinal = db.round2(card.balance - cost);
    db.updateCard(card.uid, { balance: soldeFinal, at });
    // Hand the receipt to the phone: its next /api/session poll gets 410 session_terminee.
    if (phone) phone.receipt = { duree: durationSec, prix: cost, soldeFinal, entree: open.entry_at, sortie: at,
                                 gate: source === 'gate', plan: plan || null };
  } else {
    cost = noappCost(durationSec);
  }
  db.closeVisit({ id: open.id, exitAt: at, durationSec, price: cost });
  const message = `Sortie${source === 'app' ? ' (app)' : ''} · ${fmtDur(durationSec)} · ${cost.toFixed(2)} TND`;
  lastDecision = { message, at };
  console.log(`[exit] ${source.toUpperCase()} ${card.uid}  ${durationSec}s  cost=${cost} TND  mode=${mode}`);
  return { durationSec, cost, mode, message };
}

// "Quit parking" in the app: the exit is billed at once, and the ESP32 opens the
// exit barrier when it next reports its slots (every 1.5 s) — see /api/slots.
// Not picked up within 30 s (gate offline) = dropped, so the barrier never opens late.
const pendingExits = [];   // [{ owner, durationSec, cost, at }]
const EXIT_PICKUP_MS = 30000;
function takePendingExit() {
  const now = Date.now();
  while (pendingExits.length && now - pendingExits[0].at > EXIT_PICKUP_MS) pendingExits.shift();
  return pendingExits.shift() || null;
}

/* ======================================================================
   Gate code window (manual-test flow; the mobile app comes later)
   After a card taps IN, the LCD shows a 6-digit code. The driver "uses" it
   (later: the mobile app; now: the dashboard's "Simulate app" button ->
   POST /api/gate/claim). The ESP32 polls /api/gate-status during a 20 s
   window; claimed in time = "app mode", else = "no-app" paid parking.
   ====================================================================== */
app.get('/api/gate-status', (req, res) => {
  const code = String(req.query.code || '');
  const v = otpCodes.get(code);
  if (!v) return res.json({ ok: true, found: false, claimed: false });
  res.json({ ok: true, found: true, claimed: !!v.claimed, owner: v.owner || null, expired: v.expires < Date.now() });
});

app.post('/api/gate/claim', (req, res) => {
  const code = String((req.body || {}).code || '');
  const v = otpCodes.get(code);
  if (!v) return res.status(404).json({ ok: false, error: 'Code introuvable ou expiré.' });
  if (!v.claimed) { barrierCancel(v.noappBarrier); barrierAt(Date.now() + 1000); }
  v.claimed = true;
  lastDecision = { message: `Code ${code} utilisé`, at: nowIso() };
  console.log(`[gate] code ${code} claimed (manual)`);
  res.json({ ok: true, claimed: true, owner: v.owner || null });
});

app.get('/api/gate', (req, res) => {
  const now = Date.now();
  const visits = db.listVisits(60);
  const active = visits.filter((v) => v.status === 'OPEN').map((v) => {
    let code = null, claimed = false;
    for (const [c, e] of otpCodes) if (e.uid === v.uid) { code = c; claimed = e.claimed; }
    const elapsedSec = Math.max(0, Math.round((now - Date.parse(v.entry_at)) / 1000));
    const phone = livePhoneSession(v.uid);
    const app = claimed || !!phone;
    const plan = phone && phone.plan ? phone.plan : null;   // {minutes} = planned stay, {} = free time
    return { uid: v.uid, owner: v.owner, enteredAt: v.entry_at, code, claimed,
             mode: app ? 'app' : 'noapp', plan, elapsedSec,
             runningCost: app ? appCost(elapsedSec, plan) : noappCost(elapsedSec) };
  });
  const recent = visits.filter((v) => v.status === 'CLOSED').slice(0, 6).map((v) => ({
    uid: v.uid, owner: v.owner, entry: v.entry_at, exit: v.exit_at, durationSec: v.duration_sec, cost: v.price,
  }));
  res.json({ ok: true, demo: GATE_DEMO, blockSec: GATE_BLOCK_SEC, perBlock: GATE_PER_BLOCK,
             tarifs: tarifsPublic(), active, recent });
});

// The cards the gate may let in (name + balance > 0), for the ESP32 to keep in flash
// so OFFLINE mode refuses everything else too. One comma-separated string = easy to parse.
app.get('/api/gate/cards', (req, res) => {
  const uids = db.listCards().filter(cardAssigned).map((c) => c.uid);
  res.json({ ok: true, count: uids.length, uids: uids.join(',') });
});

// Mobile page: the driver enters the 6-digit code; this is the live view of THEIR car.
app.get('/api/gate-session', (req, res) => {
  const code = String(req.query.code || '');
  const v = otpCodes.get(code);
  if (!v) return res.json({ ok: true, found: false });       // not active (never claimed, or already left)
  const open = db.getOpenVisit(v.uid);
  if (!open) return res.json({ ok: true, found: false });
  const elapsedSec = Math.max(0, Math.round((Date.now() - Date.parse(open.entry_at)) / 1000));
  const fresh = lastSlotsAt != null && (Date.now() - lastSlotsAt) < SLOT_FRESH_MS;
  const slots = [1, 2].map((id) => ({ id, occupied: fresh && slotStates[id].occupied }));
  const parked = slots.some((s) => s.occupied);
  res.json({
    ok: true, found: true, owner: v.owner || v.uid, claimed: !!v.claimed,
    enteredAt: open.entry_at, elapsedSec, runningCost: noappCost(elapsedSec),
    parked, slots, blockSec: GATE_BLOCK_SEC, perBlock: GATE_PER_BLOCK,
  });
});

/* ======================================================================
   Dashboard data (read-only, open)
   ====================================================================== */
app.get('/api/status', (req, res) => {
  const now = Date.now();
  const devices = db.getDevices().map((d) => ({
    ...d, online: now - Date.parse(d.last_seen) < ONLINE_WINDOW_MS,
  }));
  res.json({
    ok: true, startedAt: startedAt.toISOString(), now: nowIso(),
    devices, cardReads: db.getRecentCardReads(10), lastDecision,
  });
});

// Live model state for the dashboard (slots from the sensors; rain/barrier are
// Task 5 and not wired yet, so they're null = "awaiting").
app.get('/api/state', (req, res) => {
  // Only expose slot occupancy while the ESP32 is actually reporting it. If no
  // fresh sensor data, return an empty slots list so the dashboard shows
  // "awaiting sensors" instead of a fake "free" (matches the ESP32 being offline).
  const fresh = lastSlotsAt != null && (Date.now() - lastSlotsAt) < SLOT_FRESH_MS;
  const slots = fresh
    ? [1, 2].map((id) => ({
        id,
        covered: slotStates[id].covered,
        occupied: slotStates[id].occupied,
        since: slotStates[id].since,
        cm: slotStates[id].cm ?? null,
      }))
    : [];
  res.json({
    ok: true,
    slots,
    sensorsLive: fresh,
    rain: fresh ? rainState.rain : null,   // water sensor (null = no live report)
    water: fresh ? rainState.water : null,
    barrier: gateOnline() ? barrierOpen() : null,   // estimated from the gate flow
    barrierEntry: gateOnline() ? barrierOpen('entry') : null,
    barrierExit: gateOnline() ? barrierOpen('exit') : null,
    // Part health from the last ping (null = this firmware doesn't report it / gate offline).
    hardware: gateOnline() ? { lcd: hwStatus.lcd, rfid: hwStatus.rfid, servo1: hwStatus.servo1, servo2: hwStatus.servo2 } : null,
    rate: RATE_PER_HOUR,
    lastDecision,
  });
});

// Card Inspector state for the page (armed flag + the latest card dump). Open read.
// The decryption code and decrypted text are only sent to a logged-in admin.
app.get('/api/inspect', (req, res) => {
  const job = currentInspectJob();
  const admin = !!userFor(req);
  let result = lastInspectResult;
  if (result && !admin) { const { newCode, text, ...rest } = result; result = rest; }
  const secrets = lastCardScan && lastCardScan.uid ? db.listSecrets(lastCardScan.uid) : [];
  res.json({ ok: true, armed: !!job, op: job ? job.op : null, sector: job ? job.sector : null,
             until: job ? new Date(inspect.until).toISOString() : null, lastCardScan, secrets, result });
});

/* ======================================================================
   Mobile app ("/app"): public status + code login + paid session.
   Backed by the same SQLite cards + visits as the gate/dashboard.
   ====================================================================== */
function phoneSession(req) { const sid = req.get('x-session-id'); return sid ? phoneSessions.get(sid) : null; }
function etatParkingArr() {
  const fresh = sensorsLive();
  return [1, 2].map((id) => {
    const occ = fresh && slotStates[id].occupied;
    const rainClosed = id === 2 && isRaining() && !occ;    // outdoor place closed while it rains
    return { nom: 'Place ' + id, etat: occ ? 'occupée' : 'libre', disponible: fresh && !occ && !rainClosed,
             raison: occ ? 'occupee' : (rainClosed ? 'pluie' : (fresh ? null : 'capteurs')) };
  });
}
// Live gate/parking state shared by /api/etat and /api/session (field names = the app's contract).
function etatPublic() {
  const online = gateOnline();
  return {
    tarif: db.round2((RATE_FREE_H * TIME_SCALE) / 60),         // DT per real minute, free time
    tarifs: tarifsPublic(),                                     // the full table (DT/h)
    blocVisiteur: { prix: GATE_PER_BLOCK, secondes: GATE_BLOCK_SEC },
    pluie: isRaining(),                                         // water sensor -> Place 2 closed
    etatParking: etatParkingArr(),
    barriere: barrierOpen() ? 'ouverte' : 'fermee',
    capteurs: sensorsLive() ? 'ok' : 'attente',
    materiel: { enLigne: online, barriereOuverte: barrierOpen() },
    fenetreCodeSec: APP_LOGIN_WINDOW_MS / 1000 - 5,             // the LCD countdown (20 s)
  };
}
function sensorsLive() { return lastSlotsAt != null && (Date.now() - lastSlotsAt) < SLOT_FRESH_MS; }

// Public parking state for the mobile home screen (no session needed).
app.get('/api/etat', (req, res) => {
  res.json(etatPublic());
});

// Live session: balance + estimated time left (server is the source of truth).
app.get('/api/session', (req, res) => {
  const s = phoneSession(req);
  if (!s) return res.status(401).json({ code: 'session_absente', erreur: 'Session absente.' });
  if (s.receipt) return res.status(410).json(Object.assign({ code: 'session_terminee', erreur: 'Session terminée.' }, s.receipt));
  const card = db.getCard(s.uid);
  if (!card) return res.status(401).json({ code: 'session_absente', erreur: 'Session absente.' });
  res.json(Object.assign(etatPublic(), sessionMoney(s, card), { nom: card.owner || s.uid, place: s.place }));
});

// What this stay costs so far + what's left, for the app. The balance is only debited
// at the exit, so the app gets it minus the running cost (no jump back on each poll).
//  planned: time left = the planned time; past it = overtime at the free rate
//  free:    time left = how long the balance lasts at the free rate
function sessionMoney(s, card) {
  const open = db.getOpenVisit(s.uid);
  const entree = open ? open.entry_at : new Date(s.startedAt).toISOString();
  const elapsedSec = Math.max(0, (Date.now() - Date.parse(entree)) / 1000);
  const plan = s.plan || null;
  const coutActuel = appCost(elapsedSec, plan);
  const solde = db.round2(Math.max(0, card.balance - coutActuel));
  const billedSec = elapsedSec * TIME_SCALE;
  const depassement = !!(plan && plan.minutes && billedSec > plan.minutes * 60);
  const rateH = (plan && plan.minutes && !depassement) ? RATE_PLANNED_H : RATE_FREE_H;
  const soldeSec = Math.floor((solde / RATE_FREE_H) * 3600 / TIME_SCALE);   // balance at the free rate
  const tempsRestantSec = (plan && plan.minutes)
    ? Math.max(0, Math.floor((plan.minutes * 60 - billedSec) / TIME_SCALE))
    : soldeSec;
  return {
    entree, solde, soldeCarte: card.balance, coutActuel, plan, depassement,
    tarif: db.round2((rateH * TIME_SCALE) / 60),          // DT per real minute right now
    tarifHeure: rateH,
    tempsRestant: tempsRestantSec, tempsRestantSec, soldeSec,
    finEstimee: new Date(Date.now() + tempsRestantSec * 1000).toISOString(),
  };
}

// The driver says how long they'll stay ({minutes: 30|60|120|180}) or picks free time
// ({minutes: null}). Chosen once per stay, right after the code login.
app.post('/api/session/plan', (req, res) => {
  const s = phoneSession(req);
  if (!s) return res.status(401).json({ code: 'session_absente', erreur: 'Session absente.' });
  if (s.receipt) return res.status(410).json(Object.assign({ code: 'session_terminee', erreur: 'Session terminée.' }, s.receipt));
  if (s.plan) return res.status(409).json({ code: 'plan_deja_choisi', erreur: 'Durée déjà choisie.', plan: s.plan });
  const m = (req.body || {}).minutes;
  if (m !== null && !PLAN_MINUTES.includes(Number(m))) return res.status(400).json({ code: 'duree_invalide', erreur: 'Durée invalide.' });
  s.plan = m === null ? { minutes: null } : { minutes: Number(m) };
  const card = db.getCard(s.uid);
  console.log(`[mobile] plan ${s.uid}: ${s.plan.minutes ? s.plan.minutes + ' min' : 'free time'}`);
  res.json(Object.assign(etatPublic(), sessionMoney(s, card), { nom: card.owner || s.uid, place: s.place }));
});

// Top up (demo amounts 5 / 10 / 20).
app.post('/api/recharge', (req, res) => {
  const s = phoneSession(req);
  if (!s) return res.status(401).json({ code: 'session_absente', erreur: 'Session absente.' });
  const montant = Number((req.body || {}).montant);
  if (![5, 10, 20].includes(montant)) return res.status(400).json({ code: 'montant_invalide', erreur: 'Montant invalide.' });
  const card = db.getCard(s.uid);
  if (!card) return res.status(401).json({ code: 'session_absente', erreur: 'Session absente.' });
  const solde = db.round2(card.balance + montant);
  db.updateCard(s.uid, { balance: solde, at: nowIso() });
  // Same live view as /api/session: the card balance minus this stay so far.
  res.json(Object.assign({ soldeCarte: solde }, sessionMoney(s, db.getCard(s.uid))));
});

// "Quit parking" button = the same as tapping the card at the exit: the visit is closed
// and billed (exitVisit), the dashboard sees the exit, and the ESP32 opens the exit
// barrier on its next slot report (pendingExits).
app.post('/api/sortie', (req, res) => {
  const s = phoneSession(req);
  if (!s) return res.status(401).json({ code: 'session_absente', erreur: 'Session absente.' });
  if (s.receipt) return res.json(s.receipt);
  const card = db.getCard(s.uid);
  const open = db.getOpenVisit(s.uid);
  if (!card || !open) return res.status(409).json({ code: 'visite_absente', erreur: 'Aucun stationnement en cours.' });
  const at = nowIso();
  const r = exitVisit(card, open, at, 'app');
  if (!s.receipt) s.receipt = { duree: r.durationSec, prix: r.cost, soldeFinal: card.balance, entree: open.entry_at, sortie: at, gate: false };
  pendingExits.push({ owner: card.owner, durationSec: r.durationSec, cost: r.cost, at: Date.now() });
  res.json(Object.assign({ barriere: gateOnline() ? 'ouverture' : 'hors_ligne' }, s.receipt));
});

// All cards: registered first-class rows + any scanned UID not registered yet.
app.get('/api/cards', (req, res) => {
  const registered = db.listCards().map(cardView);
  const unregistered = db.listUnregisteredScans().map((r) => ({
    uid: r.uid, owner: null, balance: 0, status: 'UNREGISTERED',
    active: false, blocked: false, registered: false,
    last_seen: r.last_seen, reads: r.reads,
  }));
  res.json([...unregistered, ...registered]);
});

// Parking journal: visits (entry/exit) + denied taps, newest first.
app.get('/api/stays', (req, res) => {
  const rows = [];
  for (const v of db.listVisits(60)) {
    rows.push({
      result: v.status === 'OPEN' ? 'entry' : 'exit', owner: v.owner, uid: v.uid,
      entry: v.entry_at, exit: v.exit_at, duration: v.duration_sec || 0,
      price: v.price, reason: null, _ts: Date.parse(v.exit_at || v.entry_at),
    });
  }
  for (const d of db.listDenials(60)) {
    rows.push({
      result: 'denied', owner: d.owner, uid: d.uid, entry: d.at, exit: null,
      duration: 0, price: null, reason: d.reason, _ts: Date.parse(d.at),
    });
  }
  rows.sort((a, b) => b._ts - a._ts);
  res.json(rows.slice(0, 50).map(({ _ts, ...r }) => r));
});

/* ======================================================================
   Admin writes (login required)
   ====================================================================== */
// Register a new card (optionally with an opening balance).
app.post('/api/cards', requireAuth, (req, res) => {
  const { uid, owner, balance } = req.body || {};
  const norm = normUid(uid);
  const name = String(owner || '').trim();
  if (!norm) return res.json({ ok: false, error: 'UID invalide.' });
  if (!name) return res.json({ ok: false, error: 'Propriétaire requis.' });
  if (db.getCard(norm)) return res.json({ ok: false, error: 'Cette carte est déjà inscrite.' });
  if (db.activeCardForOwner(name, norm)) return res.json({ ok: false, error: 'Ce client a déjà une carte active.' });
  const bal = Number(balance);
  const card = db.createCard({ uid: norm, owner: name, balance: bal > 0 ? bal : 0, status: 'ACTIVE', at: nowIso() });
  console.log(`[cards] register ${norm} -> ${name} (${card.balance} DT) by ${req.username}`);
  res.json({ ok: true, card: cardView(card) });
});

// Edit a card (owner / solde / status). Creates the row if the UID was only scanned.
app.post('/api/cards/:uid', requireAuth, (req, res) => {
  const norm = normUid(req.params.uid);
  if (!norm) return res.json({ ok: false, error: 'UID invalide.' });
  const body = req.body || {};
  const fields = { at: nowIso() };

  if (body.owner !== undefined) {
    const name = String(body.owner || '').trim();
    fields.owner = name || null;
  }
  if (body.balance !== undefined) {
    const bal = Number(body.balance);
    if (!Number.isFinite(bal) || bal < 0) return res.json({ ok: false, error: 'Solde invalide.' });
    fields.balance = bal;
  }
  if (body.status !== undefined) {
    const st = String(body.status).toUpperCase();
    if (!['ACTIVE', 'BLOCKED', 'EXPIRED'].includes(st)) return res.json({ ok: false, error: 'Statut invalide.' });
    fields.status = st;
  }

  // "one active card per person" when this card ends up ACTIVE with an owner
  const existing = db.getCard(norm);
  const finalOwner = fields.owner !== undefined ? fields.owner : (existing ? existing.owner : null);
  const finalStatus = fields.status !== undefined ? fields.status : (existing ? existing.status : 'ACTIVE');
  if (finalStatus === 'ACTIVE' && finalOwner && db.activeCardForOwner(finalOwner, norm)) {
    return res.json({ ok: false, error: 'Ce client a déjà une autre carte active.' });
  }

  let card;
  if (existing) {
    card = db.updateCard(norm, fields);
  } else {
    card = db.createCard({
      uid: norm, owner: fields.owner ?? null,
      balance: fields.balance ?? 0, status: fields.status ?? 'ACTIVE', at: fields.at,
    });
  }
  console.log(`[cards] edit ${norm} by ${req.username}`);
  res.json({ ok: true, card: cardView(card) });
});

// Add credit.
app.post('/api/cards/:uid/recharge', requireAuth, (req, res) => {
  const norm = normUid(req.params.uid);
  const amount = Number((req.body || {}).amount);
  if (!norm) return res.json({ ok: false, error: 'UID invalide.' });
  if (!(amount > 0)) return res.json({ ok: false, error: 'Montant invalide.' });
  const card = db.getCard(norm);
  if (!card) return res.json({ ok: false, error: 'Carte introuvable.' });
  const updated = db.updateCard(norm, { balance: db.round2(card.balance + amount), at: nowIso() });
  console.log(`[cards] recharge ${norm} +${amount} -> ${updated.balance} by ${req.username}`);
  res.json({ ok: true, card: cardView(updated), balance: updated.balance });
});

// Block a card.
app.post('/api/cards/:uid/block', requireAuth, (req, res) => {
  const norm = normUid(req.params.uid);
  if (!norm) return res.json({ ok: false, error: 'UID invalide.' });
  const card = db.getCard(norm);
  if (!card) return res.json({ ok: false, error: 'Carte introuvable.' });
  const updated = db.updateCard(norm, { status: 'BLOCKED', at: nowIso() });
  console.log(`[cards] block ${norm} by ${req.username}`);
  res.json({ ok: true, card: cardView(updated) });
});

// Card Inspector: arm the gate's next tap (login required). It only inspects the card.
//  {op:'read'}                         dump every sector (factory key)
//  {op:'read', sector, code}           ... and unlock + decrypt that protected sector
//  {op:'write', sector, text, code?}   encrypt text into sector 1-15 and protect it with a
//                                      NEW decryption code (code = the sector's current code,
//                                      needed only if it is already protected)
//  {cancel:true}                       disarm
app.post('/api/inspect/arm', requireAuth, (req, res) => {
  const { op = 'read', sector, text, code, cancel } = req.body || {};
  if (cancel) {
    inspect.armed = false; inspect.job = null;
    return res.json({ ok: true, armed: false });
  }
  const s = Number(sector);
  const hasSector = sector !== undefined && sector !== null && sector !== '';
  if (hasSector && (!Number.isInteger(s) || s < 1 || s > 15)) {
    return res.json({ ok: false, error: 'Secteur 1 à 15 (le secteur 0 du fabricant ne s\'écrit pas).' });
  }
  let job;
  if (op === 'write') {
    const value = String(text ?? '');
    const bytes = Buffer.byteLength(value, 'utf8');
    if (!hasSector) return res.json({ ok: false, error: 'Choisissez un secteur.' });
    if (!bytes) return res.json({ ok: false, error: 'Valeur vide.' });
    if (bytes > SECTOR_BYTES) return res.json({ ok: false, error: `Maximum ${SECTOR_BYTES} octets (${bytes}).` });
    const newCode = newDecryptCode();
    job = { op: 'write', sector: s, length: bytes, newCode,
            key: normCode(code) ? sectorKeyHex(s, code) : DEFAULT_KEY,
            newKey: sectorKeyHex(s, newCode), data: encryptSector(s, newCode, value) };
  } else {
    job = { op: 'read', sector: hasSector && normCode(code) ? s : null,
            key: hasSector && normCode(code) ? sectorKeyHex(s, code) : '', code: normCode(code) || null };
  }
  inspect.armed = true; inspect.job = job; inspect.until = Date.now() + INSPECT_TTL_MS; inspect.by = req.username;
  lastInspectResult = null;
  console.log(`[inspect] armed by ${req.username}: ${job.op}${job.sector ? ' sector ' + job.sector : ''}`);
  res.json({ ok: true, armed: true, op: job.op, sector: job.sector });
});

// Protected sectors stored for a card (no values) — Cards & Clients edit.
app.get('/api/cards/:uid/secrets', requireAuth, (req, res) => {
  const norm = normUid(req.params.uid);
  if (!norm) return res.json({ ok: false, error: 'UID invalide.' });
  res.json({ ok: true, secrets: db.listSecrets(norm) });
});

// View a protected sector WITHOUT the card: the decryption code decrypts the stored copy.
// 5 wrong codes per IP -> locked 5 minutes.
const revealFails = new Map();   // ip -> { count, until }
app.post('/api/cards/:uid/secrets/:sector/reveal', requireAuth, (req, res) => {
  const ip = (req.ip || '').replace('::ffff:', '');
  const f = revealFails.get(ip) || { count: 0, until: 0 };
  if (f.until > Date.now()) return res.status(429).json({ ok: false, error: `Trop d'essais. Réessayez dans ${Math.ceil((f.until - Date.now()) / 60000)} min.` });
  const norm = normUid(req.params.uid);
  const secret = norm && db.getSecret(norm, Number(req.params.sector));
  if (!secret) return res.status(404).json({ ok: false, error: 'Aucune valeur protégée sur ce secteur.' });
  const code = (req.body || {}).code;
  if (!normCode(code) || !codeMatches(secret, code)) {
    f.count += 1;
    if (f.count >= 5) { f.until = Date.now() + 5 * 60000; f.count = 0; }
    revealFails.set(ip, f);
    return res.status(403).json({ ok: false, error: 'Code de déchiffrement incorrect.' });
  }
  revealFails.delete(ip);
  res.json({ ok: true, sector: secret.sector, writtenAt: secret.written_at,
             text: decryptSector(secret.sector, code, secret.cipher_hex, secret.length) });
});

/* ======================================================================
   Docs + frontend
   ====================================================================== */
app.get('/api/docs', (req, res) => res.json(buildDocs(app)));
app.use('/home', express.static(path.join(__dirname, '..', 'frontend'), { extensions: ['html'] }));
// Mobile cardholder app (same backend) — the phone opens this after tapping the card.
// Mobile web app: mobile/public in the repo (older deployments used "park mobil web/public").
const MOBILE_DIR = [path.join(__dirname, '..', 'mobile', 'public'), path.join(__dirname, '..', 'park mobil web', 'public')]
  .find((d) => require('fs').existsSync(d)) || path.join(__dirname, '..', 'mobile', 'public');
app.use('/app', express.static(MOBILE_DIR, { extensions: ['html'] }));
app.get('/', (req, res) => res.redirect('/home'));

app.listen(PORT, HOST, () => {
  console.log(`Smart Parking backend listening on port ${PORT}`);
  console.log(`  local:  http://localhost:${PORT}`);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  LAN:    http://${a.address}:${PORT}   <- use this in config.h BACKEND_URL`);
    }
  }
});
