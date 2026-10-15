// Server-authoritative application state.
//
// The prototype's pure operations (src/store/operations.js) now run HERE, with the actor taken from the
// server-side session, inside a SQLite transaction. The browser only asks; it can no longer grant itself
// permissions or write data. One state document (versioned by `rev`) lives in table app_state.
import { tx } from './db.js'
import { buildSeedState, STATE_VERSION } from '../src/store/seed.js'
import { setExtraRooms } from '../src/utils/lookup.js'
import { rooms as catalogRooms } from '../src/data/rooms.js'
import { isValidClass } from '../shared/divisions.js'
import crypto from 'node:crypto'

export const MAX_JSON = 20 * 1024 * 1024

import { ACTIONS, ACTION_NAMES, roleAllows } from '../src/store/actions.js'
import { viewFor } from '../src/store/view.js'
export { ACTION_NAMES, roleAllows }

const parse = row => JSON.parse(row.json)
function readState(db) {
  const row = db.prepare('SELECT rev, json FROM app_state WHERE id = 1').get()
  return row ? { state: { ...parse(row), rev: row.rev }, rev: row.rev } : null
}
function writeState(db, state, rev, now) {
  const { rev: _r, ...body } = state
  db.prepare(`INSERT INTO app_state (id, rev, json, updated_at) VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET rev = excluded.rev, json = excluded.json, updated_at = excluded.updated_at`).run(rev, JSON.stringify(body), now)
}

// Create the state document on first start (from the demo seed) — never overwrites an existing one.
export function ensureState(db, today, now) {
  tx(db, () => {
    if (readState(db)) return
    // Lectures of EVERY department come from OFFICIAL timetables, so no invented demo lectures are created
    writeState(db, { ...buildSeedState(today, { skipDepts: ['comp', 'it', 'aids', 'extc', 'chem'] }), officialRooms: [], pristine: true }, 0, now)
  })
}

// Run fn(state) -> { state, result } inside ONE transaction; persist (rev+1) only when the state changed.
export function mutate(db, fn, now) {
  return tx(db, () => {
    const cur = readState(db)
    if (!cur) throw new Error('state not initialised')
    setExtraRooms(cur.state.officialRooms)
    const out = fn(cur.state)
    if (out.state === cur.state) return { result: out.result, rev: cur.rev, changed: false }
    const rev = cur.rev + 1
    writeState(db, { ...out.state, rev }, rev, now)
    return { result: out.result, rev, changed: true }
  })
}

const plain = v => v && typeof v === 'object' && !Array.isArray(v)

// Apply ONE named action as `user`. Retried calls with the same opId return the stored result.
export function runAction(db, user, name, input, { today, now, opId }) {
  const fn = ACTIONS[name]
  if (!fn) return { status: 404, error: { code: 'UNKNOWN_ACTION', message: 'Unknown action.' } }
  if (!roleAllows(user.role, name)) return { status: 403, error: { code: 'FORBIDDEN', message: 'Your role is not allowed to do this.' } }
  if (name === 'markRead') { if (!Array.isArray(input?.ids) || input.ids.length > 1000 || input.ids.some(x => typeof x !== 'string' || x.length > 40)) return { status: 400, error: { code: 'BAD_INPUT', message: 'ids must be a list of notification ids.' } } }
  else if (!plain(input)) return { status: 400, error: { code: 'BAD_INPUT', message: 'Request body must be a JSON object.' } }
  if (opId !== undefined && (typeof opId !== 'string' || opId.length < 8 || opId.length > 64)) return { status: 400, error: { code: 'BAD_OP_ID', message: 'opId must be a string of 8–64 characters.' } }
  try {
    return tx(db, () => {
      if (opId) {
        const prior = db.prepare('SELECT result_json FROM op_log WHERE user_email = ? AND op_id = ?').get(user.email, opId)
        if (prior) return { status: 200, ...JSON.parse(prior.result_json), replayed: true }
      }
      // any real user action ends the "pristine" period (browser-data import is only allowed while pristine)
      const run = mutate(db, state => {
        const o = fn(state, user, input, { today })
        return o.state === state || name === 'markRead' ? o : { state: { ...o.state, pristine: false }, result: o.result }
      }, now)
      const body = { result: run.result, rev: run.rev }
      if (opId && name !== 'markRead') db.prepare('INSERT INTO op_log (user_email, op_id, result_json, at) VALUES (?,?,?,?)').run(user.email, opId, JSON.stringify(body), now)
      return { status: 200, ...body }
    })
  } catch (e) {
    console.error('action failed', name, e)
    return { status: 500, error: { code: 'ACTION_FAILED', message: 'The action failed and nothing was changed.' } }
  }
}

