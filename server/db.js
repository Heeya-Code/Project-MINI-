// SQLite via Node's built-in `node:sqlite` (Node >= 22.5; no native build step).
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export const STATUSES = ['draft', 'published', 'withdrawn', 'archived', 'cancelled']

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','teacher','management')),
  department TEXT, semester TEXT, division TEXT, password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS timetables (
  id INTEGER PRIMARY KEY, dept_id TEXT NOT NULL, semester TEXT NOT NULL, division TEXT NOT NULL,
  academic_year TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE (dept_id, semester, division, academic_year)
);
CREATE TABLE IF NOT EXISTS versions (
  id INTEGER PRIMARY KEY, timetable_id INTEGER NOT NULL REFERENCES timetables(id),
  version_no INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','published','withdrawn','archived','cancelled')),
  title TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
  effective_from TEXT, expires_on TEXT,
  file_key TEXT, file_name TEXT, file_sha256 TEXT, file_size INTEGER,
  legend_json TEXT NOT NULL DEFAULT '{}', sheet_json TEXT NOT NULL DEFAULT '{}', content_hash TEXT NOT NULL DEFAULT '',
  source_version_id INTEGER REFERENCES versions(id),
  created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT,
  UNIQUE (timetable_id, version_no)
);
-- at most ONE published version per (department, academic year, semester, division)
CREATE UNIQUE INDEX IF NOT EXISTS one_published_per_timetable ON versions(timetable_id) WHERE status = 'published';
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY, version_id INTEGER NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, day TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'lecture', subject TEXT NOT NULL, faculty TEXT NOT NULL DEFAULT '',
  room TEXT NOT NULL DEFAULT '', batch TEXT NOT NULL DEFAULT '', label TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS entries_by_version ON entries(version_id);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY, at TEXT NOT NULL, user_id INTEGER, user_name TEXT NOT NULL, user_email TEXT NOT NULL,
  action TEXT NOT NULL, timetable_id INTEGER, version_id INTEGER, from_status TEXT, to_status TEXT,
  from_version INTEGER, to_version INTEGER, reason TEXT NOT NULL DEFAULT '', detail_json TEXT NOT NULL DEFAULT '{}'
);
-- Shared application state (lectures, exceptions, requests, bookings, events, notifications, audit, read marks).
-- ONE row, versioned by rev; every change is applied by server/state.js inside a transaction.
CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY CHECK (id = 1), rev INTEGER NOT NULL, json TEXT NOT NULL, updated_at TEXT NOT NULL
);
-- Idempotency ledger: a retried action (same user + opId) returns the stored result instead of running twice.
CREATE TABLE IF NOT EXISTS op_log (
  user_email TEXT NOT NULL, op_id TEXT NOT NULL, result_json TEXT NOT NULL, at TEXT NOT NULL,
  PRIMARY KEY (user_email, op_id)
);
-- Legacy ledger of official-timetable notices (kept for de-duplication and history; the notices themselves are
-- delivered through the single shared notification list in app_state).
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY, created_at TEXT NOT NULL, timetable_id INTEGER NOT NULL, version_id INTEGER NOT NULL,
  dept_id TEXT NOT NULL, semester TEXT NOT NULL, division TEXT NOT NULL, kind TEXT NOT NULL,
  title TEXT NOT NULL, message TEXT NOT NULL, effective_from TEXT, dedupe_key TEXT NOT NULL UNIQUE
);
`

export function openDb(dataDir) {
  fs.mkdirSync(path.join(dataDir, 'files'), { recursive: true })
  const db = new DatabaseSync(path.join(dataDir, 'tsec.db'))
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA)
  return db
}

// Run fn inside a transaction; rolls back if it throws. Re-entrant: a nested call becomes a SAVEPOINT,
// so an inner failure undoes only the inner work and the outer transaction decides the final outcome.
const depth = new WeakMap()
export function tx(db, fn) {
  const d = depth.get(db) || 0
  if (d > 0) {
    const sp = `sp${d}`
    db.exec(`SAVEPOINT ${sp}`); depth.set(db, d + 1)
    try { const out = fn(); db.exec(`RELEASE ${sp}`); return out } catch (e) { db.exec(`ROLLBACK TO ${sp}; RELEASE ${sp}`); throw e } finally { depth.set(db, d) }
  }
  db.exec('BEGIN IMMEDIATE'); depth.set(db, 1)
  try { const out = fn(); db.exec('COMMIT'); return out } catch (e) { db.exec('ROLLBACK'); throw e } finally { depth.set(db, 0) }
}
