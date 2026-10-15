// Data-access and business rules for timetables. Routes in app.js stay thin.
import crypto from 'node:crypto'
import { tx } from './db.js'
import { departmentShort, isValidClass } from '../shared/divisions.js'
import { findWarnings } from './validate.js'

const FIELDS = ['day', 'start', 'end', 'kind', 'subject', 'faculty', 'room', 'batch', 'label', 'note']
export const normEntry = e => Object.fromEntries(FIELDS.map(f => [f, String(e[f] ?? '').trim()]))
export function contentHash(entries, legend, fileSha) {
  const n = entries.map(normEntry).map(e => FIELDS.map(f => e[f]).join('|')).sort()
  return crypto.createHash('sha256').update(JSON.stringify([n, legend || {}, fileSha || ''])).digest('hex')
}
export const getEntries = (db, versionId) => db.prepare('SELECT day,start,end,kind,subject,faculty,room,batch,label,note FROM entries WHERE version_id=? ORDER BY position').all(versionId).map(r => ({ ...r }))
export function setEntries(db, versionId, entries) {
  db.prepare('DELETE FROM entries WHERE version_id=?').run(versionId)
  const ins = db.prepare('INSERT INTO entries (version_id, position, day, start, end, kind, subject, faculty, room, batch, label, note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
  entries.map(normEntry).forEach((e, i) => ins.run(versionId, i, e.day, e.start, e.end, e.kind || 'lecture', e.subject, e.faculty, e.room, e.batch, e.label, e.note))
}
export const classLabel = t => `${departmentShort(t.dept_id)} ${t.semester}${t.division ? ` · Division ${t.division}` : ''}`

export function publicVersion(v) {
  if (!v) return null
  const { file_key: _k, legend_json, sheet_json, ...rest } = v
  return { ...rest, has_file: !!v.file_key, legend: JSON.parse(legend_json || '{}'), sheet: JSON.parse(sheet_json || '{}') }
}
export const listMeta = v => { const { legend, sheet, ...r } = publicVersion(v); return r }

export function writeAudit(db, user, action, o = {}) {
  db.prepare(`INSERT INTO audit (at, user_id, user_name, user_email, action, timetable_id, version_id, from_status, to_status, from_version, to_version, reason, detail_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(o.at, user?.id ?? null, user?.name ?? 'system', user?.email ?? 'system', action, o.timetableId ?? null, o.versionId ?? null,
    o.fromStatus ?? null, o.toStatus ?? null, o.fromVersion ?? null, o.toVersion ?? null, o.reason || '', JSON.stringify(o.detail || {}))
}

const sessionKey = e => [e.day, e.start, e.end, e.subject, e.batch, e.faculty, e.room].join('|')
export function diffEntries(prev, next) {
  const a = new Set(prev.map(sessionKey)), b = new Set(next.map(sessionKey))
  return { added: next.filter(e => !a.has(sessionKey(e))).length, removed: prev.filter(e => !b.has(sessionKey(e))).length }
}

// De-duplicated in-app notification. Returns true when a NEW notification was stored.
export function notify(db, t, v, kind, message, at, keyExtra = '') {
  const titles = { published: 'New timetable published', replaced: 'Timetable updated', withdrawn: 'Timetable withdrawn' }
  const key = `${kind}:${t.id}:${keyExtra || v.id}`
  const title = `${titles[kind]} — ${classLabel(t)}`
  const r = db.prepare(`INSERT OR IGNORE INTO notifications (created_at, timetable_id, version_id, dept_id, semester, division, kind, title, message, effective_from, dedupe_key)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(at, t.id, v.id, t.dept_id, t.semester, t.division, kind, title, message, v.effective_from, key)
  return r.changes > 0 ? { created_at: at, dept_id: t.dept_id, semester: t.semester, division: t.division, kind, title, message, effective_from: v.effective_from, dedupe_key: key } : null
}

export class HttpError extends Error {
  constructor(status, code, message, extra = {}) { super(message); this.status = status; this.code = code; this.extra = extra }
}
const fmtDate = d => d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : ''

// ------- state transitions (each is one transaction + audit + notification) -------
export function publishVersion(db, user, id, { replace = false, reason = '' }, now, today) {
  return tx(db, () => {
    const v = db.prepare('SELECT * FROM versions WHERE id=?').get(id)
    if (!v) throw new HttpError(404, 'NOT_FOUND', 'Version not found.')
    if (v.status !== 'draft') throw new HttpError(409, 'BAD_STATE', `Only a draft can be published (this version is ${v.status}).`)
    if (!v.file_key && !getEntries(db, id).length) throw new HttpError(422, 'EMPTY_TIMETABLE', 'This timetable has no PDF and no entries, so there is nothing to publish.')
    if (!v.effective_from) throw new HttpError(422, 'MISSING_DATE', 'An effective date is required before publishing.')
    if (v.expires_on && v.expires_on < today) throw new HttpError(422, 'ALREADY_EXPIRED', 'The expiry date is in the past.')
    const t = db.prepare('SELECT * FROM timetables WHERE id=?').get(v.timetable_id)
    if (!isValidClass(t.dept_id, t.semester, t.division)) throw new HttpError(422, 'INACTIVE_CLASS', `${classLabel(t)} is not an active class (only Semesters III, V and VII, and the configured divisions, can be published).`)
    const current = db.prepare("SELECT * FROM versions WHERE timetable_id=? AND status='published'").get(t.id)
    const entries = getEntries(db, id)
    let prevEntries = []
    if (current) {
      if (!replace) throw new HttpError(409, 'REPLACE_REQUIRED', `${classLabel(t)} already has a published timetable (version ${current.version_no}). Confirm replacement to publish this one.`, { current: listMeta(current) })
      prevEntries = getEntries(db, current.id)
      db.prepare("UPDATE versions SET status='archived', updated_at=? WHERE id=?").run(now, current.id)
      writeAudit(db, user, 'replaced', { at: now, timetableId: t.id, versionId: current.id, fromStatus: 'published', toStatus: 'archived', fromVersion: current.version_no, toVersion: v.version_no, reason: reason || 'Replaced by a newer version' })
    }
    db.prepare("UPDATE versions SET status='published', published_at=?, updated_at=? WHERE id=?").run(now, now, id)
    writeAudit(db, user, current ? 'publish_replace' : 'publish', { at: now, timetableId: t.id, versionId: id, fromStatus: 'draft', toStatus: 'published', fromVersion: current?.version_no ?? null, toVersion: v.version_no, reason })
    // notification: skip when nothing actually changed (same content as the version being replaced)
    let notice = null
    if (!current) {
      notice = notify(db, t, v, 'published', `A timetable for ${classLabel(t)} (${t.academic_year}) is now available, effective ${fmtDate(v.effective_from)}.`, now, v.content_hash)
    } else if (current.content_hash !== v.content_hash) {
      const d = diffEntries(prevEntries, entries)
      const detail = entries.length && prevEntries.length ? `${d.added} session(s) added or changed, ${d.removed} removed or changed.` : 'A revised timetable is available.'
      notice = notify(db, t, v, 'replaced', `The timetable for ${classLabel(t)} was updated, effective ${fmtDate(v.effective_from)}. ${detail}`, now, v.content_hash)
    }
    return { version: listMeta(db.prepare('SELECT * FROM versions WHERE id=?').get(id)), notified: !!notice, notice, replaced: current ? current.version_no : null }
  })
}

export function changeStatus(db, user, id, action, { reason = '' }, now) {
  const rules = { // action -> [allowed from, to, notify withdrawn?]
    withdraw: [['published'], 'withdrawn'], archive: [['published', 'withdrawn'], 'archived'], cancel: [['draft'], 'cancelled'],
  }
  const [from, to] = rules[action]
  return tx(db, () => {
    const v = db.prepare('SELECT * FROM versions WHERE id=?').get(id)
    if (!v) throw new HttpError(404, 'NOT_FOUND', 'Version not found.')
    if (!from.includes(v.status)) throw new HttpError(409, 'BAD_STATE', `Cannot ${action} a version that is ${v.status}.`)
    const t = db.prepare('SELECT * FROM timetables WHERE id=?').get(v.timetable_id)
    db.prepare('UPDATE versions SET status=?, updated_at=? WHERE id=?').run(to, now, id)
    writeAudit(db, user, action, { at: now, timetableId: t.id, versionId: id, fromStatus: v.status, toStatus: to, fromVersion: v.version_no, toVersion: v.version_no, reason })
    let notice = null
    if (v.status === 'published' && (action === 'withdraw' || action === 'archive')) {
      notice = notify(db, t, v, 'withdrawn', `The timetable for ${classLabel(t)} (effective ${fmtDate(v.effective_from)}) has been withdrawn.${reason ? ' Reason: ' + reason : ''} Please check with your department until a replacement is published.`, now)
    }
    return { version: listMeta(db.prepare('SELECT * FROM versions WHERE id=?').get(id)), notified: !!notice, notice }
  })
}

// New draft that starts as a copy of an existing version (edit a published timetable, or restore an old one).
export function cloneVersion(db, user, id, { reason = '', action = 'clone' }, now) {
  return tx(db, () => {
    const src = db.prepare('SELECT * FROM versions WHERE id=?').get(id)
    if (!src) throw new HttpError(404, 'NOT_FOUND', 'Version not found.')
    const next = db.prepare('SELECT COALESCE(MAX(version_no),0)+1 AS n FROM versions WHERE timetable_id=?').get(src.timetable_id).n
    const nv = Number(db.prepare(`INSERT INTO versions (timetable_id, version_no, status, title, notes, effective_from, expires_on, file_key, file_name, file_sha256, file_size, legend_json, sheet_json, content_hash, source_version_id, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(src.timetable_id, next, 'draft', src.title, action === 'restore' ? `Restored from version ${src.version_no}. ${src.notes}`.trim() : src.notes, src.effective_from, src.expires_on, src.file_key, src.file_name, src.file_sha256, src.file_size, src.legend_json, src.sheet_json, src.content_hash, src.id, user.email, now, now).lastInsertRowid)
    setEntries(db, nv, getEntries(db, id))
    writeAudit(db, user, action, { at: now, timetableId: src.timetable_id, versionId: nv, toStatus: 'draft', fromVersion: src.version_no, toVersion: next, reason })
    return listMeta(db.prepare('SELECT * FROM versions WHERE id=?').get(nv))
  })
}
export const warningsFor = (db, v) => findWarnings(getEntries(db, v.id), JSON.parse(v.legend_json || '{}'))