export const currentRev = db => db.prepare('SELECT rev FROM app_state WHERE id = 1').get()?.rev ?? -1
export function stateFor(db, user) {
  const cur = readState(db)
  setExtraRooms(cur.state.officialRooms)
  return viewFor(cur.state, user)
}

// ---------------------------------------------------------------------------------------------
// OFFICIAL TIMETABLES -> lectures.  Published, still-valid official timetables are mirrored into the
// shared `lectures` list (source: 'official') so approvals, cancellations, conflict checks and
// notifications apply to them exactly like every other lecture. Ids are derived from the entry's own
// content (not the version), so replacing a version with an identical entry keeps its history.
// ---------------------------------------------------------------------------------------------
const hash = parts => crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 10)

// "AK/SV" (two teachers) -> "Mr. Aejazul Khan / Dr. Shilpa Verma"; codes without a legend name stay as printed
const facultyNames = (codes, legend) => String(codes || '').split('/').map(c => c.trim()).filter(Boolean).map(c => legend.faculty?.[c] || c).join(' / ')

export function buildOfficialLectures(db, today) {
  const rows = db.prepare(`SELECT v.id AS vid, v.effective_from, v.expires_on, v.legend_json, t.id AS tid, t.dept_id, t.semester, t.division
    FROM versions v JOIN timetables t ON t.id = v.timetable_id
    WHERE v.status = 'published' AND (v.expires_on IS NULL OR v.expires_on >= ?) ORDER BY t.dept_id, t.semester, t.division, v.effective_from, v.id`).all(today)
  const lectures = []
  const seen = new Set()
  const roomIds = new Set(catalogRooms.map(r => r.id))
  const extra = new Map()
  for (const v of rows) {
    const legend = JSON.parse(v.legend_json || '{}')
    const entries = db.prepare('SELECT day,start,end,kind,subject,faculty,room,batch,label,note FROM entries WHERE version_id=? ORDER BY position').all(v.vid)
    for (const e of entries) {
      if (e.kind === 'break') continue // breaks stay on the official sheet; they are not lectures
      let id = `off-${hash([v.dept_id, v.semester, v.division, e.day, e.start, e.end, e.subject, e.batch, e.faculty, e.room])}`
      for (let n = 2; seen.has(id); n++) id = `${id.split('~')[0]}~${n}`
      seen.add(id)
      const room = (e.room || '').trim()
      if (room && !roomIds.has(room)) extra.set(room, { id: room, building: 'Official timetable', type: /lab/i.test(e.kind) ? 'Computer Lab' : 'Classroom', floor: '', capacity: 0 })
      lectures.push({
        id, source: 'official', deptId: v.dept_id, semester: v.semester, division: v.division,
        subject: e.kind === 'other' ? e.subject : legend.subjects?.[e.subject] ? `${e.subject} — ${legend.subjects[e.subject]}` : e.subject,
        subjectCode: e.subject, faculty: facultyNames(e.faculty, legend), facultyCode: e.faculty || '',
        weekday: e.day, start: e.start, end: e.end, roomId: room, slotId: 0,
        batch: e.batch || '', kind: e.kind || 'lecture', printedTime: e.label || '', note: e.note || '',
        validFrom: v.effective_from, validUntil: v.expires_on || null, timetableId: v.tid, versionId: v.vid,
      })
    }
  }
  return { lectures, rooms: [...extra.values()] }
}

