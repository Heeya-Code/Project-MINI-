import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { hashPassword } from './auth.js'
import { tx } from './db.js'
import { IT_TIMETABLES } from './seed/it-data.js'
import { OFFICIAL_TIMETABLES } from './seed/official-data.js'
import { OFFICIAL_TIMETABLES_2 } from './seed/official-data-2.js'
import { contentHash } from './timetables.js'

const here = path.dirname(fileURLToPath(import.meta.url))
// ASSUMPTION (to be confirmed): the sheets do not print an academic year; W.E.F. 06.07.2026 => 2026-27.
export const IT_ACADEMIC_YEAR = '2026-27'

// Demo accounts mirror src/data/users.js (same passwords) so the existing demo logins keep working.
// For a real deployment set SEED_DEMO_USERS=0 and create real accounts (see README).
export const DEMO_USERS = [
  // Development-only sample accounts (same demo-password convention as before). The divisions of the three students
  // were not specified, so C1 / S1 / I1 are placeholders. Teacher names are spelled exactly as printed on the official
  // COMP sheets ("Dr. Rupali Sarode" = RS, "Dr. Sakshi Surve" = SMS), so their lectures are found by name.
  ['student@tsec.edu', 'student123', 'student', 'Heeya Shewkani', 'comp', 'SEM V', 'C1'],
  ['student.aids@tsec.edu', 'student123', 'student', 'Dhwani Shriyan', 'aids', 'SEM III', 'S1'],
  ['student.it@tsec.edu', 'student123', 'student', 'Tanisha Thakur', 'it', 'SEM VII', 'I1'],
  ['teacher@tsec.edu', 'teacher123', 'teacher', 'Dr. Rupali Sarode', 'comp', null, null],
  ['teacher2@tsec.edu', 'teacher123', 'teacher', 'Dr. Sakshi Surve', 'comp', null, null],
  ['admin@tsec.edu', 'admin123', 'management', 'Dr. S. Iyer', null, null, null],
]

export function seedUsers(db, { demo = true, adminEmail = process.env.ADMIN_EMAIL, adminPassword = process.env.ADMIN_PASSWORD } = {}) {
  const ins = db.prepare('INSERT OR IGNORE INTO users (email, name, role, department, semester, division, password_hash) VALUES (?,?,?,?,?,?,?)')
  if (demo) {
    const upd = db.prepare('UPDATE users SET name=?, department=?, semester=?, division=? WHERE email=? AND role=?')
    for (const [email, pw, role, name, dept, sem, div] of DEMO_USERS) {
      ins.run(email, name, role, dept, sem, div, hashPassword(pw))
      upd.run(name, dept, sem, div, email, role) // same role only: a teacher can never become a student or vice versa
    }
  }
  if (adminEmail && adminPassword) ins.run(adminEmail, 'Administrator', 'management', null, null, null, hashPassword(adminPassword))
}

// Imports every official timetable shipped with the app (IT + Computer Engineering + AI&DS).
// IDEMPOTENT and safe on an existing database:
//   * a timetable whose exact PDF is already stored for that class (in ANY version/status) is skipped, so a later
//     withdrawal/replacement by an administrator is never undone;
//   * a class that already has other content gets a NEW version; the previously published one is archived
//     (history, files and entries kept, audit row written) — nothing is overwritten or deleted.
export function seedOfficialTimetables(db, dataDir, now = () => new Date().toISOString(), { skip = [] } = {}) {
  const results = []
  for (const [id, t] of Object.entries({ ...IT_TIMETABLES, ...OFFICIAL_TIMETABLES, ...OFFICIAL_TIMETABLES_2 })) {
    if (skip.includes(id)) continue // test hook: leave a class without an official timetable
    const dept = t.deptId || 'it'
    const pdfName = t.pdfFile || `${id}-TT.pdf`
    const pdf = fs.readFileSync(path.join(here, 'seed', 'pdfs', pdfName))
    const sha = crypto.createHash('sha256').update(pdf).digest('hex')
    const key = `${sha}.pdf`
    const dest = path.join(dataDir, 'files', key)
    const existing = db.prepare('SELECT id FROM timetables WHERE dept_id=? AND semester=? AND division=? AND academic_year=?').get(dept, t.semester, t.division, IT_ACADEMIC_YEAR)
    if (existing && db.prepare('SELECT id FROM versions WHERE timetable_id=? AND file_sha256=?').get(existing.id, sha)) { results.push({ id, skipped: true }); continue }
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, pdf)
    tx(db, () => {
      const at = now()
      const ttId = existing ? existing.id : Number(db.prepare('INSERT INTO timetables (dept_id, semester, division, academic_year, created_at) VALUES (?,?,?,?,?)').run(dept, t.semester, t.division, IT_ACADEMIC_YEAR, at).lastInsertRowid)
      const vno = db.prepare('SELECT COALESCE(MAX(version_no),0)+1 AS n FROM versions WHERE timetable_id=?').get(ttId).n
      const cur = db.prepare("SELECT id, version_no FROM versions WHERE timetable_id=? AND status='published'").get(ttId)
      if (cur) {
        db.prepare("UPDATE versions SET status='archived', updated_at=? WHERE id=?").run(at, cur.id)
        db.prepare(`INSERT INTO audit (at, user_name, user_email, action, timetable_id, version_id, from_status, to_status, from_version, to_version, reason) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
          .run(at, 'system', 'system', 'replaced', ttId, cur.id, 'published', 'archived', cur.version_no, vno, `Replaced by the official timetable ${id} (${pdfName})`)
      }
      const sheet = { identifier: id, header: t.header, sheetLabel: t.sheetLabel, room: t.room, notes: t.sheetNotes, sourceIssues: t.sourceIssues, sourceFile: pdfName }
      const hash = contentHash(t.entries, t.legend, sha)
      const vId = Number(db.prepare(`INSERT INTO versions (timetable_id, version_no, status, title, notes, effective_from, file_key, file_name, file_sha256, file_size, legend_json, sheet_json, content_hash, created_by, created_at, updated_at, published_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(ttId, vno, 'published', `${dept.toUpperCase()} ${t.semester}${t.division ? " " + t.division : ""} (${id})`, 'Initial import of the official timetable PDF.', t.effectiveFrom, key, pdfName, sha, pdf.length, JSON.stringify(t.legend), JSON.stringify(sheet), hash, 'system (initial import)', at, at, at).lastInsertRowid)
      const insE = db.prepare('INSERT INTO entries (version_id, position, day, start, end, kind, subject, faculty, room, batch, label, note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      t.entries.forEach((e, i) => insE.run(vId, i, e.day, e.start, e.end, e.kind, e.subject, e.faculty, e.room, e.batch, e.label, e.note))
      db.prepare(`INSERT INTO audit (at, user_name, user_email, action, timetable_id, version_id, to_status, to_version, reason) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(at, 'system', 'system', 'import', ttId, vId, 'published', vno, `Imported ${id} (${pdfName})`)
    })
    results.push({ id, imported: true })
  }
  return results
}
export const seedItTimetables = seedOfficialTimetables // old name kept
