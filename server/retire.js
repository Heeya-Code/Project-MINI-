// Retire (never delete) data that belongs to classes that are no longer ACTIVE:
// semesters I, II, IV, VI, VIII and AI&DS division S3. Idempotent and safe to run at every start.
//   * published official timetables of an inactive class -> archived (history, files and entries kept)
//   * pending drafts of an inactive class                 -> cancelled (kept)
//   * withdrawn/archived/cancelled versions               -> untouched (they are history)
// Each change is written to the audit log. Lectures of inactive classes are deactivated in
// server/state.js (syncOfficialLectures) so they stop appearing anywhere but stay in the data.
import { tx } from './db.js'
import { isValidClass } from '../shared/divisions.js'

export function retireInactiveClasses(db, now) {
  return tx(db, () => {
    const rows = db.prepare(`SELECT v.id vid, v.status, v.version_no, t.id tid, t.dept_id, t.semester, t.division
      FROM versions v JOIN timetables t ON t.id = v.timetable_id WHERE v.status IN ('published','draft')`).all()
    let archived = 0, cancelled = 0
    for (const r of rows) {
      if (isValidClass(r.dept_id, r.semester, r.division)) continue
      const to = r.status === 'published' ? 'archived' : 'cancelled'
      db.prepare('UPDATE versions SET status=?, updated_at=? WHERE id=?').run(to, now, r.vid)
      db.prepare(`INSERT INTO audit (at, user_name, user_email, action, timetable_id, version_id, from_status, to_status, from_version, to_version, reason)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(now, 'system', 'system', 'retire_inactive_class', r.tid, r.vid, r.status, to, r.version_no, r.version_no,
        `${r.dept_id.toUpperCase()} ${r.semester} Division ${r.division} is no longer an active class; kept in history.`)
      to === 'archived' ? archived++ : cancelled++
    }
    // The COMP divisions were renamed CI/CII/CIII -> C1/C2/C3 (as printed on the sheets). The mapping is exact, so
    // existing accounts are moved to the matching new division (nothing else about the account changes).
    let renamed = 0
    for (const [from, to] of [['CI', 'C1'], ['CII', 'C2'], ['CIII', 'C3']]) renamed += Number(db.prepare("UPDATE users SET division=? WHERE department='comp' AND division=?").run(to, from).changes)
    // EXTC and Chemistry have no divisions any more: their students simply belong to the semester's one class.
    // (Only the division column changes; no account is removed.)
    renamed += Number(db.prepare("UPDATE users SET division='' WHERE department IN ('extc','chem') AND division IS NOT NULL AND division<>''").run().changes)
    return { archived, cancelled, renamed }
  })
}