// Idempotent: safe to call at any time. Only official lectures are touched; everything else is preserved.
export function syncOfficialLectures(db, today, now) {
  const built = buildOfficialLectures(db, today)
  return mutate(db, state => {
    // lectures of classes that are no longer active are DEACTIVATED (kept for history, never scheduled)
    // Non-official lectures are deactivated (kept, never scheduled) when their class is retired OR when an official
    // timetable now covers the same class (otherwise the class would show duplicates). Reversible for 'superseded'.
    const officialClasses = new Set(built.lectures.map(l => `${l.deptId}|${l.semester}|${l.division}`))
    const kept = state.lectures.filter(l => l.source !== 'official').map(l => {
      const reason = !isValidClass(l.deptId, l.semester, l.division) ? 'retired' : officialClasses.has(`${l.deptId}|${l.semester}|${l.division}`) ? 'superseded' : null
      if (reason) return l.inactive && l.inactiveReason === reason ? l : { ...l, inactive: true, inactiveReason: reason }
      if (l.inactive && l.inactiveReason === 'superseded') { const { inactive: _i, inactiveReason: _r, ...rest } = l; return rest }
      return l
    })
    const next = [...kept, ...built.lectures]
    const same = JSON.stringify(state.lectures) === JSON.stringify(next) && JSON.stringify(state.officialRooms || []) === JSON.stringify(built.rooms)
    if (same) return { state, result: { ok: true, changed: false } }
    return { state: { ...state, lectures: next, officialRooms: built.rooms }, result: { ok: true, changed: true, official: built.lectures.length } }
  }, now).result
}

// Deliver an official-timetable notice (published / updated / withdrawn) through the SAME shared list.
export function pushNotice(db, notice, now, { fromLedger = false } = {}) {
  if (!notice) return
  return mutate(db, state => {
    if (state.notifications.some(n => n.dedupeKey === notice.dedupe_key)) return { state, result: { ok: true, duplicate: true } }
    const seq = (state.seq || 0) + 1
    const q = new URLSearchParams({ dept: notice.dept_id, semester: notice.semester, division: notice.division, tab: 'official' })
    const n = {
      id: `n${seq}`, createdAt: notice.created_at, kind: 'published', category: 'timetable', severity: notice.kind === 'withdrawn' ? 'urgent' : 'info',
      title: notice.title, subject: `${notice.semester} · Division ${notice.division}`, body: notice.message, original: null, updated: null, changes: [], reason: '',
      audience: { students: { groups: [{ deptId: notice.dept_id, semester: notice.semester, division: notice.division }] }, faculty: { deptIds: [notice.dept_id] } },
      dedupeKey: notice.dedupe_key, link: `/app/timetable?${q}`, publishedBy: 'Timetable administration',
    }
    return { state: { ...state, seq, notifications: [n, ...state.notifications] }, result: { ok: true } }
  }, now).result
}

// Startup reconciliation: mirror official lectures + bring any notices recorded only in the legacy ledger into the shared list.
export function reconcile(db, today, now) {
  syncOfficialLectures(db, today, now)
  for (const r of db.prepare('SELECT * FROM notifications ORDER BY id').all()) pushNotice(db, r, now)
}

// One-time import of a browser's localStorage state. Only allowed while the server state is still pristine.
export function importBrowserState(db, incoming, today, now) {
  const arrays = ['lectures', 'exceptions', 'bookings', 'events', 'requests', 'notifications', 'audit']
  if (!plain(incoming) || incoming.version !== STATE_VERSION || !arrays.every(k => Array.isArray(incoming[k])) || !plain(incoming.reads) || !plain(incoming.settings)) {
    return { status: 400, error: { code: 'BAD_STATE', message: 'This is not a TSEC Sync browser backup (wrong version or shape).' } }
  }
  if (arrays.some(k => incoming[k].length > 20000)) return { status: 400, error: { code: 'TOO_LARGE', message: 'The backup is too large.' } }
  const out = mutate(db, cur => {
    if (cur.pristine === false) return { state: cur, result: { ok: false, conflict: true } }
    const s = { ...cur, ...Object.fromEntries(arrays.map(k => [k, incoming[k]])), reads: incoming.reads, settings: incoming.settings, seq: Math.max(cur.seq || 0, incoming.seq || 0), pristine: false }
    s.lectures = s.lectures.filter(l => l.source !== 'official')
    return { state: s, result: { ok: true } }
  }, now)
  if (out.result.conflict) return { status: 409, error: { code: 'SERVER_HAS_DATA', message: 'The server already has activity, so nothing was imported. This protects data that other users created.' } }
  syncOfficialLectures(db, today, now)
  return { status: 200, ok: true }
}
