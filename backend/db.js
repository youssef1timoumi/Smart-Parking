// SQLite setup. Uses Node's built-in node:sqlite (Node >= 22.13) and falls back to
// better-sqlite3 on older Node (e.g. the VPS runs Node 20). Same API for what we use.
//
// Task 1: device heartbeats.          Task 2: card reads (log).
// Task 3: cards (source of truth for balance/status), parking visits, denials, admin users.
const path = require('path');
const fs = require('fs');

function openDatabase(file) {
  try {
    const { DatabaseSync } = require('node:sqlite');
    return new DatabaseSync(file);
  } catch {
    const Database = require('better-sqlite3');
    return new Database(file);
  }
}

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = openDatabase(process.env.DB_PATH || path.join(DATA_DIR, 'parking.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    device_id   TEXT PRIMARY KEY,
    ip          TEXT,
    rssi        INTEGER,
    uptime_ms   INTEGER,
    last_seen   TEXT NOT NULL,
    ping_count  INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS card_reads (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    uid        TEXT NOT NULL,
    card_type  TEXT,
    device_id  TEXT,
    read_at    TEXT NOT NULL
  );

  -- Task 3: the card IS the identity; owner, balance (solde) and status live here.
  CREATE TABLE IF NOT EXISTS cards (
    uid         TEXT PRIMARY KEY,
    owner       TEXT,
    balance     REAL NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'ACTIVE',   -- ACTIVE | BLOCKED | EXPIRED
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
  -- Card Inspector: text written ENCRYPTED into a card sector. Only the decryption
  -- code's hash is kept (never the code); the ciphertext lets the admin view the
  -- value later without the card, by typing the code.
  CREATE TABLE IF NOT EXISTS card_secrets (
    uid         TEXT NOT NULL,
    sector      INTEGER NOT NULL,
    cipher_hex  TEXT NOT NULL,       -- 48 bytes = the 3 data blocks as written on the card
    length      INTEGER NOT NULL,    -- plaintext length in bytes
    code_salt   TEXT NOT NULL,
    code_hash   TEXT NOT NULL,
    written_at  TEXT NOT NULL,
    PRIMARY KEY (uid, sector)
  );
  -- One parking visit = tap in (ENTRY) then tap out (EXIT, billed).
  CREATE TABLE IF NOT EXISTS visits (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    uid          TEXT NOT NULL,
    owner        TEXT,
    entry_at     TEXT NOT NULL,
    exit_at      TEXT,
    duration_sec INTEGER,
    price        REAL,
    status       TEXT NOT NULL DEFAULT 'OPEN'      -- OPEN | CLOSED
  );
  -- Refused taps (for the journal / audit).
  CREATE TABLE IF NOT EXISTS denials (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    uid     TEXT NOT NULL,
    owner   TEXT,
    reason  TEXT,
    at      TEXT NOT NULL
  );
  -- Admin accounts for the write endpoints.
  CREATE TABLE IF NOT EXISTS users (
    username    TEXT PRIMARY KEY,
    salt        TEXT NOT NULL,
    hash        TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );
`);

/* ---- migrations (add columns to existing DBs; SQLite has no ADD COLUMN IF NOT EXISTS) ---- */
const deviceCols = db.prepare('PRAGMA table_info(devices)').all().map((c) => c.name);
if (!deviceCols.includes('lcd')) db.exec('ALTER TABLE devices ADD COLUMN lcd INTEGER'); // 1/0/null

/* ---- devices + reads (Tasks 1-2) ---------------------------------------- */
const upsertPing = db.prepare(`
  INSERT INTO devices (device_id, ip, rssi, uptime_ms, last_seen, ping_count, lcd)
  VALUES (?, ?, ?, ?, ?, 1, ?)
  ON CONFLICT(device_id) DO UPDATE SET
    ip = excluded.ip, rssi = excluded.rssi, uptime_ms = excluded.uptime_ms,
    last_seen = excluded.last_seen, ping_count = ping_count + 1, lcd = excluded.lcd
`);
const insertCardRead = db.prepare(
  'INSERT INTO card_reads (uid, card_type, device_id, read_at) VALUES (?, ?, ?, ?)'
);
const recentCardReads = db.prepare('SELECT * FROM card_reads ORDER BY id DESC LIMIT ?');
const listDevices = db.prepare('SELECT * FROM devices ORDER BY last_seen DESC');

/* ---- cards (Task 3) ------------------------------------------------------ */
const getCardStmt = db.prepare('SELECT * FROM cards WHERE uid = ?');
const listCardsStmt = db.prepare('SELECT * FROM cards ORDER BY (owner IS NULL), owner COLLATE NOCASE, uid');
const insertCardStmt = db.prepare(
  'INSERT INTO cards (uid, owner, balance, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
);
const updateCardStmt = db.prepare(
  'UPDATE cards SET owner = ?, balance = ?, status = ?, updated_at = ? WHERE uid = ?'
);
const activeOwnerStmt = db.prepare(
  "SELECT uid FROM cards WHERE status = 'ACTIVE' AND owner IS NOT NULL AND lower(owner) = lower(?) AND uid <> ? LIMIT 1"
);
// distinct scanned UIDs that have no card row yet
const unregisteredScansStmt = db.prepare(`
  SELECT r.uid AS uid, MAX(r.read_at) AS last_seen, COUNT(*) AS reads, MAX(r.card_type) AS card_type
  FROM card_reads r
  LEFT JOIN cards c ON c.uid = r.uid
  WHERE c.uid IS NULL
  GROUP BY r.uid
  ORDER BY last_seen DESC
`);

/* ---- visits + denials (Task 3) ------------------------------------------ */
const openVisitStmt = db.prepare("SELECT * FROM visits WHERE uid = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1");
const insertVisitStmt = db.prepare(
  "INSERT INTO visits (uid, owner, entry_at, status) VALUES (?, ?, ?, 'OPEN')"
);
const closeVisitStmt = db.prepare(
  "UPDATE visits SET exit_at = ?, duration_sec = ?, price = ?, status = 'CLOSED' WHERE id = ?"
);
const listVisitsStmt = db.prepare('SELECT * FROM visits ORDER BY id DESC LIMIT ?');
const insertDenialStmt = db.prepare('INSERT INTO denials (uid, owner, reason, at) VALUES (?, ?, ?, ?)');
const listDenialsStmt = db.prepare('SELECT * FROM denials ORDER BY id DESC LIMIT ?');

/* ---- users (Task 3) ------------------------------------------------------ */
const getUserStmt = db.prepare('SELECT * FROM users WHERE username = ?');
const insertUserStmt = db.prepare('INSERT INTO users (username, salt, hash, created_at) VALUES (?, ?, ?, ?)');

/* ---- card secrets (Card Inspector) ---------------------------------------- */
const upsertSecretStmt = db.prepare(`
  INSERT INTO card_secrets (uid, sector, cipher_hex, length, code_salt, code_hash, written_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(uid, sector) DO UPDATE SET cipher_hex = excluded.cipher_hex, length = excluded.length,
    code_salt = excluded.code_salt, code_hash = excluded.code_hash, written_at = excluded.written_at`);
const getSecretStmt = db.prepare('SELECT * FROM card_secrets WHERE uid = ? AND sector = ?');
const listSecretsStmt = db.prepare('SELECT uid, sector, length, written_at FROM card_secrets WHERE uid = ? ORDER BY sector');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

module.exports = {
  // devices + reads
  recordPing({ deviceId, ip, rssi, uptimeMs, at, lcd }) {
    const lcdVal = lcd === undefined || lcd === null ? null : (lcd ? 1 : 0);
    upsertPing.run(deviceId, ip ?? null, rssi ?? null, uptimeMs ?? null, at, lcdVal);
  },
  getDevices() { return listDevices.all(); },
  recordCardRead({ uid, type, deviceId, at }) {
    insertCardRead.run(uid, type ?? null, deviceId ?? null, at);
  },
  getRecentCardReads(limit = 10) { return recentCardReads.all(limit); },

  // cards
  getCard(uid) { return getCardStmt.get(uid) || null; },
  listCards() { return listCardsStmt.all(); },
  listUnregisteredScans() { return unregisteredScansStmt.all(); },
  activeCardForOwner(owner, excludeUid = '') {
    if (!owner) return null;
    const row = activeOwnerStmt.get(owner, excludeUid);
    return row ? row.uid : null;
  },
  createCard({ uid, owner, balance, status, at }) {
    insertCardStmt.run(uid, owner ?? null, round2(balance), status || 'ACTIVE', at, at);
    return this.getCard(uid);
  },
  updateCard(uid, { owner, balance, status, at }) {
    const c = this.getCard(uid);
    if (!c) return null;
    updateCardStmt.run(
      owner !== undefined ? (owner ?? null) : c.owner,
      balance !== undefined ? round2(balance) : c.balance,
      status !== undefined ? status : c.status,
      at,
      uid
    );
    return this.getCard(uid);
  },

  // visits + denials
  getOpenVisit(uid) { return openVisitStmt.get(uid) || null; },
  openVisit({ uid, owner, at }) {
    const r = insertVisitStmt.run(uid, owner ?? null, at);
    return Number(r.lastInsertRowid);
  },
  closeVisit({ id, exitAt, durationSec, price }) {
    closeVisitStmt.run(exitAt, durationSec, round2(price), id);
  },
  listVisits(limit = 50) { return listVisitsStmt.all(limit); },
  addDenial({ uid, owner, reason, at }) { insertDenialStmt.run(uid, owner ?? null, reason ?? null, at); },
  listDenials(limit = 50) { return listDenialsStmt.all(limit); },

  // card secrets
  saveSecret({ uid, sector, cipherHex, length, salt, hash, at }) {
    upsertSecretStmt.run(uid, sector, cipherHex, length, salt, hash, at);
  },
  getSecret(uid, sector) { return getSecretStmt.get(uid, sector) || null; },
  listSecrets(uid) { return listSecretsStmt.all(uid); },

  // users
  getUser(username) { return getUserStmt.get(username) || null; },
  createUser({ username, salt, hash, at }) { insertUserStmt.run(username, salt, hash, at); },

  round2,
};
